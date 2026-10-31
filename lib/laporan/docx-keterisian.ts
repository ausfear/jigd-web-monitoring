import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";

/**
 * Penyusun laporan "Tingkat Keterisian Data pada Portal JIGD" (.docx).
 *
 * Dokumen tidak dibangun dari nol: file Word contoh di `templates/laporan-keterisian.docx`
 * dipakai sebagai cetakan. Baris pertama tiap OPD dan baris lanjutan pada tabel utama
 * disalin apa adanya (font, ukuran, garis, lebar kolom, warna), lalu hanya teks, warna
 * status, dan penggabungan sel yang diganti. Judul, tanda tangan, isian SRIKANDI
 * (`${nomor_naskah}` dan seterusnya), gaya, dan font yang tertanam tidak disentuh.
 *
 * Template boleh diganti dengan laporan versi baru selama strukturnya sama: tabel utama
 * berkolom No | Perangkat Daerah | No | Daftar Data | Keterisian | Nama Layer, dan tabel
 * rekap berbaris "Terisi" / "Tidak Terisi".
 */

export interface LaporanItem {
  namaData: string;
  terisi: boolean;
  /** Judul layer di Geoportal, sudah digabung dengan ", ". */
  layer: string;
}

export interface LaporanGroup {
  namaOpd: string;
  items: LaporanItem[];
}

export interface LaporanInput {
  tahun: number;
  /** Tanggal pembaruan, ditulis "1 Oktober 2026". */
  tanggal: { year: number; month: number; day: number };
  groups: LaporanGroup[];
}

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const LABEL_TERISI = "Terpenuhi";
export const LABEL_BELUM = "Tidak Terpenuhi";

export function formatTanggalIndonesia({ year, month, day }: LaporanInput["tanggal"]): string {
  return `${day} ${BULAN[month - 1]} ${year}`;
}

export function namaFileLaporan(tanggal: LaporanInput["tanggal"]): string {
  return `Tingkat Keterisian Data pada Portal JIGD (${formatTanggalIndonesia(tanggal)}).docx`;
}

// ---------------------------------------------------------------------------
// Utilitas XML. document.xml tidak berisi tabel bersarang, jadi pencarian blok
// <w:tbl>, <w:tr>, <w:tc>, dan <w:p> cukup dengan pola non-greedy.
// ---------------------------------------------------------------------------

const RE_TABLE = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
const RE_ROW = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
const RE_CELL = /<w:tc>[\s\S]*?<\/w:tc>/g;
const RE_PARA = /<w:p[ >](?:(?!<\/w:p>)[\s\S])*<\/w:p>|<w:p\/>/g;
const RE_RUN = /<w:r[ >][\s\S]*?<\/w:r>/g;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textOf(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)) out += unescapeXml(m[1]);
  return out;
}

function cellsOf(rowXml: string): string[] {
  return rowXml.match(RE_CELL) ?? [];
}

/** Hapus id paragraf Word agar baris salinan tidak membawa id ganda. */
function stripIds(xml: string): string {
  return xml.replace(/ w14:(?:paraId|textId)="[^"]*"/g, "");
}

function runXml(rPr: string, text: string): string {
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Ganti isi sel dengan satu paragraf berisi `text`, memakai format paragraf dan huruf
 * dari paragraf pertama sel itu (run pertama, atau tanda paragraf bila sel kosong).
 */
function setCellText(cellXml: string, text: string): string {
  const paras = cellXml.match(RE_PARA) ?? [];
  const first = paras[0];
  const lastPara = paras[paras.length - 1];
  if (!first || !lastPara) throw new Error("Sel template tidak berisi paragraf.");
  const pPr = first.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const firstRun = first.match(RE_RUN)?.[0];
  const rPr =
    firstRun?.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ??
    pPr.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ??
    "";
  const para = `<w:p>${pPr}${text ? runXml(rPr, text) : ""}</w:p>`;

  const start = cellXml.indexOf(first);
  const end = cellXml.lastIndexOf(lastPara) + lastPara.length;
  return cellXml.slice(0, start) + para + cellXml.slice(end);
}

function setCellFill(cellXml: string, fill: string): string {
  return cellXml.replace(/(<w:shd\b[^>]*\bw:fill=")[^"]*(")/, (_, a: string, b: string) => a + fill + b);
}

function replaceCells(rowXml: string, edit: (cell: string, index: number) => string): string {
  let i = 0;
  return rowXml.replace(RE_CELL, (cell) => edit(cell, i++));
}

/**
 * Pada paragraf yang teksnya diawali `prefix`, pertahankan run pembentuk prefix dan
 * ganti sisanya dengan `value` (memakai format run sesudah prefix).
 */
function replaceAfterPrefix(xml: string, prefix: string, value: string): { xml: string; count: number } {
  let count = 0;
  const out = xml.replace(RE_PARA, (para) => {
    if (!textOf(para).startsWith(prefix)) return para;
    const runs = para.match(RE_RUN) ?? [];
    let consumed = "";
    let keep = 0;
    while (keep < runs.length && consumed.length < prefix.length) {
      consumed += textOf(runs[keep]);
      keep++;
    }
    if (consumed !== prefix) {
      // Prefix dan nilai lama berbagi satu run: tulis ulang run itu utuh.
      const run = runs[keep - 1];
      const rPr = run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
      const head = consumed.slice(0, consumed.length - textOf(run).length);
      count++;
      return replaceRuns(para, runs.slice(keep - 1), runXml(rPr, prefix.slice(head.length) + value));
    }
    const rest = runs.slice(keep);
    const rPr =
      (rest[0] ?? runs[keep - 1]).match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
    count++;
    if (rest.length === 0) {
      const lastRun = runs[keep - 1];
      return para.replace(lastRun, () => lastRun + runXml(rPr, value));
    }
    return replaceRuns(para, rest, runXml(rPr, value));
  });
  return { xml: out, count };
}

/** Ganti rangkaian run `runs` (berurutan di `para`) dengan `replacement`. */
function replaceRuns(para: string, runs: string[], replacement: string): string {
  const start = para.indexOf(runs[0]);
  const lastRun = runs[runs.length - 1];
  const end = para.indexOf(lastRun, start) + lastRun.length;
  return para.slice(0, start) + replacement + para.slice(end);
}

// ---------------------------------------------------------------------------
// Tinggi baris dan jarak tepi sel layer.
//
// Laporan asli diekspor dari Google Sheets, sehingga tiap baris membawa tinggi minimum
// dari Sheets (21 px untuk satu baris teks, 36 px untuk dua, dan seterusnya; 1 px = 15
// twip) dan Word menambahkan jarak tepi sel di atasnya. Sel layer yang teksnya melebihi
// lebar kolom di Sheets (terpotong, tidak di-wrap) tidak punya jarak tepi kiri-kanan.
// Aturan di bawah dikalibrasi terhadap 222 baris laporan 1 Oktober 2026: tinggi cocok
// untuk 218 baris (sisanya baris yang tingginya diatur manual) dan jarak tepi cocok semua.
// ---------------------------------------------------------------------------

/** Lebar huruf Arial (per 1000 em) untuk karakter ASCII 32–126. */
const ARIAL_WIDTH = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
/** Arial 10 pt di Sheets = 13,33 px. */
const FONT_PX = 40 / 3;
const SHEETS_WIDTH_NAMA_DATA = 306;
const SHEETS_WIDTH_STATUS = 94;
const SHEETS_WIDTH_LAYER = 212;
const SHEETS_ROW_PX = [21, 36, 52, 67];
const CELL_MARGIN_LAYER = 40;

function textWidthPx(text: string): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? ARIAL_WIDTH[code - 32] : 556;
  }
  return (units / 1000) * FONT_PX;
}

/** Jumlah baris teks bila `text` di-wrap per kata pada lebar `widthPx` (seperti Sheets). */
function wrappedLines(text: string, widthPx: number): number {
  let lines = 1;
  let current = "";
  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidthPx(candidate) <= widthPx) {
      current = candidate;
      continue;
    }
    if (current) lines++;
    current = "";
    // Kata yang lebih panjang dari kolom dipecah per huruf.
    for (const ch of word) {
      if (current && textWidthPx(current + ch) > widthPx) {
        lines++;
        current = ch;
      } else {
        current += ch;
      }
    }
  }
  return lines;
}

function sheetsRowHeight(item: LaporanItem, statusLabel: string): number {
  const lines = Math.max(
    wrappedLines(item.namaData, SHEETS_WIDTH_NAMA_DATA),
    wrappedLines(statusLabel, SHEETS_WIDTH_STATUS)
  );
  const px = SHEETS_ROW_PX[lines - 1] ?? Math.round(21 + 15.5 * (lines - 1));
  return px * 15;
}

function setRowHeight(rowXml: string, twips: number): string {
  return rowXml.replace(/(<w:trHeight\b[^>]*\bw:val=")\d+(")/, (_, a: string, b: string) => a + twips + b);
}

function setCellSideMargins(cellXml: string, twips: number): string {
  return cellXml.replace(/<w:tcMar>[\s\S]*?<\/w:tcMar>/, (mar) =>
    mar.replace(/(<w:(?:left|right) w:w=")\d+(")/g, (_, a: string, b: string) => a + twips + b)
  );
}

// ---------------------------------------------------------------------------

interface MainTableTemplate {
  tableXml: string;
  head: string; // tblPr + tblGrid + baris judul kolom
  startRow: string;
  contRow: string;
  fillTerisi: string;
  fillBelum: string;
}

function readMainTable(docXml: string): MainTableTemplate {
  const tableXml = (docXml.match(RE_TABLE) ?? []).find((t) => textOf(t).includes("Perangkat Daerah"));
  if (!tableXml) throw new Error("Tabel utama (kolom Perangkat Daerah) tidak ditemukan di template.");

  const rows = tableXml.match(RE_ROW) ?? [];
  const headRow = rows[0];
  const dataRows = rows.slice(1);
  const startRow = dataRows.find((r) => r.includes('<w:vMerge w:val="restart"/>'));
  // Baris lanjutan yang tiap selnya berisi satu paragraf (bukan sel layer yang dipecah manual).
  const contRow = dataRows.find(
    (r) => r.includes("<w:vMerge/>") && cellsOf(r).every((c) => (c.match(RE_PARA) ?? []).length === 1)
  );
  if (!headRow || !startRow || !contRow || cellsOf(startRow).length !== 6 || cellsOf(contRow).length !== 6) {
    throw new Error("Pola baris tabel utama di template tidak dikenali (butuh 6 kolom dengan sel OPD digabung).");
  }

  let fillTerisi = "B6D7A8";
  let fillBelum = "EA9999";
  for (const r of dataRows) {
    const status = cellsOf(r)[4];
    const fill = status?.match(/w:fill="([^"]+)"/)?.[1];
    if (!fill) continue;
    const label = textOf(status).trim();
    if (label === LABEL_TERISI) fillTerisi = fill;
    else if (label === LABEL_BELUM) fillBelum = fill;
  }

  const headEnd = tableXml.indexOf(headRow) + headRow.length;
  return { tableXml, head: tableXml.slice(0, headEnd), startRow, contRow, fillTerisi, fillBelum };
}

function buildMainTable(tpl: MainTableTemplate, input: LaporanInput): string {
  const head = replaceAfterPrefix(tpl.head, "Daftar Data Geospasial tahun ", String(input.tahun)).xml;

  const rows: string[] = [];
  input.groups.forEach((group, gi) => {
    group.items.forEach((item, ii) => {
      const status = item.terisi ? LABEL_TERISI : LABEL_BELUM;
      const base = setRowHeight(stripIds(ii === 0 ? tpl.startRow : tpl.contRow), sheetsRowHeight(item, status));
      rows.push(
        replaceCells(base, (cell, ci) => {
          switch (ci) {
            case 0:
              return ii === 0 ? setCellText(cell, String(gi + 1)) : cell;
            case 1:
              return ii === 0 ? setCellText(cell, group.namaOpd) : cell;
            case 2:
              return setCellText(cell, String(ii + 1));
            case 3:
              return setCellText(cell, item.namaData);
            case 4:
              return setCellFill(setCellText(cell, status), item.terisi ? tpl.fillTerisi : tpl.fillBelum);
            case 5:
              return setCellSideMargins(
                setCellText(cell, item.layer),
                textWidthPx(item.layer) > SHEETS_WIDTH_LAYER ? 0 : CELL_MARGIN_LAYER
              );
            default:
              return cell;
          }
        })
      );
    });
  });

  return head + rows.join("") + "</w:tbl>";
}

function updateSummaryTable(docXml: string, terisi: number, belum: number): string {
  let done = 0;
  const out = docXml.replace(RE_TABLE, (table) => {
    const text = textOf(table);
    if (!text.includes("Tidak Terisi") || text.includes("Perangkat Daerah")) return table;
    return table.replace(RE_ROW, (row) => {
      const cells = cellsOf(row);
      if (cells.length < 3) return row;
      const label = textOf(cells[1]).trim();
      const jumlah = label === "Terisi" ? terisi : label === "Tidak Terisi" ? belum : null;
      if (jumlah === null) return row;
      done++;
      return replaceCells(row, (cell, ci) => (ci === 2 ? setCellText(cell, `${jumlah} Data Geospasial`) : cell));
    });
  });
  if (done < 2) throw new Error("Tabel rekap (baris Terisi / Tidak Terisi) tidak ditemukan di template.");
  return out;
}

export function buildLaporanKeterisian(template: Uint8Array, input: LaporanInput): Uint8Array {
  const files = unzipSync(template);
  const docPath = "word/document.xml";
  if (!files[docPath]) throw new Error("Template bukan dokumen Word (.docx).");

  let doc = strFromU8(files[docPath]);

  const tpl = readMainTable(doc);
  doc = doc.replace(tpl.tableXml, () => buildMainTable(tpl, input));

  const items = input.groups.flatMap((g) => g.items);
  const terisi = items.filter((i) => i.terisi).length;
  doc = updateSummaryTable(doc, terisi, items.length - terisi);

  const tanggal = formatTanggalIndonesia(input.tanggal);
  for (const prefix of ["Update: ", "Samarinda, "]) {
    const result = replaceAfterPrefix(doc, prefix, tanggal);
    if (result.count === 0) throw new Error(`Baris tanggal "${prefix.trim()}" tidak ditemukan di template.`);
    doc = result.xml;
  }

  files[docPath] = strToU8(doc);

  const corePath = "docProps/core.xml";
  if (files[corePath]) {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    files[corePath] = strToU8(
      strFromU8(files[corePath]).replace(
        /(<dcterms:modified\b[^>]*>)[^<]*(<\/dcterms:modified>)/,
        `$1${now}$2`
      )
    );
  }

  // Urutan entri dipertahankan ([Content_Types].xml tetap di depan).
  const out: Zippable = {};
  for (const [name, data] of Object.entries(files)) out[name] = [data, { level: 6 }];
  return zipSync(out);
}
