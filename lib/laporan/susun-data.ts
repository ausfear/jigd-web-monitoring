import type { LaporanGroup } from "./docx-keterisian";

/** Kolom daftar_data yang dibutuhkan laporan. */
export interface BarisDaftarData {
  opd_id: string | null;
  nama_data: string;
  urutan: number | null;
  tahun_berlaku: number[] | null;
  status_keterisian: boolean;
  layer_utama_uuid: string | null;
  layer_pelengkap_uuids: string[] | null;
  created_at: string | null;
  /** Relasi ke master_opd; tipe hasil parser Supabase bisa berupa array satu elemen. */
  master_opd?: OpdRingkas | OpdRingkas[] | null;
}

type OpdRingkas = { nama_opd: string | null };

export interface LayerRingkas {
  uuid: string | null;
  title: string | null;
  name: string | null;
}

/**
 * Susun daftar data satu tahun menjadi kelompok per OPD, dengan urutan yang sama seperti
 * tabel Verifikasi: menurut `urutan` (nomor di sheet Daftar Data), yang tanpa nomor di
 * belakang. OPD diurutkan menurut kemunculan pertamanya. Kolom layer berisi judul layer
 * utama lalu layer pelengkap, digabung dengan koma.
 */
export function susunGroupLaporan(
  rows: BarisDaftarData[],
  layers: LayerRingkas[],
  tahun: number
): LaporanGroup[] {
  const judulLayer = new Map<string, string>();
  for (const l of layers) {
    if (l.uuid) judulLayer.set(l.uuid, (l.title || l.name || "").trim());
  }

  const terpilih = rows
    .filter((r) => Array.isArray(r.tahun_berlaku) && r.tahun_berlaku.includes(tahun))
    .sort((a, b) => {
      const ua = a.urutan ?? Number.POSITIVE_INFINITY;
      const ub = b.urutan ?? Number.POSITIVE_INFINITY;
      if (ua !== ub) return ua - ub;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

  const groups = new Map<string, LaporanGroup>();
  for (const r of terpilih) {
    const key = r.opd_id ?? "-";
    let group = groups.get(key);
    if (!group) {
      const opd = Array.isArray(r.master_opd) ? r.master_opd[0] : r.master_opd;
      group = { namaOpd: (opd?.nama_opd || "-").trim(), items: [] };
      groups.set(key, group);
    }

    const uuids = [r.layer_utama_uuid, ...(r.layer_pelengkap_uuids ?? [])].filter(
      (u): u is string => Boolean(u)
    );
    const judul = [...new Set(uuids)]
      .map((u) => judulLayer.get(u))
      .filter((t): t is string => Boolean(t));

    group.items.push({
      namaData: r.nama_data.trim(),
      terisi: r.status_keterisian,
      layer: [...new Set(judul)].join(", "),
    });
  }

  return [...groups.values()];
}
