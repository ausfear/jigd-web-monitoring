-- ==============================================================================
-- Log sinkronisasi JIGD
--
-- Setiap sinkronisasi (tombol "Sinkronisasi JIGD" maupun jadwal otomatis GitHub Actions)
-- dicatat di sini, berhasil atau gagal. Halaman web menampilkan waktu sinkronisasi berhasil
-- terakhir lewat fungsi waktu_sinkron_terakhir(), yang boleh dibaca publik tanpa membuka
-- isi tabel (misalnya email petugas).
--
-- Jalankan di Supabase SQL Editor. Aman dijalankan ulang.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.log_sinkronisasi (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mulai TIMESTAMPTZ NOT NULL,
  selesai TIMESTAMPTZ NOT NULL DEFAULT now(),
  sumber TEXT NOT NULL CHECK (sumber IN ('manual', 'terjadwal')),
  berhasil BOOLEAN NOT NULL,
  jumlah_layer INTEGER,
  layer_dihapus INTEGER,
  opd_baru INTEGER,
  data_terdampak INTEGER,   -- daftar data yang merujuk layer yang baru dihapus
  pesan TEXT,               -- pesan error bila gagal
  pengguna TEXT DEFAULT (auth.jwt() ->> 'email')
);
CREATE INDEX IF NOT EXISTS idx_log_sinkronisasi_selesai ON public.log_sinkronisasi (selesai DESC);

ALTER TABLE public.log_sinkronisasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read log_sinkronisasi" ON public.log_sinkronisasi;
DROP POLICY IF EXISTS "Authenticated insert log sinkron manual" ON public.log_sinkronisasi;
CREATE POLICY "Authenticated read log_sinkronisasi" ON public.log_sinkronisasi
  FOR SELECT TO authenticated USING (true);
-- Petugas hanya bisa mencatat sinkronisasi manual; jadwal otomatis memakai service role key.
CREATE POLICY "Authenticated insert log sinkron manual" ON public.log_sinkronisasi
  FOR INSERT TO authenticated WITH CHECK (sumber = 'manual');

-- Waktu sinkronisasi berhasil terakhir, untuk ditampilkan ke semua pengunjung.
CREATE OR REPLACE FUNCTION public.waktu_sinkron_terakhir()
RETURNS TABLE (selesai TIMESTAMPTZ, sumber TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT l.selesai, l.sumber
  FROM public.log_sinkronisasi AS l
  WHERE l.berhasil
  ORDER BY l.selesai DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.waktu_sinkron_terakhir() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waktu_sinkron_terakhir() TO anon, authenticated;
