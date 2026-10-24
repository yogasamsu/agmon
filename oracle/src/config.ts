import "dotenv/config";
import { defineChain, type Address, type Hex } from "viem";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabel lingkungan ${name} belum diisi (lihat .env.example)`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const monad = defineChain({
  id: Number(optional("MONAD_CHAIN_ID", "10143")),
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [optional("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz")] } },
});

export const config = {
  fireBondAddress: () => required("FIREBOND_ADDRESS") as Address,
  oracleKey: () => required("ORACLE_PRIVATE_KEY") as Hex,
  ownerKey: () => required("OWNER_PRIVATE_KEY") as Hex,
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  firmsMapKey: () => required("FIRMS_MAP_KEY"),
  // Satu atau lebih produk FIRMS, dipisah koma. Bawaan: tiga satelit VIIRS supaya lintasan lebih rapat.
  firmsSources: optional("FIRMS_SOURCE", "VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT,VIIRS_SNPP_NRT").split(",").map((s) => s.trim()),
  // Satu atau lebih kotak "barat,selatan,timur,utara", dipisah titik koma. Bawaan: seluruh Indonesia.
  firmsAreas: optional("FIRMS_AREAS", "94.5,-11.5,141.5,6.5").split(";"),
  // 2 hari: hari ini menurut UTC sering belum berisi lintasan, karena lintasan dini hari WIB tercatat sebagai tanggal kemarin.
  firmsDayRange: Number(optional("FIRMS_DAY_RANGE", "2")),
  bondMon: optional("BOND_MON", "10"),
  maxReports: Number(optional("MAX_REPORTS", "25")),
};

/** Resolusi H3 yang dipakai di seluruh sistem (rata-rata sekitar 5 km² per sel). */
export const H3_RES = 7;
