import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Semua baris hotspot dalam satu batch, persis seperti tersimpan di Supabase.
 * Hash-nya dihitung ulang di browser, bukan di sini, supaya pengecekan tidak bergantung
 * pada server kita.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = supabase();
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from("hotspots")
        .select("observed_at_unix,lat,lng,confidence,frp,cell")
        .eq("batch_id", Number(id))
        .order("id")
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
