// Salin ABI FireBond hasil `forge build` ke oracle dan web.
// Jalankan dari root repo setiap kali FireBond.sol berubah: node scripts/export-abi.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = join(root, "contracts/out/FireBond.sol/FireBond.json");
if (!existsSync(artifact)) {
  console.error("ABI belum ada. Jalankan `forge build` di folder contracts dulu.");
  process.exit(1);
}

const { abi } = JSON.parse(readFileSync(artifact, "utf8"));
const source =
  "// Dibuat otomatis oleh scripts/export-abi.mjs. Jangan diedit manual.\n" +
  `export const fireBondAbi = ${JSON.stringify(abi, null, 2)} as const;\n`;

for (const target of ["oracle/src/abi.ts", "web/lib/abi.ts"]) {
  const path = join(root, target);
  if (!existsSync(dirname(path))) continue;
  writeFileSync(path, source);
  console.log(`ABI ditulis ke ${target}`);
}
