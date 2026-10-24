import { keccak256, stringToBytes, type Hex } from "viem";

/**
 * Bentuk kanonik satu hotspot untuk hashing batch.
 * PENTING: fungsi ini harus identik dengan oracle/src/canonical.ts. Kalau salah satu diubah,
 * tombol "Cek integritas" akan selalu gagal.
 */
export type CanonicalHotspot = {
  observed_at_unix: number;
  lat: number;
  lng: number;
  confidence: number;
  frp: number;
  cell: string;
};

export function canonicalLine(h: CanonicalHotspot): string {
  return [h.observed_at_unix, h.lat, h.lng, h.confidence, h.frp, h.cell].map(String).join("|");
}

export function batchHash(rows: CanonicalHotspot[]): Hex {
  const lines = rows.map(canonicalLine).sort();
  return keccak256(stringToBytes(lines.join("\n")));
}
