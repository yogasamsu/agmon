import { NextResponse } from "next/server";
import { fireBondAbi } from "@/lib/abi";
import { FIREBOND, publicClient } from "@/lib/chain";
import { supabase } from "@/lib/supabase";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Data dashboard. Isi lengkap (geometri, koordinat, batch) dibaca dari Supabase; status insiden,
 * saldo jaminan, dan jumlah batch selalu dibaca dari Monad, karena chain adalah sumber kebenaran
 * dan Supabase bisa tertinggal sesaat dari chain.
 */
export async function GET() {
  try {
    const db = supabase();
    const hotspotCols = "id,lat,lng,confidence,frp,observed_at_unix,concession_id,incident_id,batch_id";
    const [concessionRes, incidentRes, hotspotRes, insideRes, batchRes] = await Promise.all([
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
    ]);
    for (const res of [concessionRes, incidentRes, hotspotRes, insideRes, batchRes]) if (res.error) throw res.error;
    const hotspotRows = new Map<number, NonNullable<typeof hotspotRes.data>[number]>();
    for (const h of [...insideRes.data!, ...hotspotRes.data!]) hotspotRows.set(h.id, h);

    const onChain = Boolean(FIREBOND);

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
    if (onChain) {
      const [fund, batches] = await Promise.all([
        publicClient.readContract({ address: FIREBOND, abi: fireBondAbi, functionName: "restorationFund" }),
        publicClient.readContract({ address: FIREBOND, abi: fireBondAbi, functionName: "batchCount" }),
      ]);
      fundAddress = fund;
      batchCount = Number(batches);
      fundBalanceWei = (await publicClient.getBalance({ address: fund })).toString();
    }

    const data: DashboardData = {
      fireBond: FIREBOND,
      fundAddress,
      fundBalanceWei,
      batchCount,
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
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
