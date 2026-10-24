import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { config } from "./config.js";

export type RawHotspot = {
  observed_at_unix: number;
  lat: number;
  lng: number;
  confidence: number; // 0 rendah, 1 nominal, 2 tinggi
  frp: number;
};

type FirmsRow = Record<string, string>;

/** VIIRS memakai l/n/h, MODIS memakai angka 0–100. */
function normalizeConfidence(value: string): number {
  const v = value.trim().toLowerCase();
  if (v === "l" || v === "low") return 0;
  if (v === "n" || v === "nominal") return 1;
  if (v === "h" || v === "high") return 2;
  const n = Number(v);
  if (Number.isFinite(n)) return n >= 80 ? 2 : n >= 30 ? 1 : 0;
  return 0;
}

function toUnix(acqDate: string, acqTime: string): number {
  const hhmm = acqTime.trim().padStart(4, "0");
  return Date.parse(`${acqDate}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`) / 1000;
}

function parseCsv(text: string): RawHotspot[] {
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as FirmsRow[];
  return rows.map((r) => ({
    observed_at_unix: toUnix(r.acq_date, r.acq_time),
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    confidence: normalizeConfidence(r.confidence ?? ""),
    frp: Number(r.frp ?? 0),
  }));
}

/**
 * Data hotspot dari API FIRMS untuk semua satelit di FIRMS_SOURCE dan semua kotak di FIRMS_AREAS.
 * Satu sumber yang gagal hanya dilewati; putaran baru gagal kalau semua sumber gagal.
 */
export async function fetchFirms(): Promise<RawHotspot[]> {
  const all: RawHotspot[] = [];
  const failures: string[] = [];
  for (const source of config.firmsSources) {
    for (const area of config.firmsAreas) {
      const url =
        `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${config.firmsMapKey()}` +
        `/${source}/${area}/${config.firmsDayRange}`;
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok || !text.startsWith("latitude")) {
        failures.push(`${source} ${area}: ${res.status} ${text.slice(0, 120)}`);
        continue;
      }
      const rows = parseCsv(text);
      console.log(`  ${source}: ${rows.length} hotspot (${config.firmsDayRange} hari terakhir)`);
      all.push(...rows);
    }
  }
  for (const f of failures) console.warn(`  FIRMS dilewati, ${f}`);
  if (failures.length === config.firmsSources.length * config.firmsAreas.length) {
    throw new Error("Semua permintaan FIRMS gagal. Cek FIRMS_MAP_KEY dan koneksi internet.");
  }
  return all;
}

/** Data hotspot dari file CSV berformat FIRMS (data cadangan atau arsip). */
export function readFirmsFile(path: string): RawHotspot[] {
  return parseCsv(readFileSync(path, "utf8"));
}
