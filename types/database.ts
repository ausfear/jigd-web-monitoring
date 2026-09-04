/**
 * TypeScript Type Definitions for JIGD Provinsi Kalimantan Timur
 * Reflecting Supabase PostgreSQL Tables & GeoNode Cache Integration
 */

export interface MasterOpd {
  id: string;
  nama_opd: string;
  username_jigd: string | null;
  created_at: string;
}

export interface MasterKugi {
  id: string;
  katalog_unsur?: string | null;
  nama_unsur?: string | null;
  alias?: string | null;
  kode_unsur: string;
  definisi?: string | null;
  sumber_definisi?: string | null;
  instansi_terkait?: string | null;
  created_at?: string;
}

export interface CacheLayerGeoportal {
  id_dataset: string;
  uuid: string;
  title: string;
  name: string;
  owner_username: string;
  owner_name: string;
  date_published: string;
  dataset_url: string;
  srid: string;
  geometry_type: string;
  attribute_count: number;
  last_updated: string;
  created_at?: string;
}

export interface DaftarData {
  id: string;
  opd_id: string;
  kugi_id: string | null;
  kugi_nama_unsur?: string | null;
  nama_data: string;
  tag_bidang?: string | null;
  tahun_berlaku: number[];
  layer_utama_uuid: string | null;
  layer_pelengkap_uuids: string[];
  status_keterisian: boolean;
  created_at: string;

  // Joined relations for queries and UI presentation
  master_opd?: MasterOpd;
  master_kugi?: MasterKugi | null;
  layer_utama?: CacheLayerGeoportal | null;
  layer_pelengkap?: CacheLayerGeoportal[];
}

/**
 * GeoNode API Response structure mapping
 */
export interface GeoNodeLayerItem {
  pk: number | string;
  uuid: string;
  title: string;
  name: string;
  owner?: {
    username: string;
    first_name?: string;
    last_name?: string;
  };
  date?: string;
  detail_url?: string;
  srid?: string;
  subtype?: string;
  attributes_count?: number;
  last_updated?: string;
}

export interface GeoNodeApiResponse {
  total: number;
  objects: GeoNodeLayerItem[];
}
