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
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

// multicall: semua readContract dalam satu putaran digabung menjadi satu eth_call lewat Multicall3.
// RPC publik Monad menolak terlalu banyak panggilan sekaligus, dan jumlah insiden terus bertambah.
export const publicClient = createPublicClient({
  chain: monad,
  batch: { multicall: true },
  transport: http(undefined, { retryCount: 3 }),
});

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

/**
 * Skala demo: berapa Rupiah yang diwakili 1 MON testnet. Faucet hanya memberi beberapa MON,
 * jadi jaminan 10 MON dibaca sebagai Rp1 miliar. Angka MON aslinya tetap ditampilkan di sebelahnya.
 */
export const IDR_PER_MON = Number(process.env.NEXT_PUBLIC_DEMO_IDR_PER_MON || 100_000_000);

type IdrUnits = { billion: string; million: string; prefix: string };

export function formatIdr(wei: string | bigint, units: IdrUnits, locale = "id-ID", perMon = IDR_PER_MON): string {
  const idr = Number(formatEther(BigInt(wei))) * perMon;
  const num = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
  if (idr >= 1e9) return `${units.prefix}${num(idr / 1e9)} ${units.billion}`;
  if (idr >= 1e6) return `${units.prefix}${num(idr / 1e6)} ${units.million}`;
  return `${units.prefix}${num(idr)}`;
}

export const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;
