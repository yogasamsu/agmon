import { createClient } from "@supabase/supabase-js";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config, monad } from "./config.js";

export const publicClient = createPublicClient({ chain: monad, transport: http() });

export function walletFor(privateKey: Hex) {
  return createWalletClient({ account: privateKeyToAccount(privateKey), chain: monad, transport: http() });
}

export function db() {
  return createClient(config.supabaseUrl(), config.supabaseServiceKey(), {
    auth: { persistSession: false },
  });
}

/** Ubah sel H3 hex (mis. "872a1072bffffff") ke uint64 untuk contract. */
export function cellToUint(cell: string): bigint {
  return BigInt(`0x${cell}`);
}

/** Pastikan Supabase bisa dihubungi sebelum mengirim transaksi apa pun ke chain. */
export async function assertDbReachable(supa: ReturnType<typeof db>) {
  const { error } = await supa.from("concessions").select("id").limit(1);
  if (error) throw new Error(`Supabase tidak bisa dihubungi: ${error.message} (${error.code ?? "tanpa kode"})`);
}

/** Cetak galat secara ringkas. Galat viem memuat ABI lengkap yang tidak perlu ditampilkan. */
export function exitWithError(err: unknown): never {
  const e = err as { shortMessage?: string; metaMessages?: string[]; message?: string };
  console.error(e.shortMessage ?? e.message ?? String(err));
  for (const line of e.metaMessages?.slice(0, 2) ?? []) console.error(line);
  process.exit(1);
}
