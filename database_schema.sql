-- ==============================================================================
-- Schema: JIGD (Jaringan Informasi Geospasial Daerah) Provinsi Kalimantan Timur
-- Database: PostgreSQL (Supabase)
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Table: master_opd
-- Menyimpan daftar Organisasi Perangkat Daerah (OPD) produsen data
CREATE TABLE IF NOT EXISTS master_opd (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_opd TEXT NOT NULL,
    username_jigd TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Table: master_kugi
-- Menyimpan standar Katalog Unsur Geografi Indonesia (KUGI)
CREATE TABLE IF NOT EXISTS master_kugi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    katalog_unsur TEXT,
    nama_unsur TEXT,
    alias TEXT,
    kode_unsur TEXT UNIQUE,
    definisi TEXT,
    sumber_definisi TEXT,
    instansi_terkait TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Table: cache_layer_geoportal
-- Caching data layer dari GeoNode API Simpul Jaringan JIGD
CREATE TABLE IF NOT EXISTS cache_layer_geoportal (
    id_dataset TEXT PRIMARY KEY,
    uuid TEXT,
    title TEXT,
    name TEXT,
    owner_username TEXT,
    owner_name TEXT,
    date_published TEXT,
    dataset_url TEXT,
    srid TEXT,
    geometry_type TEXT,
    attribute_count INTEGER,
    last_updated TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Table: daftar_data
-- Menyimpan daftar data geospasial tematik / dasar beserta status keterisiannya
CREATE TABLE IF NOT EXISTS daftar_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opd_id UUID REFERENCES master_opd(id) ON DELETE CASCADE,
    kugi_id UUID REFERENCES master_kugi(id) ON DELETE SET NULL,
    kugi_nama_unsur TEXT,
    nama_data TEXT NOT NULL,
    tahun_berlaku INTEGER[] DEFAULT '{}',
    layer_utama_uuid TEXT,
    layer_pelengkap_uuids TEXT[] DEFAULT '{}',
    status_keterisian BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daftar_data_opd_id ON daftar_data(opd_id);
CREATE INDEX IF NOT EXISTS idx_daftar_data_kugi_id ON daftar_data(kugi_id);
CREATE INDEX IF NOT EXISTS idx_daftar_data_layer_utama_uuid ON daftar_data(layer_utama_uuid);
CREATE INDEX IF NOT EXISTS idx_daftar_data_status_keterisian ON daftar_data(status_keterisian);
CREATE INDEX IF NOT EXISTS idx_cache_layer_uuid ON cache_layer_geoportal(uuid);
CREATE INDEX IF NOT EXISTS idx_cache_layer_owner_username ON cache_layer_geoportal(owner_username);
CREATE INDEX IF NOT EXISTS idx_master_opd_username_jigd ON master_opd(username_jigd);

-- Enable Row Level Security (RLS)
ALTER TABLE master_opd ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_kugi ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_layer_geoportal ENABLE ROW LEVEL SECURITY;
ALTER TABLE daftar_data ENABLE ROW LEVEL SECURITY;

-- Allow public read access (adjust policies as needed for auth/role management)
CREATE POLICY "Allow public read access on master_opd" ON master_opd FOR SELECT USING (true);
CREATE POLICY "Allow public read access on master_kugi" ON master_kugi FOR SELECT USING (true);
CREATE POLICY "Allow public read access on cache_layer_geoportal" ON cache_layer_geoportal FOR SELECT USING (true);
CREATE POLICY "Allow public read access on daftar_data" ON daftar_data FOR SELECT USING (true);

-- Allow all actions for prototyping / sync scripts
CREATE POLICY "Allow public insert on master_opd" ON master_opd FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on master_opd" ON master_opd FOR UPDATE USING (true);

CREATE POLICY "Allow public insert on master_kugi" ON master_kugi FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on master_kugi" ON master_kugi FOR UPDATE USING (true);

CREATE POLICY "Allow public insert on cache_layer_geoportal" ON cache_layer_geoportal FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on cache_layer_geoportal" ON cache_layer_geoportal FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on cache_layer_geoportal" ON cache_layer_geoportal FOR DELETE USING (true);

CREATE POLICY "Allow public insert on daftar_data" ON daftar_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on daftar_data" ON daftar_data FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on daftar_data" ON daftar_data FOR DELETE USING (true);
