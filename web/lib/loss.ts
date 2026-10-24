/**
 * Estimasi kerugian ekonomi per titik api dari data sekunder. Indikatif, batas atas, dan belum
 * memasukkan eksternalitas (kesehatan jangka panjang, pendidikan, emisi karbon).
 *
 * - Bank Dunia, Indonesia Economic Quarterly Desember 2019: kerugian kebakaran 2019 sekitar
 *   US$5,2 miliar (US$157 juta kerusakan aset + US$5,0 miliar kerugian aktivitas ekonomi),
 *   8 provinsi, Juni sampai Oktober 2019. Bank Dunia mencatat angka ini belum memasukkan dampak
 *   kesehatan dan pendidikan jangka panjang.
 * - Luas terbakar 2019 sekitar 942.000 ha (data resmi, dikutip Reuters, Desember 2019).
 * - Satu titik api VIIRS mewakili satu piksel 375 m x 375 m, sekitar 14 ha. Tidak seluruh piksel
 *   pasti terbakar, jadi ini batas atas.
 */
export const LOSS_SOURCE_URL =
  "https://www.worldbank.org/en/country/indonesia/publication/december-2019-indonesia-economic-quarterly";

const USD_LOSS_2019 = 5.2e9;
const HA_BURNED_2019 = 942_000;
export const USD_PER_HA = USD_LOSS_2019 / HA_BURNED_2019;
export const PIXEL_HA = 0.375 * 0.375 * 100;
export const IDR_PER_USD = Number(process.env.NEXT_PUBLIC_IDR_PER_USD || 16_000);

/** Estimasi kerugian satu titik api, dalam Rupiah. */
export const LOSS_PER_HOTSPOT_IDR = PIXEL_HA * USD_PER_HA * IDR_PER_USD;

type Units = { trillion: string; billion: string; million: string; prefix: string };

export function formatRupiah(idr: number, units: Units, locale: string): string {
  const num = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: n >= 100 ? 0 : 1 });
  if (idr >= 1e12) return `${units.prefix}${num(idr / 1e12)} ${units.trillion}`;
  if (idr >= 1e9) return `${units.prefix}${num(idr / 1e9)} ${units.billion}`;
  if (idr >= 1e6) return `${units.prefix}${num(idr / 1e6)} ${units.million}`;
  return `${units.prefix}${num(idr)}`;
}
