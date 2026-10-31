/**
 * Saran layer untuk sebuah daftar data: cari layer milik OPD yang judul atau nama
 * teknisnya memuat kata-kata penting dari nama data.
 *
 * Nama layer GeoNode sering ditulis tanpa spasi ("sebaranpengelolaansampah50k_pt"),
 * jadi kata dicari sebagai potongan teks, bukan dicocokkan per kata.
 */

/** Kata umum yang tidak membedakan satu data dengan data lain. */
const KATA_UMUM = new Set([
  "peta", "sebaran", "lokasi", "data", "dan", "di", "dari", "yang", "untuk", "dengan", "pada", "atau",
  "prov", "provinsi", "kaltim", "kalimantan", "timur", "skala", "tahun", "titik", "poligon", "garis",
  "kab", "kabupaten", "kota", "wilayah", "kawasan", "terhadap", "telah", "sebagai", "dalam", "oleh",
  "milik", "bagi", "antar", "serta",
]);

export interface LayerKandidat {
  uuid: string | null;
  title: string | null;
  name: string | null;
}

export interface SaranLayer<T extends LayerKandidat> {
  layer: T;
  /** 0–1: bagian kata penting nama data yang ditemukan di judul/nama layer. */
  skor: number;
}

function rapikan(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** Kata penting dari nama data: tanpa kata umum, angka, dan kata sangat pendek. */
export function kataPenting(namaData: string): string[] {
  const kata = rapikan(namaData)
    .split(/[^a-z0-9]+/)
    .filter((k) => k.length >= 3 && !KATA_UMUM.has(k) && !/^\d+k?$/.test(k));
  return [...new Set(kata)];
}

/** Bentuk dasar sederhana: buang awalan/akhiran yang sering berbeda antara nama data dan layer. */
function akar(kata: string): string {
  return kata.replace(/^(pe[mn]?|per|ke|ber|di)(?=[a-z]{5,})/, "").replace(/(an|kan|nya)$/, "");
}

export function sarankanLayer<T extends LayerKandidat>(
  namaData: string,
  layers: T[],
  { batas = 3, skorMinimum = 0.4 }: { batas?: number; skorMinimum?: number } = {}
): SaranLayer<T>[] {
  const kata = kataPenting(namaData);
  if (kata.length === 0) return [];

  const hasil: SaranLayer<T>[] = [];
  for (const layer of layers) {
    if (!layer.uuid) continue;
    const teks = rapikan(`${layer.title ?? ""} ${layer.name ?? ""}`);
    const teksRapat = teks.replace(/[^a-z0-9]+/g, "");
    let cocok = 0;
    for (const k of kata) {
      if (teks.includes(k) || teksRapat.includes(k)) cocok += 1;
      else if (akar(k).length >= 4 && teksRapat.includes(akar(k))) cocok += 0.75;
    }
    const skor = cocok / kata.length;
    if (skor >= skorMinimum) hasil.push({ layer, skor });
  }

  // Skor tertinggi dulu; bila seri, judul yang lebih pendek (lebih spesifik) dulu.
  hasil.sort(
    (a, b) => b.skor - a.skor || (a.layer.title ?? "").length - (b.layer.title ?? "").length
  );
  return hasil.slice(0, batas);
}
