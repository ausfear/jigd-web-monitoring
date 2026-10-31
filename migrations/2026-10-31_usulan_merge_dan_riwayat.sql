-- ==============================================================================
-- Usulan merge dan riwayat perubahan daftar data
--
-- 1. usulan_merge: pasangan daftar data yang kemungkinan sama (misalnya hasil impor
--    tahun lain dengan nama yang sedikit berbeda). Ditinjau di Dashboard lewat
--    Pengaturan > Usulan merge. Usulan hilang sendiri bila salah satu datanya dihapus
--    (termasuk saat di-merge), atau bila ditandai "Bukan data yang sama".
-- 2. riwayat_perubahan: catatan otomatis setiap tambah, ubah, dan hapus daftar data,
--    lengkap dengan kolom yang berubah dan email petugas. Perubahan yang hanya
--    menggeser urutan tidak dicatat per baris; Dashboard menulis satu catatan ringkas.
--
-- Jalankan di Supabase SQL Editor. Aman dijalankan ulang.
-- ==============================================================================

-- 1. Usulan merge -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usulan_merge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_id UUID NOT NULL REFERENCES public.daftar_data(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.daftar_data(id) ON DELETE CASCADE,
  alasan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (data_id, target_id)
);

ALTER TABLE public.usulan_merge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read usulan_merge" ON public.usulan_merge;
DROP POLICY IF EXISTS "Authenticated insert usulan_merge" ON public.usulan_merge;
DROP POLICY IF EXISTS "Authenticated delete usulan_merge" ON public.usulan_merge;
CREATE POLICY "Authenticated read usulan_merge" ON public.usulan_merge FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert usulan_merge" ON public.usulan_merge FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete usulan_merge" ON public.usulan_merge FOR DELETE TO authenticated USING (true);

-- 2. Riwayat perubahan --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.riwayat_perubahan (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  waktu TIMESTAMPTZ NOT NULL DEFAULT now(),
  aksi TEXT NOT NULL CHECK (aksi IN ('tambah', 'ubah', 'hapus', 'urutan')),
  data_id UUID,          -- sengaja tanpa foreign key: catatan tetap ada setelah datanya dihapus
  nama_data TEXT,
  opd_id UUID,
  perubahan JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { kolom: { lama, baru } }
  pengguna TEXT DEFAULT (auth.jwt() ->> 'email'),
  pengguna_id UUID DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS idx_riwayat_perubahan_waktu ON public.riwayat_perubahan (waktu DESC);
CREATE INDEX IF NOT EXISTS idx_riwayat_perubahan_data_id ON public.riwayat_perubahan (data_id);

ALTER TABLE public.riwayat_perubahan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read riwayat_perubahan" ON public.riwayat_perubahan;
DROP POLICY IF EXISTS "Authenticated insert ringkasan urutan" ON public.riwayat_perubahan;
CREATE POLICY "Authenticated read riwayat_perubahan" ON public.riwayat_perubahan
  FOR SELECT TO authenticated USING (true);
-- Aplikasi hanya boleh menulis catatan ringkas "urutan"; sisanya ditulis trigger.
CREATE POLICY "Authenticated insert ringkasan urutan" ON public.riwayat_perubahan
  FOR INSERT TO authenticated WITH CHECK (aksi = 'urutan');

CREATE OR REPLACE FUNCTION public.catat_riwayat_daftar_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  kolom TEXT[] := ARRAY[
    'nama_data', 'opd_id', 'kugi_id', 'kugi_nama_unsur', 'tag_bidang',
    'tahun_berlaku', 'layer_utama_uuid', 'layer_pelengkap_uuids'
  ];
  k TEXT;
  lama JSONB;
  baru JSONB;
  diff JSONB := '{}'::jsonb;
  kosong JSONB[] := ARRAY['null'::jsonb, '[]'::jsonb, '""'::jsonb];
BEGIN
  IF TG_OP = 'INSERT' THEN
    baru := to_jsonb(NEW);
    FOREACH k IN ARRAY kolom LOOP
      IF NOT (baru -> k = ANY (kosong)) THEN
        diff := diff || jsonb_build_object(k, jsonb_build_object('lama', NULL, 'baru', baru -> k));
      END IF;
    END LOOP;
    INSERT INTO public.riwayat_perubahan (aksi, data_id, nama_data, opd_id, perubahan)
    VALUES ('tambah', NEW.id, NEW.nama_data, NEW.opd_id, diff);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    lama := to_jsonb(OLD);
    baru := to_jsonb(NEW);
    FOREACH k IN ARRAY kolom LOOP
      -- null dan array kosong dianggap sama
      IF COALESCE(lama -> k, 'null') IS DISTINCT FROM COALESCE(baru -> k, 'null')
         AND NOT ((lama -> k) = ANY (kosong) AND (baru -> k) = ANY (kosong)) THEN
        diff := diff || jsonb_build_object(k, jsonb_build_object('lama', lama -> k, 'baru', baru -> k));
      END IF;
    END LOOP;
    IF diff = '{}'::jsonb THEN
      RETURN NEW;  -- misalnya hanya urutan yang berubah
    END IF;
    INSERT INTO public.riwayat_perubahan (aksi, data_id, nama_data, opd_id, perubahan)
    VALUES ('ubah', NEW.id, NEW.nama_data, NEW.opd_id, diff);
    RETURN NEW;

  ELSE
    lama := to_jsonb(OLD);
    FOREACH k IN ARRAY kolom LOOP
      IF NOT (lama -> k = ANY (kosong)) THEN
        diff := diff || jsonb_build_object(k, jsonb_build_object('lama', lama -> k, 'baru', NULL));
      END IF;
    END LOOP;
    INSERT INTO public.riwayat_perubahan (aksi, data_id, nama_data, opd_id, perubahan)
    VALUES ('hapus', OLD.id, OLD.nama_data, OLD.opd_id, diff);
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_catat_riwayat_daftar_data ON public.daftar_data;
CREATE TRIGGER trg_catat_riwayat_daftar_data
  AFTER INSERT OR UPDATE OR DELETE ON public.daftar_data
  FOR EACH ROW
  EXECUTE FUNCTION public.catat_riwayat_daftar_data();
