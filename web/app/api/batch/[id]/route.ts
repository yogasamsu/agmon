import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
// Batch FIRMS seluruh Indonesia bisa berisi puluhan ribu baris.
export const maxDuration = 60;

const PAGE = 1000;
const PARALLEL = 6;

/**
 * Semua baris hotspot dalam satu batch, persis seperti tersimpan di Supabase.
 * Hash-nya dihitung ulang di browser, bukan di sini, supaya pengecekan tidak bergantung
 * pada server kita. Urutan baris tidak penting karena hash memakai baris yang sudah diurutkan.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = supabase();
    const { count, error: countError } = await db
      .from("hotspots")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", Number(id));
    if (countError) throw countError;

    // PostgREST membatasi 1000 baris per permintaan, jadi halaman diambil beberapa sekaligus.
    const offsets = Array.from({ length: Math.ceil((count ?? 0) / PAGE) }, (_, i) => i * PAGE);
    const rows = [];
    for (let i = 0; i < offsets.length; i += PARALLEL) {
      const pages = await Promise.all(
        offsets.slice(i, i + PARALLEL).map(async (offset) => {
          const { data, error } = await db
            .from("hotspots")
            .select("observed_at_unix,lat,lng,confidence,frp,cell")
            .eq("batch_id", Number(id))
            .order("id")
            .range(offset, offset + PAGE - 1);
          if (error) throw error;
          return data;
        }),
      );
      for (const page of pages) rows.push(...page);
    }
    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
