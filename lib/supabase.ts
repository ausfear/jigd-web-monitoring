import { createBrowserClient } from "@supabase/ssr";
import type { PostgrestError } from "@supabase/supabase-js";
import { fetchWithTimeout } from "@/lib/supabase/fetch-timeout";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createBrowserClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  { global: { fetch: fetchWithTimeout(15_000) } }
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Pesan yang ditampilkan saat database tidak bisa dihubungi (mis. proyek Supabase di-pause). */
export const DB_UNREACHABLE_MESSAGE =
  "Tidak dapat terhubung ke database. Kemungkinan proyek Supabase sedang di-pause; buka dashboard Supabase lalu klik Restore project.";

const PAGE_SIZE = 1000;

/**
 * Ambil semua baris sebuah query per halaman 1.000 baris, supaya hasilnya tidak
 * terpotong oleh batas `max_rows` proyek Supabase (default 1.000 baris per request).
 * `buildQuery` sebaiknya memakai urutan yang stabil (mis. `.order("id")`).
 */
export async function fetchAllRows<T>(
  buildQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
