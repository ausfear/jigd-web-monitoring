# Catatan Audit — Web Monitoring JIGD Kaltim

Tanggal audit: 31 Oktober 2026

Isi catatan:

1. Perbaikan kode yang sudah diterapkan
2. Pembaruan data dari `Keterisian JIGD 2026.xlsx` dan bagian yang perlu dicek manual
3. Urutan daftar data sesuai Excel (perlu 1 langkah di Supabase)
4. Saran perbaikan, diurutkan dari yang paling penting
5. Saran pengembangan

---

## 1. Perbaikan kode yang sudah diterapkan

| # | Berkas | Masalah | Perbaikan |
|---|---|---|---|
| 1 | `app/api/sync-jigd/route.ts` | Sinkronisasi hanya melakukan *upsert*. Layer yang dihapus atau di-upload ulang di GeoNode tetap tersimpan di cache. Akibatnya cache berisi 480 layer padahal GeoNode hanya 455, kartu "Total Dataset JIGD" ikut membengkak, dan layer yang sudah hilang masih bisa dipilih sebagai Layer Utama. | Setelah upsert, layer yang tidak ada lagi di GeoNode dihapus dari cache. Penghapusan hanya terjadi bila daftar dari GeoNode lengkap (`meta.total_count`), supaya respons yang terpotong tidak mengosongkan cache. Jumlah layer yang dihapus ditampilkan di banner sinkronisasi. |
| 2 | `app/api/sync-jigd/route.ts` | Endpoint `/api/sync-jigd` bisa dipanggil siapa saja tanpa login dan langsung menulis ke database. | Endpoint memakai sesi login pengguna (`lib/supabase/server.ts`) dan mengembalikan 401 bila tidak login. Tombol sinkronisasi hanya ada di `/dashboard` yang memang wajib login, jadi alur aplikasi tidak berubah. |
| 3 | `middleware.ts` → `proxy.ts` | Konvensi `middleware` sudah *deprecated* di Next.js 16 dan memunculkan peringatan di dev server. | Berkas dan fungsinya diganti nama menjadi `proxy` sesuai panduan resmi. Perilakunya sama: `/dashboard` tetap dialihkan ke `/login`. |
| 4 | `components/dashboard/csv-upload-dialog.tsx` | Jika header CSV adalah `Produsen Data, Nama Data`, kolom "Produsen Data" ikut terdeteksi sebagai kolom nama data karena mengandung kata "data", sehingga impor gagal. | Header produsen dikecualikan saat mencari kolom nama data. |
| 5 | `lib/fuzzy-matcher.ts` | Produsen yang hanya berisi tanda baca (mis. `-`) dinormalisasi menjadi string kosong, lalu cocok ke OPD pertama dengan skor 0,95 dan diberi label "Otomatis". | Query kosong mengembalikan skor 0, sehingga produsen tersebut wajib dipetakan manual. |
| 6 | `components/dashboard/merge-data-dialog.tsx` | Tombol "Batal" tidak me-reset pilihan data target, sehingga pilihan lama terbawa ke dialog berikutnya. | Pilihan target di-reset saat dialog dibatalkan. |
| 7 | `app/dashboard/page.tsx`, `types/database.ts` | Tidak ada cara mengurutkan sesuai Excel. | Data diurutkan berdasarkan kolom `urutan` (lihat bagian 3). |
| 8 | `database_schema.sql` | Kolom `tag_bidang` dipakai aplikasi tetapi tidak tercantum di skema. | Kolom `tag_bidang` dan `urutan` ditambahkan ke skema. |

Hasil verifikasi: `tsc --noEmit` bersih. Jumlah temuan ESLint pada berkas yang diubah sama dengan sebelum perubahan; semua error lint adalah error lama (lihat 4.6). Semua halaman merespons 200 di dev server, `/dashboard` tetap dialihkan ke login, dan `/api/sync-jigd` tanpa login mengembalikan 401.

> Belum teruji: sinkronisasi dalam keadaan login (saya tidak punya akun). Silakan klik **Sinkronisasi GeoNode** sekali setelah login untuk memastikan.

---

## 2. Pembaruan data Daftar Data 2026 dari Excel

Sumber: sheet **Daftar Data 2026** (222 baris), dicocokkan dengan 222 baris `daftar_data` di Supabase.

Sebelum pembaruan:

- Backup lengkap keempat tabel ada di `backups/supabase_sebelum_update_2026-10-31.json`. Jangan di-commit ke git; file ini berisi seluruh data.
- Cache layer disinkronkan ulang karena cache lama berhenti di dataset #737, padahal Excel merujuk sampai #772.

### Hasil

| Indikator | Sebelum | Sesudah |
|---|---|---|
| Baris dengan Nama Unsur KUGI | 5 | **197**, sama dengan jumlah baris Excel yang kolom KUGI-nya terisi |
| Baris dengan Kode Unsur KUGI (Langkah 2) | 1 | 9 |
| Baris Terisi dengan Layer Utama | 4 | **135** dari 137 baris "Terisi" di Excel |
| Status keterisian yang tidak cocok dengan keberadaan layer | – | 0 |

### Aturan pencocokan

- **Baris**: dicocokkan per OPD berdasarkan nama data. 14 baris namanya sudah diedit di aplikasi, jadi dipasangkan berdasarkan kemiripan teks dalam OPD yang sama. Contoh: "Peta Rencana Drainase" ↔ "Peta Rencana Drainsae", "Peta Sebaran Rumah Layak Huni" ↔ "Peta Sebaran Rumah **Tidak** Layak Huni". Nama data di aplikasi tidak diubah.
- **KUGI**: kolom "Standar Data (KUGI)" disimpan sebagai Nama Unsur. Kode Unsur diisi otomatis hanya jika:
  - kolom `fcode` di Excel terisi (1 baris), atau
  - nama unsur tersebut hanya punya satu kode di master KUGI (8 baris).

  Sisanya (188 baris) tampil sebagai "Kode belum ditentukan", karena satu nama unsur bisa punya hingga 7–8 kode. Kode-kode itu hanya berbeda di digit ke-5–6 yang tampaknya adalah kode skala (lihat 5.1).
- **Layer**: dibaca dari URL dataset di kolom "URL". Layer pertama menjadi Layer Utama, sisanya menjadi Layer Pelengkap. Baris yang sudah punya Layer Utama hasil verifikasi manual **tidak ditimpa** (4 baris).
- Baris Excel yang kolom KUGI-nya kosong tidak mengubah KUGI yang sudah ada di aplikasi.

### Perlu dicek manual

**a. KUGI hasil isian manual di aplikasi yang ditimpa oleh Excel** (nilai lama ada di backup):

| Data | Sebelumnya (aplikasi) | Sekarang (Excel) |
|---|---|---|
| Peta Daerah Irigasi Rawa skala 1:5.000 | IRIGASI_LN | DAERAHIRIGASI_AR |
| Peta Daerah Irigasi Permukaan skala 1:5.000 | IRIGASI_LN (DA02050040) | DAERAHIRIGASI_AR (kode dikosongkan) |
| Peta Sebaran Internet Desa | MENARATELEPON_PT | ADMINISTRASI_AR |

**b. Excel menyebut "Terisi", tetapi layernya sudah tidak ada di GeoNode dan tidak ada pengganti yang jelas.** Status di aplikasi menjadi *Belum Terisi*. Silakan pilih layernya lewat **Aksi → Verifikasi Data**.

| Baris Excel | Data | Layer di Excel (sudah terhapus) |
|---|---|---|
| 77 | Lokasi pengambilan sampel pemantauan kualitas lingkungan hidup (DLH) | #496 `titik_ikal_beserta_data` |
| 171 | Peta Jalan Provinsi (DPUPR) | #644 `jalanprovinsi2023_ln`. Kandidat: #381 `jalan_provinsi_2023` |

**c. Layer di Excel sudah terhapus, lalu diganti otomatis dengan versi upload ulang** (judul sama atau jelas setara). Mohon dicek sekilas:

| Baris | Data | Excel → Sekarang |
|---|---|---|
| 151 | Jaringan Irigasi Teknis Primer & Sekunder | #575 (terhapus) dibuang; tetap #572, #570 |
| 152 | Daerah Irigasi Teknis Primer & Sekunder | #574, #569 (terhapus) dibuang; tetap #573, #571 |
| 173 | Titik Rawan Longsor Jalan Provinsi | #717 → #739 (nama layer sama, di-upload ulang) |
| 213 | Sebaran Desa Berlistrik PLN dan Non-PLN | #43, #467 → #758 |
| 215 | Potensi warisan geologi | #459 → #771 (2025) + #772 (2026) |
| 216 | Kualitas air tanah sebagai air baku | #463 → #770, #453 → #764 |
| 218 | Sumber Daya Panas Bumi | #450, #656 → #761 (2025) + #762 (2026) |
| 219 | Pembangkit listrik Non PLN | #452 → #708 |
| 221 | Zona Konservasi Air Tanah | #470 → #759 (2025) |

Sheet Excel sebaiknya ikut diperbarui untuk baris-baris di atas.

**d. 25 baris Excel tanpa KUGI.** Kolom "Standar Data (KUGI)" kosong, jadi di aplikasi tetap "Belum dipetakan":

| Baris | OPD | Data |
|---|---|---|
| 29 | Bapenda | Peta Sebaran Mitra Kerja Sama SAMSAT |
| 45 | DKP | Peta Wilayah Penangkapan 0-12 Mil Laut |
| 46 | DKP | Peta Perairan Umum |
| 53 | DKP | Peta Jalur Penangkapan dan Penempatan Alat Penangkapan Ikan |
| 54 | DKP | Peta Daerah Penangkapan Ikan di Jalur Penangkapan Ikan |
| 59 | DKP | Peta Alur Migrasi Biota Laut |
| 60 | DPKH | Peta Lokasi Kelompok Tani Peternakan |
| 69, 70, 73, 76, 78, 81, 82 | DLH | DDDTLH, Sampah Laut, Kualitas Udara, Daya dukung daya tampung, Jasa LH Pengatur Air, Sengketa LH (2 data) |
| 97 | Disperindagkop | Peta Wilayah Pusat Pertumbuhan Industri |
| 114 | DPMPD | Peta Sebaran Posyantek |
| 123, 124, 130, 146 | Disdikbud | Gedung Kesenian, Lembaga Kesenian, Objek Pemajuan Kebudayaan, Sarana Seni dan Budaya |
| 207, 208 | Dishub | Rambu Jalan, Pagar Pengaman Jalan di Jalan Provinsi |
| 215, 220, 223 | DESDM | Potensi warisan geologi, Wilayah Pertambangan Rakyat, Delineasi Geopark |

---

## 3. Urutan daftar data sesuai Excel

Kode aplikasi sudah mengurutkan tabel Verifikasi berdasarkan kolom `urutan`: nomor global 1–222 mengikuti urutan baris di Excel, sehingga OPD dan nomor data di dalam OPD ikut terurut. Contoh: filter OPD Biro Pemotda akan menampilkan data no. 1–5 sesuai Excel. Data yang ditambahkan belakangan (tanpa `urutan`) tampil paling akhir, yang terbaru di atas.

**Status:** migrasi `migrations/2026-10-31_urutan_daftar_data.sql` sudah dijalankan pada 2026-10-31. Seluruh 222 baris sudah memiliki `urutan`.

---

## 4. Saran perbaikan (prioritas tinggi → rendah)

### 4.1 [KRITIS] Siapa pun bisa mengubah atau menghapus data tanpa login: **SELESAI**

Policy RLS dulu mengizinkan INSERT/UPDATE/DELETE untuk role **anon**. Anon key memang dikirim ke browser, jadi siapa pun bisa memanggil REST API Supabase dan menghapus data.

`migrations/OPSIONAL_rls_hanya_user_login.sql` sudah dijalankan. Hasilnya sudah dicek:
- update dan insert tanpa login ditolak;
- akses baca publik tetap terbuka.

`database_schema.sql` juga sudah diperbarui dengan policy yang sama.

### 4.2 Sinkronisasi menimpa nama OPD: **SELESAI**

Sinkronisasi sekarang hanya **menambahkan OPD baru**, yaitu username GeoNode yang belum ada di `master_opd`. Nama OPD yang sudah ada tidak lagi diubah. Jumlah OPD baru ditampilkan di pesan hasil sinkronisasi.

### 4.3 Batas 1.000 dataset: **SELESAI**

- **GeoNode** (`/api/datasets/` dan `/api/owners/`): diambil per halaman (limit/offset) sampai `meta.total_count` terpenuhi. Jumlah halaman tetap 1 selama dataset ≤ 1.000. Sudah diuji 455/455, juga saat dipaksa per 200.
- **Supabase**: tabel yang bisa besar (`cache_layer_geoportal`, `master_kugi`, `daftar_data`) diambil per 1.000 baris lewat `fetchAllRows()` di `lib/supabase.ts`. Hasilnya tidak terpotong walaupun `max_rows` proyek dikembalikan ke default.

### 4.4 Tahun masih di-hardcode 2024–2026: **SELESAI**

Ada tombol baru **Pengaturan Tahun** di Dashboard untuk menambah atau menonaktifkan tahun. Tahun aktif dipakai di:
- tombol Tahun Berlaku pada dialog Verifikasi;
- filter tahun;
- kartu tahunan di Overview;
- pilihan tahun di Produsen;
- tahun bawaan pada dialog Tambah Data dan Upload CSV.

Menonaktifkan tahun **tidak menghapus data**. Filter tahun di Dashboard tetap menampilkan tahun lain yang masih tercatat pada data.

Perlu satu tabel baru, `pengaturan_tahun`: jalankan `migrations/2026-10-31_pengaturan_tahun.sql`. Isi awalnya 2025 dan 2026. Sebelum migrasi dijalankan, aplikasi memakai 2025 dan 2026 sebagai bawaan. Struktur `daftar_data` tidak berubah, karena `tahun_berlaku` (INTEGER[]) sudah bisa menampung tahun berapa pun.

### 4.5 Kolom `status_keterisian` bisa tidak sinkron: **BELUM** (penjelasan)

Status "Terisi" disimpan sebagai kolom tersendiri, padahal artinya sama dengan "punya Layer Utama". Saat ini datanya konsisten: 135 baris Terisi, semuanya punya layer. Keduanya bisa berbeda dalam dua kasus:

1. **Data diubah langsung di Supabase (Table Editor/SQL).** Contoh: kolom `layer_utama_uuid` dikosongkan, tetapi `status_keterisian` masih `true`. Lewat aplikasi ini tidak terjadi, karena dialog Verifikasi selalu mengisi keduanya bersamaan.
2. **Layernya dihapus atau diunggah ulang di GeoNode.** Sinkronisasi menghapus layer itu dari cache, tetapi baris daftar data masih menyimpan UUID lama dan tetap "Terisi". Di tabel, baris itu tampil "Belum ada layer terpaut" dengan status Terisi. Kasus ini sempat ditemukan saat update dari Excel: 9 baris merujuk layer yang sudah dihapus dari GeoNode, lalu saya ganti ke layer upload ulangnya (bagian 2).

Saran:
- Kasus 1: buat trigger di database yang otomatis mengisi `status_keterisian = (layer_utama_uuid IS NOT NULL)`.
- Kasus 2: tampilkan peringatan "layer sudah tidak ada di GeoNode" pada baris tersebut. Lihat juga saran pengembangan no. 5.

### 4.6 Lint gagal: **SELESAI**

`npm run lint` sekarang bersih: 0 error dan 0 warning. Perubahan yang dilakukan:
- Pola `setState` di `useEffect` diganti:
  - filter OPD dibaca langsung dari URL `?opd=`;
  - reset halaman dilakukan saat render;
  - `useMounted()` dipakai untuk komponen yang hanya tampil di browser;
  - data diambil lewat fungsi terpisah, lalu diterapkan di `.then()`.
- Import yang tidak terpakai dihapus.

Efek yang terlihat: muat ulang data setelah simpan atau sinkronisasi tidak lagi memunculkan spinner. Tabel langsung diperbarui, dan keempat query sekarang berjalan paralel.

### 4.7 Hal kecil lainnya

- **Dialog Merge: SELESAI.**
  - Layer dan KUGI data sumber tidak lagi dibuang. Kolom yang kosong di data utama diisi dari data lainnya.
  - Jika kedua data sudah berisi layer utama atau KUGI yang **berbeda**, muncul pilihan **data utama**. Nama data, layer utama, dan KUGI hasil merge diambil dari data utama itu.
  - Layer utama data yang tidak dipilih disimpan sebagai layer pelengkap.
- **Dialog Verifikasi:** dibiarkan apa adanya. Layer sengaja dibatasi ke milik OPD tersebut, karena daftar data selalu diunggah oleh OPD-nya sendiri.
- **Parser CSV:** belum diubah. Sel bertanda kutip yang berisi baris baru masih belum didukung.
- **Teks statis "Supabase Status: Aktif & Sinkron": SELESAI.** Sekarang menampilkan "Terhubung" atau "Tidak Terhubung" sesuai hasil pemuatan data.
- **README: SELESAI.** Berisi deskripsi aplikasi, setup `.env.local`, skema dan migrasi, alur kerja tahunan, dan penanganan Supabase yang di-pause.
- **`.gitignore`: SELESAI.** File Excel dan folder `backups/` diabaikan.

### 4.8 Web tidak terbuka saat proyek Supabase di-pause: **SELESAI**

Penyebabnya: `proxy.ts` (dulu `middleware.ts`) memeriksa sesi login ke Supabase pada **setiap** halaman tanpa batas waktu. Saat proyek di-pause, setiap halaman menunggu jawaban yang tidak pernah datang.

Perbaikan:
- Proxy hanya berjalan di `/dashboard`, `/login`, dan `/api`. Halaman publik tidak lagi menunggu Supabase.
- Semua request Supabase diberi batas waktu:
  - 5 detik untuk pengecekan sesi di proxy;
  - 15 detik di browser;
  - 20 detik di server.
  Timeout tidak diulang otomatis oleh postgrest-js.
- Jika database tidak bisa dihubungi:
  - halaman menampilkan banner merah yang menyarankan *Restore project*;
  - halaman login menampilkan pesan yang sama, bukan error teknis.
- Pencegahan: `.github/workflows/supabase-keep-alive.yml` membaca 1 baris tabel dua kali seminggu (Senin dan Kamis). Workflow ini perlu secret `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di GitHub.

## 5. Saran pengembangan

1. **Kode KUGI otomatis dari skala.** Ada 188 baris yang baru punya Nama Unsur, karena tiap nama unsur punya beberapa kode yang (kemungkinan) mewakili skala berbeda. Banyak nama data sudah menyebut skala, misalnya "skala 1:50.000". Saran: tambahkan kolom `skala` pada daftar data, lalu pilih kode unsur otomatis dari skala itu. Konfirmasi dulu arti digit ke-5–6 di dokumen KUGI.
2. **Fitur "Impor dari Excel" langsung.** Saat ini pemadanan tahunan dikerjakan manual seperti yang saya lakukan hari ini. Fitur ini akan membaca sheet Daftar Data, lalu:
   - mencocokkan baris (termasuk yang namanya mirip),
   - mengisi KUGI, layer (dari URL dataset), dan `urutan`,
   - menampilkan pratinjau perbedaan sebelum disimpan.
3. **Kolom No. dan pengaturan urutan di tabel.** Tampilkan nomor urut sesuai Excel. Data baru dari Tambah Data atau Upload CSV otomatis mendapat `urutan` berikutnya (berlaku setelah migrasi bagian 3 dijalankan). Bisa juga ditambah fitur geser untuk mengubah urutan.
4. **Ekspor ke Excel.** Ekspor tabel monitoring dengan format yang sama seperti sheet Daftar Data, supaya spreadsheet tidak perlu dikelola terpisah dari aplikasi.
5. **Deteksi "layer hilang".** Setelah sinkronisasi, tandai data Terisi yang Layer Utama-nya terhapus dari GeoNode, dan sarankan pengganti berdasarkan kemiripan nama atau judul (pola upload ulang seperti di 2c sering terjadi).
6. **Saran layer otomatis.** Untuk data yang Belum Terisi, tampilkan layer milik OPD yang judulnya mirip dengan nama data.
7. **Integrasi GeoNetwork.** Excel sudah punya kolom URL Metadata. Status ketersediaan metadata bisa ikut dipantau di aplikasi.
8. **Sinkronisasi terjadwal.** Misalnya Vercel Cron harian dengan *secret* atau *service role key* di server, supaya cache tidak tertinggal seperti hari ini.
9. **Riwayat perubahan (audit log).** Catat siapa mengubah KUGI atau layer dan kapan, karena aplikasi ini dipakai lintas petugas.
