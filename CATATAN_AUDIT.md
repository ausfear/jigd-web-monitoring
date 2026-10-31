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

**Satu langkah yang perlu Anda lakukan:** buka Supabase Dashboard → SQL Editor, lalu jalankan seluruh isi
`migrations/2026-10-31_urutan_daftar_data.sql`.

File ini menambah kolom `urutan` dan langsung mengisi nilainya untuk 222 baris. Migrasi ini tidak bisa saya jalankan sendiri karena anon key tidak boleh mengubah struktur tabel. Sebelum migrasi dijalankan, aplikasi tetap berjalan normal, hanya urutannya belum aktif.

---

## 4. Saran perbaikan (prioritas tinggi → rendah)

### 4.1 [KRITIS] Siapa pun bisa mengubah atau menghapus data tanpa login

Policy RLS di `database_schema.sql` mengizinkan INSERT/UPDATE/DELETE untuk role **anon**. Anon key memang dikirim ke browser, jadi siapa pun yang membuka situs bisa memanggil REST API Supabase dan menghapus seluruh `daftar_data`. Login di `/dashboard` hanya melindungi tampilan, bukan datanya.

Solusi: jalankan `migrations/OPSIONAL_rls_hanya_user_login.sql`. Akses baca publik tetap terbuka. File ini aman dijalankan setelah versi kode ini ter-deploy, karena route sync sudah memakai sesi login.

### 4.2 Sinkronisasi menimpa nama OPD

Setiap kali sinkronisasi berjalan, `master_opd.nama_opd` ditimpa dengan nama dari GeoNode. Nama OPD yang dirapikan manual di database akan kembali seperti semula. Saran: hanya isi `nama_opd` saat OPD baru dibuat, atau simpan nama GeoNode di kolom terpisah.

### 4.3 Batas 1.000 dataset

Sync mengambil `?limit=1000` dari GeoNode tanpa paginasi. Saat ini ada 455 dataset, jadi masih aman. Jika suatu saat lebih dari 1.000, sebagian layer tidak akan tersinkron. Penghapusan layer usang sudah diberi pengaman untuk kasus ini. Saran: ikuti `meta.next` untuk paginasi.

Hal serupa berlaku untuk query Supabase tanpa `.range()`. Saat ini `max_rows` di proyek Supabase cukup besar (3.309 baris KUGI terambil semua). Jika pengaturan itu dikembalikan ke default 1.000, daftar KUGI akan terpotong tanpa peringatan.

### 4.4 Tahun masih di-hardcode 2024–2026

Tombol tahun di dialog Verifikasi dan kartu tahunan di Overview masih menyebut 2024–2026 secara langsung. Saat masuk Daftar Data 2027, tahun 2027 tidak bisa dipilih. Saran: buat daftar tahun dinamis, yaitu tahun berjalan ditambah tahun yang ada di data.

### 4.5 Kolom `status_keterisian` bisa tidak sinkron

Status ini disimpan terpisah, padahal nilainya bisa diturunkan dari ada atau tidaknya `layer_utama_uuid`. Dialog Verifikasi sudah konsisten, tetapi sumber lain bisa membuatnya tidak sinkron, misalnya tombol "Muat 6 Data Contoh" (mengisi status `true` tanpa layer) atau penyuntingan langsung di database. Saran: jadikan *generated column* atau isi lewat trigger.

### 4.6 Lint gagal

Ada 11 error ESLint lama, kebanyakan aturan `react-hooks/set-state-in-effect` (pola `setMounted(true)` dan sinkronisasi state di `useEffect`). Kode tetap berjalan, tetapi `npm run lint` akan gagal bila dipakai di CI.

### 4.7 Hal kecil lainnya

- **Dialog Merge**: Layer dan KUGI dari data sumber dibuang begitu saja. Saran: pindahkan ke data target bila target masih kosong.
- **Dialog Verifikasi**: Layer Utama milik OPD lain (jika ada) tidak tampil namanya, karena daftar pilihan hanya memuat layer milik OPD tersebut.
- **Parser CSV**: Belum mendukung sel bertanda kutip yang berisi baris baru. Saran: pakai library seperti `papaparse`.
- **Teks statis**: "Supabase Status: Aktif & Sinkron" di footer tabel ditulis langsung di kode, bukan status sebenarnya.
- **README**: Masih template bawaan `create-next-app`. Perlu diisi cara setup `.env.local`, menjalankan skema dan migrasi, serta alur kerja tahunan.
- **`.gitignore`**: Ada perubahan Anda yang belum di-commit (`# keterisian`) tanpa pola di bawahnya. Kemungkinan maksudnya mengecualikan file Excel. Sebaiknya tambahkan juga `backups/`.

---

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
