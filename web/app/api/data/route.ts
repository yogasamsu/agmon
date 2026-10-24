import { NextResponse } from "next/server";
import { fireBondAbi } from "@/lib/abi";
import { FIREBOND, publicClient } from "@/lib/chain";
import { supabase } from "@/lib/supabase";
import type { DashboardData } from "@/lib/types";

const MULTICALL3 = {
  address: "0xcA11bde05977b3631167028862bE2a173976CA11",
  abi: [
    {
      type: "function",
      name: "getEthBalance",
      stateMutability: "view",
      inputs: [{ name: "addr", type: "address" }],
      outputs: [{ name: "balance", type: "uint256" }],
    },
  ],
} as const;

export const dynamic = "force-dynamic";

/**
 * Data dashboard. Isi lengkap (geometri, koordinat, batch) dibaca dari Supabase; status insiden,
 * saldo jaminan, dan jumlah batch selalu dibaca dari Monad, karena chain adalah sumber kebenaran
 * dan Supabase bisa tertinggal sesaat dari chain.
 */
// Banyak pengunjung dalam 10 detik cukup memicu satu bacaan chain dan database.
const CACHE_MS = 10_000;
let cache: { at: number; data: DashboardData } | null = null;
let inflight: Promise<DashboardData> | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) return NextResponse.json(cache.data);
    inflight ??= load().finally(() => {
      inflight = null;
    });
    const data = await inflight;
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    // Kalau chain sedang membatasi permintaan, data terakhir yang berhasil lebih berguna daripada galat.
    if (cache) return NextResponse.json(cache.data);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function load(): Promise<DashboardData> {
  {
    const db = supabase();
    const hotspotCols = "id,lat,lng,confidence,frp,observed_at_unix,concession_id,incident_id,batch_id";
    const since48h = Math.floor(Date.now() / 1000) - 48 * 3600;
    const [concessionRes, incidentRes, hotspotRes, insideRes, batchRes, countRes] = await Promise.all([
      db.from("concessions").select("id,name,owner,geojson,register_tx").order("id"),
      db
        .from("incidents")
        .select("id,concession_id,cell,observed_at_unix,report_tx,hotspot:hotspots(lat,lng)")
        .order("id", { ascending: false })
        .limit(50),
      // Titik api terbaru dari seluruh Indonesia untuk konteks peta.
      db.from("hotspots").select(hotspotCols).order("observed_at_unix", { ascending: false }).limit(1500),
      // Titik api di dalam izin selalu ikut, walaupun lebih lama dari 1.500 titik terbaru.
      db
        .from("hotspots")
        .select(hotspotCols)
        .not("concession_id", "is", null)
        .order("observed_at_unix", { ascending: false })
        .limit(500),
      db.from("batches").select("*").order("id", { ascending: false }).limit(20),
      db.from("hotspots").select("id", { count: "exact", head: true }).gte("observed_at_unix", since48h),
    ]);
    for (const res of [concessionRes, incidentRes, hotspotRes, insideRes, batchRes, countRes]) if (res.error) throw res.error;
    const count48h = countRes.count;
    const hotspotRows = new Map<number, NonNullable<typeof hotspotRes.data>[number]>();
    for (const h of [...insideRes.data!, ...hotspotRes.data!]) hotspotRows.set(h.id, h);

    const onChain = Boolean(FIREBOND);

    // Semua bacaan kontrak dimulai bersamaan supaya viem menggabungkannya menjadi satu panggilan Multicall3.
    const chainMeta = onChain
      ? Promise.all([
          publicClient.readContract({ address: FIREBOND, abi: fireBondAbi, functionName: "restorationFund" }),
          publicClient.readContract({ address: FIREBOND, abi: fireBondAbi, functionName: "batchCount" }),
          // Saldo kontrak = kolam jaminan yang sedang ditahan untuk semua izin.
          publicClient.readContract({ ...MULTICALL3, functionName: "getEthBalance", args: [FIREBOND] }),
        ])
      : null;
    const concessions = await Promise.all(
      concessionRes.data!.map(async (row) => {
        const [, , bond, confirmedFires, openIncidents] = onChain
          ? await publicClient.readContract({
              address: FIREBOND,
              abi: fireBondAbi,
              functionName: "concessions",
              args: [BigInt(row.id)],
            })
          : [null, null, 0n, 0, 0];
        return {
          id: row.id,
          name: row.name,
          owner: row.owner,
          geojson: row.geojson,
          registerTx: row.register_tx,
          bondWei: bond.toString(),
          confirmedFires: Number(confirmedFires),
          openIncidents: Number(openIncidents),
        };
      }),
    );

    const incidents = await Promise.all(
      incidentRes.data!.map(async (row) => {
        const [, , , , , status, evidenceHash] = onChain
          ? await publicClient.readContract({
              address: FIREBOND,
              abi: fireBondAbi,
              functionName: "incidents",
              args: [BigInt(row.id)],
            })
          : [null, null, null, null, null, 0, "0x"];
        const hotspot = row.hotspot as unknown as { lat: number; lng: number } | null;
        return {
          id: row.id,
          concessionId: row.concession_id,
          cell: row.cell,
          observedAt: row.observed_at_unix,
          reportTx: row.report_tx,
          status: Number(status),
          evidenceHash,
          lat: hotspot?.lat ?? null,
          lng: hotspot?.lng ?? null,
        };
      }),
    );

    let fundAddress: string | null = null;
    let fundBalanceWei = "0";
    let batchCount = batchRes.data!.length;
    let bondPoolWei = "0";
    if (chainMeta) {
      const [fund, batches, pool] = await chainMeta;
      bondPoolWei = pool.toString();
      fundAddress = fund;
      batchCount = Number(batches);
      fundBalanceWei = (
        await publicClient.readContract({ ...MULTICALL3, functionName: "getEthBalance", args: [fund] })
      ).toString();
    }

    const data: DashboardData = {
      fireBond: FIREBOND,
      fundAddress,
      fundBalanceWei,
      bondPoolWei,
      batchCount,
      hotspotCount48h: count48h ?? 0,
      concessions,
      incidents,
      hotspots: [...hotspotRows.values()].map((h) => ({
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        confidence: h.confidence,
        frp: h.frp,
        observedAt: h.observed_at_unix,
        concessionId: h.concession_id,
        incidentId: h.incident_id,
        batchId: h.batch_id,
      })),
      batches: batchRes.data!.map((b) => ({
        id: b.id,
        dataHash: b.data_hash,
        count: b.count,
        fromUnix: b.from_unix,
        toUnix: b.to_unix,
        source: b.source,
        anchorTx: b.anchor_tx,
      })),
    };
    return data;
  }
}
