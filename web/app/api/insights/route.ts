import { NextResponse } from "next/server";
import { provinceOf } from "@/lib/regions";
import { supabase } from "@/lib/supabase";
import type { Insights } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ringkasan nasional untuk regulator: jumlah titik api 48 jam, provinsi terbanyak, dan kelompok
 * titik api yang perlu perhatian. Dihitung dari puluhan ribu baris, jadi hasilnya disimpan 5 menit.
 */
const CACHE_MS = 5 * 60_000;
const PAGE = 1000;
const PARALLEL = 6;
/** Ukuran kotak pengelompokan, sekitar 28 km. */
const CLUSTER_DEG = 0.25;

let cache: { at: number; data: Insights } | null = null;
let inflight: Promise<Insights> | null = null;

type Row = { lat: number; lng: number; frp: number; observed_at_unix: number; concession_id: number | null };

async function fetchRows(since: number): Promise<Row[]> {
  const db = supabase();
  const { count, error } = await db.from("hotspots").select("id", { count: "exact", head: true }).gte("observed_at_unix", since);
  if (error) throw error;
  const offsets = Array.from({ length: Math.ceil((count ?? 0) / PAGE) }, (_, i) => i * PAGE);
  const rows: Row[] = [];
  for (let i = 0; i < offsets.length; i += PARALLEL) {
    const pages = await Promise.all(
      offsets.slice(i, i + PARALLEL).map(async (offset) => {
        const { data, error: pageError } = await db
          .from("hotspots")
          .select("lat,lng,frp,observed_at_unix,concession_id")
          .gte("observed_at_unix", since)
          .order("id")
          .range(offset, offset + PAGE - 1);
        if (pageError) throw pageError;
        return data as Row[];
      }),
    );
    for (const page of pages) rows.push(...page);
  }
  return rows;
}

async function compute(): Promise<Insights> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await fetchRows(now - 48 * 3600);
  const cut24 = now - 24 * 3600;

  // Provinsi dicari per kotak 0,1 derajat supaya poligon tidak diperiksa untuk setiap titik.
  const provinceCache = new Map<string, string>();
  const regionOf = (lng: number, lat: number) => {
    const key = `${Math.round(lng * 10)},${Math.round(lat * 10)}`;
    let name = provinceCache.get(key);
    if (name === undefined) {
      name = provinceOf(Math.round(lng * 10) / 10, Math.round(lat * 10) / 10) || provinceOf(lng, lat);
      provinceCache.set(key, name);
    }
    return name;
  };

  const byProvince = new Map<string, { count: number; last24: number; prev24: number }>();
  type Cluster = { count: number; last24: number; prev24: number; sumFrp24: number; maxFrp: number; inside: number; sumLat: number; sumLng: number };
  const clusters = new Map<string, Cluster>();
  let last24 = 0;

  for (const r of rows) {
    const recent = r.observed_at_unix >= cut24;
    if (recent) last24++;
    const name = regionOf(r.lng, r.lat);
    if (name) {
      const p = byProvince.get(name) ?? { count: 0, last24: 0, prev24: 0 };
      p.count++;
      if (recent) p.last24++;
      else p.prev24++;
      byProvince.set(name, p);
    }
    const key = `${Math.floor(r.lng / CLUSTER_DEG)},${Math.floor(r.lat / CLUSTER_DEG)}`;
    const c = clusters.get(key) ?? { count: 0, last24: 0, prev24: 0, sumFrp24: 0, maxFrp: 0, inside: 0, sumLat: 0, sumLng: 0 };
    c.count++;
    c.sumLat += r.lat;
    c.sumLng += r.lng;
    c.maxFrp = Math.max(c.maxFrp, r.frp);
    if (r.concession_id) c.inside++;
    if (recent) {
      c.last24++;
      c.sumFrp24 += r.frp;
    } else c.prev24++;
    clusters.set(key, c);
  }

  // Skor perhatian sederhana yang bisa dijelaskan: jumlah 24 jam terakhir, daya api total,
  // dan bobot besar untuk titik di dalam izin terdaftar.
  const urgent = [...clusters.values()]
    .filter((c) => c.last24 >= 3 || c.inside > 0)
    .map((c) => {
      const lat = c.sumLat / c.count;
      const lng = c.sumLng / c.count;
      return {
        lat,
        lng,
        province: regionOf(lng, lat),
        last24: c.last24,
        prev24: c.prev24,
        maxFrp: Math.round(c.maxFrp),
        inside: c.inside,
        // Lintasan siang mendeteksi jauh lebih banyak daripada lintasan malam, jadi "membesar" hanya
        // dihitung kalau 24 jam sebelumnya juga ada titik api. Kalau sebelumnya nol, ditandai "baru".
        isNew: c.prev24 === 0 && c.last24 >= 5,
        growing: c.prev24 >= 3 && c.last24 >= 1.5 * c.prev24,
        highFrp: c.maxFrp >= 100,
        score: c.last24 + c.sumFrp24 / 100 + c.inside * 10,
      };
    })
    // Kelompok di dalam izin terdaftar selalu di atas: itu yang langsung menjadi tanggung jawab regulator.
    .sort((a, b) => Number(b.inside > 0) - Number(a.inside > 0) || b.score - a.score)
    .slice(0, 6);

  return {
    generatedAt: now,
    total48h: rows.length,
    last24,
    prev24: rows.length - last24,
    provinces: [...byProvince.entries()]
      .map(([name, p]) => ({ name, ...p }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    clusters: urgent,
  };
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) return NextResponse.json(cache.data);
    inflight ??= compute().finally(() => {
      inflight = null;
    });
    const data = await inflight;
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    if (cache) return NextResponse.json(cache.data);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
