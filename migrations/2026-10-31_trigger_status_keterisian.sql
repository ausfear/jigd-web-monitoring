-- ==============================================================================
-- status_keterisian selalu mengikuti Layer Utama (CATATAN_AUDIT 4.5, kasus 1)
--
-- "Terisi" artinya daftar data sudah punya Layer Utama. Aplikasi selalu mengisi keduanya
-- bersamaan, tetapi perubahan langsung lewat Table Editor / SQL bisa membuatnya tidak
-- sinkron. Trigger ini menghitung ulang status pada setiap INSERT dan UPDATE, sehingga
-- nilai status_keterisian yang dikirim apa pun akan diabaikan.
--
-- Jalankan sekali di Supabase SQL Editor. Aman dijalankan ulang.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sinkron_status_keterisian()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- UUID kosong ("") diperlakukan sama dengan tidak ada layer.
  NEW.layer_utama_uuid := NULLIF(btrim(NEW.layer_utama_uuid), '');
  NEW.status_keterisian := NEW.layer_utama_uuid IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sinkron_status_keterisian ON public.daftar_data;
CREATE TRIGGER trg_sinkron_status_keterisian
  BEFORE INSERT OR UPDATE ON public.daftar_data
  FOR EACH ROW
  EXECUTE FUNCTION public.sinkron_status_keterisian();

-- Rapikan baris lama yang sudah terlanjur tidak sinkron (trigger di atas ikut berjalan).
UPDATE public.daftar_data
SET layer_utama_uuid = layer_utama_uuid
WHERE status_keterisian IS DISTINCT FROM (NULLIF(btrim(layer_utama_uuid), '') IS NOT NULL)
   OR layer_utama_uuid = '';

-- Cek: hasilnya harus 0.
SELECT count(*) AS baris_tidak_sinkron
FROM public.daftar_data
WHERE status_keterisian IS DISTINCT FROM (layer_utama_uuid IS NOT NULL);
