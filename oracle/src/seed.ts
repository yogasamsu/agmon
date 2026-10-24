// Daftarkan konsesi dari file GeoJSON ke FireBond dan Supabase, lalu setor fire bond.
// Pakai: npm run seed -- ../data/demo-concession.geojson
import { readFileSync } from "node:fs";
import { polygonToCells } from "h3-js";
import { parseEther, parseEventLogs } from "viem";
import { fireBondAbi } from "./abi.js";
import { assertDbReachable, cellToUint, db, exitWithError, publicClient, walletFor } from "./clients.js";
import { config, H3_RES } from "./config.js";

type Geometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

type Feature = { type: "Feature"; properties: { name: string }; geometry: Geometry };

function cellsFor(geometry: Geometry): string[] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const cells = new Set<string>();
  for (const polygon of polygons) {
    for (const cell of polygonToCells(polygon, H3_RES, true)) cells.add(cell);
  }
  return [...cells].sort();
}

async function main() {
  const path = process.argv[2] ?? "../data/demo-concession.geojson";
  const features = (JSON.parse(readFileSync(path, "utf8")) as { features: Feature[] }).features;
  const address = config.fireBondAddress();
  const owner = walletFor(config.ownerKey());
  const supa = db();
  await assertDbReachable(supa);

  for (const feature of features) {
    const name = feature.properties.name;
    const { data: existing, error: lookupError } = await supa.from("concessions").select("id").eq("name", name).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      console.log(`Lewati "${name}": sudah terdaftar dengan id ${existing.id}`);
      continue;
    }

    const cells = cellsFor(feature.geometry);
    if (cells.length === 0) {
      console.warn(`Lewati "${name}": poligon lebih kecil dari satu sel H3`);
      continue;
    }

    // Konsesi bisa sudah ada di chain tapi belum di Supabase (mis. seed sebelumnya terputus).
    // Kalau nama dan pemiliknya sama, pakai id yang sudah ada.
    let id = await publicClient.readContract({
      address,
      abi: fireBondAbi,
      functionName: "cellToConcession",
      args: [cellToUint(cells[0])],
    });
    let registerTx: string | null = null;
    let bond = 0n;
    if (id !== 0n) {
      const [chainOwner, chainName, chainBond] = await publicClient.readContract({
        address,
        abi: fireBondAbi,
        functionName: "concessions",
        args: [id],
      });
      if (chainName !== name || chainOwner.toLowerCase() !== owner.account.address.toLowerCase()) {
        console.warn(`Lewati "${name}": sel ${cells[0]} sudah dipakai konsesi #${id} "${chainName}"`);
        continue;
      }
      bond = chainBond;
      console.log(`"${name}" sudah ada di chain sebagai #${id}, menyalin ke Supabase`);
    } else {
      const { request } = await publicClient.simulateContract({
        account: owner.account,
        address,
        abi: fireBondAbi,
        functionName: "registerConcession",
        args: [name, cells.map(cellToUint)],
      });
      registerTx = await owner.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: registerTx as `0x${string}` });
      const [registered] = parseEventLogs({ abi: fireBondAbi, logs: receipt.logs, eventName: "ConcessionRegistered" });
      id = registered.args.id;
    }

    let depositTx: string | null = null;
    if (bond === 0n) {
      depositTx = await owner.writeContract({
        address,
        abi: fireBondAbi,
        functionName: "depositBond",
        args: [id],
        value: parseEther(config.bondMon),
      });
      await publicClient.waitForTransactionReceipt({ hash: depositTx as `0x${string}` });
    }

    const { error } = await supa.from("concessions").insert({
      id: Number(id),
      name,
      owner: owner.account.address,
      geojson: feature,
      cells,
      register_tx: registerTx,
    });
    if (error) throw error;

    console.log(`Konsesi #${id} "${name}": ${cells.length} sel`);
    if (registerTx) console.log(`  register ${registerTx}`);
    if (depositTx) console.log(`  deposit  ${depositTx} (${config.bondMon} MON)`);
  }
}

main().catch(exitWithError);
