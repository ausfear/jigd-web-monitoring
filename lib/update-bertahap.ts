import { supabase } from "@/lib/supabase";

/**
 * Perbarui banyak baris daftar_data, sepuluh sekaligus, agar tidak membanjiri Supabase.
 * Setiap baris memakai update tersendiri, sehingga trigger status dan riwayat tetap
 * mencatat per daftar data.
 */
export async function updateDaftarDataBertahap(
  rows: { id: string; patch: Record<string, unknown> }[],
  onProgress?: (done: number) => void
) {
  const UKURAN = 10;
  for (let i = 0; i < rows.length; i += UKURAN) {
    const batch = rows.slice(i, i + UKURAN);
    const results = await Promise.all(
      batch.map((r) => supabase.from("daftar_data").update(r.patch).eq("id", r.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    onProgress?.(Math.min(i + UKURAN, rows.length));
  }
}
