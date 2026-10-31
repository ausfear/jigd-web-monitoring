-- ==============================================================================
-- Batasi operasi tulis hanya untuk user yang login (sudah dijalankan 2026-10-31)
-- ------------------------------------------------------------------------------
-- Masalah: policy saat ini mengizinkan INSERT/UPDATE/DELETE untuk role anon.
-- Anon key ikut terkirim ke browser, sehingga siapa pun bisa mengubah/menghapus
-- data lewat REST API Supabase tanpa login (proteksi /dashboard hanya di UI).
--
-- Prasyarat: aplikasi versi ini (route /api/sync-jigd sudah memakai sesi login).
-- Baca publik (SELECT) tetap dibiarkan terbuka untuk halaman Overview/Produsen/Datasets.
-- Jalankan di Supabase Dashboard > SQL Editor.
-- ==============================================================================

-- master_opd
DROP POLICY IF EXISTS "Allow public insert on master_opd" ON master_opd;
DROP POLICY IF EXISTS "Allow public update on master_opd" ON master_opd;
CREATE POLICY "Authenticated insert on master_opd" ON master_opd FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update on master_opd" ON master_opd FOR UPDATE TO authenticated USING (true);

-- master_kugi
DROP POLICY IF EXISTS "Allow public insert on master_kugi" ON master_kugi;
DROP POLICY IF EXISTS "Allow public update on master_kugi" ON master_kugi;
CREATE POLICY "Authenticated insert on master_kugi" ON master_kugi FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update on master_kugi" ON master_kugi FOR UPDATE TO authenticated USING (true);

-- cache_layer_geoportal
DROP POLICY IF EXISTS "Allow public insert on cache_layer_geoportal" ON cache_layer_geoportal;
DROP POLICY IF EXISTS "Allow public update on cache_layer_geoportal" ON cache_layer_geoportal;
DROP POLICY IF EXISTS "Allow public delete on cache_layer_geoportal" ON cache_layer_geoportal;
CREATE POLICY "Authenticated insert on cache_layer_geoportal" ON cache_layer_geoportal FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update on cache_layer_geoportal" ON cache_layer_geoportal FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete on cache_layer_geoportal" ON cache_layer_geoportal FOR DELETE TO authenticated USING (true);

-- daftar_data
DROP POLICY IF EXISTS "Allow public insert on daftar_data" ON daftar_data;
DROP POLICY IF EXISTS "Allow public update on daftar_data" ON daftar_data;
DROP POLICY IF EXISTS "Allow public delete on daftar_data" ON daftar_data;
CREATE POLICY "Authenticated insert on daftar_data" ON daftar_data FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update on daftar_data" ON daftar_data FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete on daftar_data" ON daftar_data FOR DELETE TO authenticated USING (true);
