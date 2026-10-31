import { supabase } from "@/lib/supabase";

/** Dipakai bila tabel pengaturan_tahun belum dibuat atau masih kosong. */
export const TAHUN_DEFAULT = [2025, 2026];

/**
 * Daftar tahun aktif (urut naik) dari tabel `pengaturan_tahun`.
 * Tahun aktif dipakai untuk pilihan tahun di dialog Verifikasi, filter, Overview, dan Produsen.
 */
export async function fetchTahunAktif(): Promise<number[]> {
  const { data, error } = await supabase
    .from("pengaturan_tahun")
    .select("tahun")
    .order("tahun", { ascending: true });
  if (error || !data || data.length === 0) return TAHUN_DEFAULT;
  return data.map((row) => Number(row.tahun));
}

/** "2025 dan 2026", "2024, 2025, dan 2026" */
export function formatDaftarTahun(years: number[]): string {
  if (years.length <= 1) return years.join("");
  if (years.length === 2) return `${years[0]} dan ${years[1]}`;
  return `${years.slice(0, -1).join(", ")}, dan ${years[years.length - 1]}`;
}
