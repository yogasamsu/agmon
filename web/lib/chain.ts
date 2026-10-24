import { createPublicClient, defineChain, formatEther, http, type Address } from "viem";

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/yogasamsu/agmon";
export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.monadexplorer.com";
export const FIREBOND = (process.env.NEXT_PUBLIC_FIREBOND_ADDRESS || "") as Address;

export const monad = defineChain({
  id: Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || 10143),
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: EXPLORER } },
  testnet: true,
});

// batch: true menggabungkan banyak panggilan baca dalam satu permintaan HTTP.
export const publicClient = createPublicClient({ chain: monad, transport: http(undefined, { batch: true }) });

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;

/** Urutan sama dengan enum Status di FireBond.sol. Labelnya ada di lib/i18n.tsx. */
export const STATUS = { None: 0, Suspected: 1, Confirmed: 2, Rejected: 3 } as const;

export function formatMon(wei: string | bigint, locale = "id-ID"): string {
  const value = Number(formatEther(BigInt(wei)));
  return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} MON`;
}

export function formatWib(unix: number, locale = "id-ID"): string {
  return (
    new Date(unix * 1000).toLocaleString(locale, {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

export const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;
