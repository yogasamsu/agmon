import { createClient } from "@supabase/supabase-js";

/**
 * Klien Supabase untuk API route (berjalan di server Vercel).
 * Browser tidak pernah menghubungi VPS langsung, jadi tidak ada masalah mixed content
 * dan URL VPS tidak terlihat publik.
 */
export function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL dan SUPABASE_ANON_KEY belum diisi");
  return createClient(url, key, { auth: { persistSession: false } });
}
