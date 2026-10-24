// Samakan Supabase dengan FireBond. Chain adalah sumber kebenaran; Supabase hanya indeks
// dan penyimpan data mentah. Oracle menulis ke chain dulu, baru ke Supabase, jadi celah yang
// mungkin terjadi selalu satu arah: ada di chain, belum ada di Supabase.
//
// - Batch: data mentahnya ditulis dulu ke spool/<hash>.json sebelum anchorBatch. Kalau insert
//   ke Supabase gagal, file itu tetap ada dan diputar ulang di sini.
// - Insiden: semua isinya bisa dibaca ulang dari kontrak, jadi baris yang hilang dibuat ulang.
//
// Dipanggil otomatis di awal setiap putaran oracle. Bisa juga manual: npm run reconcile
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Hex } from "viem";
import { fireBondAbi } from "./abi.js";
import type { CanonicalHotspot } from "./canonical.js";
import { assertDbReachable, db, exitWithError, publicClient } from "./clients.js";
import { config } from "./config.js";

type Supa = ReturnType<typeof db>;

export type SpoolFile = { source: string; rows: CanonicalHotspot[] };

const SPOOL_DIR = join(process.cwd(), "spool");

const spoolPath = (dataHash: Hex) => join(SPOOL_DIR, `${dataHash}.json`);

/** Simpan data mentah batch ke disk sebelum hash-nya dicatat di chain. */
export function writeSpool(dataHash: Hex, spool: SpoolFile) {
  mkdirSync(SPOOL_DIR, { recursive: true });
  writeFileSync(spoolPath(dataHash), JSON.stringify(spool));
}

/** Hapus spool setelah batch dan semua hotspot-nya tersimpan di Supabase. */
export function clearSpool(dataHash: Hex) {
  if (existsSync(spoolPath(dataHash))) unlinkSync(spoolPath(dataHash));
}

async function idsIn(supa: Supa, table: "batches" | "incidents"): Promise<Set<number>> {
  const ids = new Set<number>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supa.from(table).select("id").order("id").range(offset, offset + 999);
    if (error) throw error;
    for (const row of data) ids.add(Number(row.id));
    if (data.length < 1000) return ids;
  }
}

async function concessionByCell(supa: Supa): Promise<Map<string, number>> {
  const { data, error } = await supa.from("concessions").select("id,cells");
  if (error) throw error;
  const map = new Map<string, number>();
  for (const c of data) for (const cell of c.cells as string[]) map.set(cell, c.id);
  return map;
}

async function upsertHotspots(supa: Supa, batchId: number, rows: CanonicalHotspot[], cells: Map<string, number>) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((h) => ({ batch_id: batchId, ...h, concession_id: cells.get(h.cell) ?? null }));
    // ignoreDuplicates: putaran yang gagal di tengah bisa sudah menyimpan sebagian hotspot.
    const { error } = await supa.from("hotspots").upsert(chunk, { onConflict: "observed_at_unix,lat,lng", ignoreDuplicates: true });
    if (error) throw error;
  }
}

const readSpool = (dataHash: Hex) => JSON.parse(readFileSync(spoolPath(dataHash), "utf8")) as SpoolFile;

async function reconcileBatches(supa: Supa): Promise<number> {
  const address = config.fireBondAddress();
  const onChain = Number(await publicClient.readContract({ address, abi: fireBondAbi, functionName: "batchCount" }));
  const known = await idsIn(supa, "batches");
  const spooled = existsSync(SPOOL_DIR) ? readdirSync(SPOOL_DIR).map((f) => f.replace(/\.json$/, "") as Hex) : [];
  if (known.size === onChain && spooled.length === 0) return 0;

  const cells = await concessionByCell(supa);
  let restored = 0;

  // 1. Batch yang ada di chain tapi belum ada di Supabase.
  for (let id = 1; id <= onChain; id++) {
    if (known.has(id)) continue;
    const [dataHash, count, fromTime, toTime] = await publicClient.readContract({
      address,
      abi: fireBondAbi,
      functionName: "batches",
      args: [BigInt(id)],
    });
    if (!existsSync(spoolPath(dataHash))) {
      console.warn(`Batch #${id} ada di chain tapi data mentahnya tidak ada di Supabase maupun spool. Cek integritas batch ini akan gagal.`);
      continue;
    }
    const spool = readSpool(dataHash);
    const { error } = await supa.from("batches").insert({
      id,
      data_hash: dataHash,
      count,
      from_unix: Number(fromTime),
      to_unix: Number(toTime),
      source: spool.source,
      anchor_tx: null,
    });
    if (error) throw error;
    await upsertHotspots(supa, id, spool.rows, cells);
    clearSpool(dataHash);
    restored++;
    console.log(`Batch #${id} dipulihkan dari spool (${spool.rows.length} hotspot)`);
  }

  // 2. Spool yang tersisa: batch sudah tercatat tapi hotspot-nya mungkin baru tersimpan sebagian,
  //    atau anchorBatch tidak pernah berhasil. Yang kedua aman dibuang: hotspot-nya belum
  //    tersimpan, jadi putaran berikutnya mengambilnya lagi dari FIRMS.
  for (const dataHash of spooled) {
    if (!existsSync(spoolPath(dataHash))) continue;
    const { data: batch, error } = await supa.from("batches").select("id").eq("data_hash", dataHash).maybeSingle();
    if (error) throw error;
    if (batch) {
      await upsertHotspots(supa, Number(batch.id), readSpool(dataHash).rows, cells);
      console.log(`Hotspot batch #${batch.id} dilengkapi dari spool`);
      restored++;
    }
    clearSpool(dataHash);
  }
  return restored;
}

async function reconcileIncidents(supa: Supa): Promise<number> {
  const address = config.fireBondAddress();
  const onChain = Number(await publicClient.readContract({ address, abi: fireBondAbi, functionName: "incidentCount" }));
  const known = await idsIn(supa, "incidents");
  let restored = 0;

  for (let id = 1; id <= onChain; id++) {
    if (known.has(id)) continue;
    const [concessionId, cellUint, observedAt] = await publicClient.readContract({
      address,
      abi: fireBondAbi,
      functionName: "incidents",
      args: [BigInt(id)],
    });
    const cell = cellUint.toString(16);
    const { data: hotspot } = await supa
      .from("hotspots")
      .select("id")
      .eq("cell", cell)
      .eq("observed_at_unix", Number(observedAt))
      .limit(1)
      .maybeSingle();

    const { error } = await supa.from("incidents").insert({
      id,
      concession_id: Number(concessionId),
      hotspot_id: hotspot?.id ?? null,
      cell,
      observed_at_unix: Number(observedAt),
      report_tx: null,
    });
    if (error) throw error;
    if (hotspot) await supa.from("hotspots").update({ incident_id: id }).eq("id", hotspot.id);
    restored++;
    console.log(`Insiden #${id} dipulihkan dari chain`);
  }
  return restored;
}

export async function reconcile(supa: Supa) {
  await assertDbReachable(supa);
  const batches = await reconcileBatches(supa);
  const incidents = await reconcileIncidents(supa);
  return { batches, incidents };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  reconcile(db())
    .then(({ batches, incidents }) => console.log(`Selesai: ${batches} batch dan ${incidents} insiden dipulihkan`))
    .catch(exitWithError);
}
