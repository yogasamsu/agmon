// Satu putaran oracle: ambil hotspot, catat hash batch di Monad, simpan ke Supabase,
// lalu laporkan hotspot yang jatuh di dalam konsesi.
// Pakai: npm run oracle                      (data langsung dari FIRMS)
//        npm run oracle -- --file ../data/demo-hotspots.csv
import { basename } from "node:path";
import { latLngToCell } from "h3-js";
import { parseEventLogs } from "viem";
import { fireBondAbi } from "./abi.js";
import { batchHash } from "./canonical.js";
import { cellToUint, db, exitWithError, publicClient, walletFor } from "./clients.js";
import { config, H3_RES } from "./config.js";
import { fetchFirms, readFirmsFile } from "./firms.js";
import { clearSpool, reconcile, writeSpool } from "./reconcile.js";

type Supa = ReturnType<typeof db>;

const SYNC_TIMEOUT_MS = 20_000;
/** Sama dengan DEDUP_WINDOW di FireBond.sol. */
const DEDUP_WINDOW_SECONDS = 24 * 60 * 60;

const key = (h: { observed_at_unix: number; lat: number; lng: number }) => `${h.observed_at_unix}|${h.lat}|${h.lng}`;

/** PostgREST membatasi 1000 baris per permintaan, jadi ambil per halaman. */
async function existingKeys(supa: Supa, from: number, to: number): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supa
      .from("hotspots")
      .select("observed_at_unix,lat,lng")
      .gte("observed_at_unix", from)
      .lte("observed_at_unix", to)
      .range(offset, offset + 999);
    if (error) throw error;
    for (const row of data) keys.add(key(row));
    if (data.length < 1000) return keys;
  }
}

async function main() {
  const fileArg = process.argv.indexOf("--file");
  const file = fileArg >= 0 ? process.argv[fileArg + 1] : undefined;
  const source = file ? `file:${basename(file)}` : config.firmsSources.join("+");

  const supa = db();
  const oracle = walletFor(config.oracleKey());
  const address = config.fireBondAddress();

  // Tutup celah dari putaran sebelumnya dulu, supaya hotspot yang sudah tercatat di chain
  // tidak dianggap baru lalu dicatat dua kali.
  const healed = await reconcile(supa);
  if (healed.batches || healed.incidents) console.log(`Rekonsiliasi: ${healed.batches} batch, ${healed.incidents} insiden`);

  const raw = file ? readFirmsFile(file) : await fetchFirms();
  const valid = raw.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng) && Number.isFinite(h.observed_at_unix));
  if (valid.length === 0) {
    console.log(`Tidak ada hotspot dari ${source}`);
    return;
  }

  const times = valid.map((h) => h.observed_at_unix);
  const fromTime = Math.min(...times);
  const toTime = Math.max(...times);
  const seen = await existingKeys(supa, fromTime, toTime);

  const fresh = [];
  for (const h of valid) {
    const k = key(h);
    if (seen.has(k)) continue;
    seen.add(k);
    fresh.push({ ...h, cell: latLngToCell(h.lat, h.lng, H3_RES) });
  }
  if (fresh.length === 0) {
    console.log(`Semua ${valid.length} hotspot dari ${source} sudah tersimpan`);
    return;
  }

  const { data: concessions, error: concessionError } = await supa.from("concessions").select("id,cells");
  if (concessionError) throw concessionError;
  const concessionByCell = new Map<string, number>();
  for (const c of concessions) for (const cell of c.cells as string[]) concessionByCell.set(cell, c.id);

  // 1. Sidik jari batch ke Monad. Data mentah ditulis ke spool dulu supaya bisa dipulihkan
  //    kalau penyimpanan ke Supabase gagal setelah transaksi masuk chain.
  const dataHash = batchHash(fresh);
  writeSpool(dataHash, {
    source,
    rows: fresh.map(({ observed_at_unix, lat, lng, confidence, frp, cell }) => ({ observed_at_unix, lat, lng, confidence, frp, cell })),
  });
  const { request: anchorRequest } = await publicClient.simulateContract({
    account: oracle.account,
    address,
    abi: fireBondAbi,
    functionName: "anchorBatch",
    args: [dataHash, fresh.length, BigInt(Math.min(...fresh.map((h) => h.observed_at_unix))), BigInt(Math.max(...fresh.map((h) => h.observed_at_unix)))],
  });
  // eth_sendRawTransactionSync: Monad mengembalikan receipt di panggilan yang sama.
  const anchorReceipt = await oracle.writeContractSync({ ...anchorRequest, timeout: SYNC_TIMEOUT_MS });
  const anchorTx = anchorReceipt.transactionHash;
  const [anchored] = parseEventLogs({ abi: fireBondAbi, logs: anchorReceipt.logs, eventName: "BatchAnchored" });
  const batchId = Number(anchored.args.batchId);
  console.log(`Batch #${batchId}: ${fresh.length} hotspot, hash ${dataHash}`);
  console.log(`  anchor ${anchorTx}`);

  // 2. Data lengkap ke Supabase
  const { error: batchError } = await supa.from("batches").insert({
    id: batchId,
    data_hash: dataHash,
    count: fresh.length,
    from_unix: Number(anchored.args.fromTime),
    to_unix: Number(anchored.args.toTime),
    source,
    anchor_tx: anchorTx,
  });
  if (batchError) throw batchError;

  const hotspotIds = new Map<string, number>();
  for (let i = 0; i < fresh.length; i += 500) {
    const chunk = fresh.slice(i, i + 500).map((h) => ({
      batch_id: batchId,
      observed_at_unix: h.observed_at_unix,
      lat: h.lat,
      lng: h.lng,
      confidence: h.confidence,
      frp: h.frp,
      cell: h.cell,
      concession_id: concessionByCell.get(h.cell) ?? null,
    }));
    const { data, error } = await supa.from("hotspots").insert(chunk).select("id,observed_at_unix,lat,lng");
    if (error) throw error;
    for (const row of data) hotspotIds.set(key(row), row.id);
  }
  clearSpool(dataHash);

  // 3. Laporkan hotspot di dalam konsesi. Kontrak menolak sel yang sama dalam 24 jam, tetapi
  //    transaksi yang ditolak tetap bayar gas. Jadi jendela itu dicek dulu lewat pembacaan gratis.
  const inside = fresh
    .filter((h) => concessionByCell.has(h.cell) && h.confidence >= 1)
    .sort((a, b) => a.observed_at_unix - b.observed_at_unix);
  const lastAt = new Map<string, number>();
  const candidates = [];
  for (const h of inside) {
    if (candidates.length >= config.maxReports) break;
    if (!lastAt.has(h.cell)) {
      const last = await publicClient.readContract({
        address,
        abi: fireBondAbi,
        functionName: "lastIncidentAt",
        args: [cellToUint(h.cell)],
      });
      lastAt.set(h.cell, Number(last));
    }
    const last = lastAt.get(h.cell)!;
    if (last !== 0 && h.observed_at_unix < last + DEDUP_WINDOW_SECONDS) continue;
    lastAt.set(h.cell, h.observed_at_unix);
    candidates.push(h);
  }
  console.log(`${inside.length} hotspot jatuh di dalam konsesi, ${candidates.length} dilaporkan (sisanya masih dalam jendela 24 jam sel yang sama)`);

  for (const h of candidates) {
    const { request } = await publicClient.simulateContract({
      account: oracle.account,
      address,
      abi: fireBondAbi,
      functionName: "reportHotspot",
      args: [cellToUint(h.cell), BigInt(h.observed_at_unix), h.confidence, BigInt(batchId)],
    });
    const receipt = await oracle.writeContractSync({ ...request, timeout: SYNC_TIMEOUT_MS });
    const reportTx = receipt.transactionHash;

    const [reported] = parseEventLogs({ abi: fireBondAbi, logs: receipt.logs, eventName: "HotspotReported" });
    if (!reported) {
      const [skipped] = parseEventLogs({ abi: fireBondAbi, logs: receipt.logs, eventName: "HotspotSkipped" });
      console.log(`  sel ${h.cell} dilewati (${skipped?.args.reason ?? "tanpa alasan"})`);
      continue;
    }

    const incidentId = Number(reported.args.incidentId);
    const hotspotId = hotspotIds.get(key(h));
    const { error: incidentError } = await supa.from("incidents").insert({
      id: incidentId,
      concession_id: Number(reported.args.concessionId),
      hotspot_id: hotspotId,
      cell: h.cell,
      observed_at_unix: h.observed_at_unix,
      report_tx: reportTx,
    });
    if (incidentError) throw incidentError;
    await supa.from("hotspots").update({ incident_id: incidentId }).eq("id", hotspotId);
    console.log(`  insiden #${incidentId} di konsesi #${reported.args.concessionId}, tx ${reportTx}`);
  }
}

main().catch(exitWithError);
