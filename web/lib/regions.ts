import provinces from "@/data/provinces.json";

/**
 * Nama provinsi untuk sebuah koordinat. Batas dari Peta Dasar BAKOSURTANAL (34 provinsi, sebelum
 * pemekaran Papua 2022), disederhanakan ke 2 desimal (sekitar 1 km), jadi titik di garis pantai
 * kadang jatuh di luar poligon. Untuk titik seperti itu dipakai provinsi dengan kotak batas terdekat.
 */
type Province = { name: string; bbox: [number, number, number, number]; rings: [number, number][][] };
const PROVINCES = provinces as unknown as Province[];

function inRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bboxDistance(lng: number, lat: number, [minX, minY, maxX, maxY]: Province["bbox"]): number {
  const dx = Math.max(minX - lng, 0, lng - maxX);
  const dy = Math.max(minY - lat, 0, lat - maxY);
  return dx * dx + dy * dy;
}

export function provinceOf(lng: number, lat: number): string {
  let nearest = PROVINCES[0];
  let nearestDist = Infinity;
  for (const p of PROVINCES) {
    const d = bboxDistance(lng, lat, p.bbox);
    if (d === 0 && p.rings.some((r) => inRing(lng, lat, r))) return p.name;
    if (d < nearestDist) {
      nearestDist = d;
      nearest = p;
    }
  }
  // Di luar semua poligon dan jauh dari daratan: bukan wilayah darat Indonesia.
  return nearestDist > 0.25 ? "" : nearest.name;
}
