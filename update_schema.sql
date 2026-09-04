-- ==============================================================================
-- Migration: Update Schema for JIGD Web-Based Monitoring
-- GeoNode API Caching & Standardized KUGI Integration
-- ==============================================================================

-- 1. Create master_kugi table
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

-- 2. Alter master_opd table: Add username_jigd
ALTER TABLE master_opd 
ADD COLUMN IF NOT EXISTS username_jigd TEXT UNIQUE;

-- 3. Create cache_layer_geoportal table
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

-- 4. Alter daftar_data table: Drop obsolete columns and add new foreign key & layer UUIDs
ALTER TABLE daftar_data 
DROP COLUMN IF EXISTS kugi,
DROP COLUMN IF EXISTS fcode,
DROP COLUMN IF EXISTS nama_layer_geoportal;

ALTER TABLE daftar_data 
ADD COLUMN IF NOT EXISTS kugi_id UUID REFERENCES master_kugi(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS layer_utama_uuid TEXT,
ADD COLUMN IF NOT EXISTS layer_pelengkap_uuids TEXT[] DEFAULT '{}';

-- 5. Indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_daftar_data_kugi_id ON daftar_data(kugi_id);
CREATE INDEX IF NOT EXISTS idx_daftar_data_layer_utama_uuid ON daftar_data(layer_utama_uuid);
CREATE INDEX IF NOT EXISTS idx_cache_layer_uuid ON cache_layer_geoportal(uuid);
CREATE INDEX IF NOT EXISTS idx_cache_layer_owner_username ON cache_layer_geoportal(owner_username);
CREATE INDEX IF NOT EXISTS idx_master_opd_username_jigd ON master_opd(username_jigd);

-- 6. Enable Row Level Security (RLS) for newly created tables
ALTER TABLE master_kugi ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_layer_geoportal ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "Allow public read access on master_kugi" 
ON master_kugi FOR SELECT USING (true);

CREATE POLICY "Allow public read access on cache_layer_geoportal" 
ON cache_layer_geoportal FOR SELECT USING (true);

-- Insert/Update/Delete policies for prototyping & sync routines
CREATE POLICY "Allow public insert on master_kugi" 
ON master_kugi FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on master_kugi" 
ON master_kugi FOR UPDATE USING (true);

CREATE POLICY "Allow public insert on cache_layer_geoportal" 
ON cache_layer_geoportal FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on cache_layer_geoportal" 
ON cache_layer_geoportal FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on cache_layer_geoportal" 
ON cache_layer_geoportal FOR DELETE USING (true);
