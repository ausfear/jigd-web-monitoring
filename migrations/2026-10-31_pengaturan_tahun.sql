-- ==============================================================================
-- Migration: Tabel pengaturan_tahun (tahun aktif)
-- Tujuan : Daftar tahun yang dipakai aplikasi (pilihan tahun di dialog Verifikasi,
--          filter tahun, kartu tahunan Overview, dan halaman Produsen) bisa diatur
--          dari tombol "Pengaturan Tahun" di Dashboard, tanpa mengubah kode.
-- Cara   : Jalankan seluruh isi file ini di Supabase Dashboard > SQL Editor.
--          Aman dijalankan ulang (idempotent).
-- Catatan: Struktur daftar_data tidak berubah. Kolom tahun_berlaku (INTEGER[])
--          sudah bisa menampung tahun berapa pun.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS pengaturan_tahun (
    tahun INTEGER PRIMARY KEY CHECK (tahun BETWEEN 2000 AND 2100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE pengaturan_tahun ENABLE ROW LEVEL SECURITY;

-- Baca: publik (halaman Overview/Produsen tanpa login). Tambah/hapus: hanya user login.
DROP POLICY IF EXISTS "Allow public read access on pengaturan_tahun" ON pengaturan_tahun;
DROP POLICY IF EXISTS "Authenticated insert on pengaturan_tahun" ON pengaturan_tahun;
DROP POLICY IF EXISTS "Authenticated delete on pengaturan_tahun" ON pengaturan_tahun;
CREATE POLICY "Allow public read access on pengaturan_tahun" ON pengaturan_tahun FOR SELECT USING (true);
CREATE POLICY "Authenticated insert on pengaturan_tahun" ON pengaturan_tahun FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete on pengaturan_tahun" ON pengaturan_tahun FOR DELETE TO authenticated USING (true);

-- Tahun aktif awal
INSERT INTO pengaturan_tahun (tahun) VALUES (2025), (2026)
ON CONFLICT (tahun) DO NOTHING;
