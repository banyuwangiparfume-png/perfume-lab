# Fase 1 — Overview & Core Flow

> **Nama kerja project:** Perfumer's Notebook
> **Baca ini dulu sebelum file 02–05.** File ini menjelaskan APA yang dibangun dan KENAPA. File berikutnya menjelaskan detailnya.

---

## 1. Problem Statement

Orang yang belajar meracik parfum — termasuk pemilik brand kecil yang sudah jualan — mencatat formulanya di Excel atau buku tulis. Akibatnya tiga masalah terjadi berulang:

**Masalah 1 — Formula tidak bisa direproduksi.**
Catatan menulis "Evernyl 0,025 g" tanpa mencatat bahwa bahan itu dipakai dalam bentuk larutan 10%. Tiga bulan kemudian formula dibuat ulang memakai bahan murni, hasilnya 10x lebih kuat, dan formulanya hancur. **Dilusi adalah data wajib, bukan opsional.**

**Masalah 2 — Tidak ada jejak belajar.**
Formula direvisi belasan kali sampai jadi, tapi yang tersimpan hanya versi terakhir. Alasan tiap perubahan hilang. Padahal justru di situ letak pembelajarannya: "naikin Bacdanol 2% → drydown lebih creamy tapi bergamot ketutup".

**Masalah 3 — "Kekuatan bahan" tidak terlihat dari tabel persen.**
Bahan punya daya pukul (odor impact) yang berbeda sampai 100x lipat. Bahan dengan porsi 2% bisa mendominasi formula, sementara bahan 20% nyaris tak terdengar. Tanpa perhitungan, pemula hanya melihat kolom persen dan menyimpulkan yang salah.

**Akibat akhirnya:** parfum jadi "bubur" — semua bahan tercium sekaligus tanpa ada yang memimpin, tanpa transisi, tanpa karakter.

### Contoh konkret masalah 3

Formula booster dengan 8 bahan, kolom persen vs kekuatan sebenarnya:

| Bahan | % berat | Odor impact | % kekuatan sebenarnya |
|---|---|---|---|
| Hedione | 26% | 65 | 27,6% |
| Galaxolide | 18% | 60 | 17,7% |
| Musk T | 24% | 40 | 15,7% |
| Iso E Super | 20% | 40 | 13,1% |
| **Ambroxan** | **2%** | **400** | **13,1%** |
| Bacdanol | 4% | 80 | 5,2% |
| Cashmeran | 3% | 80 | 3,9% |
| Sandalore | 3% | 75 | 3,7% |

Ambroxan dengan porsi 2% punya kekuatan setara Iso E Super yang porsinya 20%. Sepuluh kali lipat leverage — dan itu tidak terlihat sama sekali dari kolom persen.

**Aplikasi ini menghitung kolom paling kanan itu secara otomatis.**

---

## 2. Target User

**v1 — pemilik aplikasi sendiri (single user).**
Pemilik brand parfum yang sudah jualan, sedang naik level dari "tune parfum jadi" ke "menyusun parfum dari bahan baku". Secara teknis melek (bisa pakai spreadsheet, paham persen dan gramasi), tapi **bukan perfumer bersertifikat**. Punya sekitar 40 raw material dan akses pricelist supplier yang sudah berisi data odor impact.

**v2 ke depan — murid kelas meracik parfum.**
Awam total soal perfumery. Tidak boleh dihadapkan pada 400 pilihan bahan. Mereka butuh dipagari: kit bahan terbatas, formula starter yang sudah terbukti, dan peringatan otomatis saat formulanya berisiko gagal.

**Implikasi desain:** skema database sudah disiapkan multi-user (`owner_id` + RLS) sejak v1, tapi UI v1 tidak punya fitur tim, sharing, atau role murid. Itu dibuka belakangan tanpa perlu migrasi skema.

---

## 3. Posisi Produk — penting, jangan sampai salah

Aplikasi ini **BUKAN** pembuat parfum. Aplikasi ini **tidak bisa mencium**.

Yang dijanjikan: **"formula kamu tidak akan bubur."**
Yang TIDAK dijanjikan: "parfum kamu akan wangi."

Semua analisa di app ini bersifat struktural — jumlah bahan, sebaran fungsi, distribusi kekuatan. Formula bisa lolos semua pemeriksaan dan tetap berbau tidak enak, karena selera dan harmoni tidak bisa dihitung.

Framing ini harus konsisten di seluruh copy aplikasi. Setiap hasil analisa ditutup dengan kalimat yang mengembalikan keputusan ke hidung user. **Jangan pernah menulis "formula ini bagus"** — tulis "struktur formula ini sehat, sekarang cium dan nilai sendiri".

---

## 4. Core User Journey

Untuk fase 1–4, **asumsikan user sudah masuk**. Auth dipasang di fase 5. Selama pembangunan, pakai satu user dummy tetap (hardcoded UUID) supaya semua query yang butuh `owner_id` tetap jalan.

### Journey A — Membedah formula orang lain (reverse engineering)

Ini journey paling sering dipakai di awal, karena cara belajar user adalah dari formula jadi ke bahan, bukan sebaliknya.

```
Dashboard
  -> Formula baru (tipe: accord, source: ecofragrantica)
  -> Input baris bahan + DILUSI tiap baris
  -> Lihat panel analisa (% kekuatan, rules checker)
  -> Simpan sebagai v1
  -> Duplikat jadi v2, hapus 1 bahan  <-- subtraction test
  -> Duplikat jadi v3, naikin 1 bahan 2x
  -> Tandai ketiganya "mixed" dengan tanggal
  -> [racik di meja, tunggu]
  -> Buat evaluasi untuk tiap versi, isi observasi di menit 5/30/60/180/360
  -> Buka Compare: v1 vs v2 vs v3 berdampingan
  -> Tulis change_note: "tanpa X, drydown kehilangan sisi creamy"
```

### Journey B — Menyusun formula sendiri dari beberapa accord

```
Dashboard
  -> Formula baru (tipe: full_perfume)
  -> Tambah baris: accord A 60%, accord B 30%, accord C 10%
     (accord bisa dirujuk sebagai komponen, lihat catatan di bawah)
  -> Rules checker: "tidak ada bahan kategori Bridger — transisi berisiko patah"
  -> Tambah 1 bahan Bridger, cek ulang
  -> Simpan, racik, evaluasi
  -> Revisi rasio jadi 50/35/15, simpan sebagai v2
  -> Compare v1 vs v2
```

### Journey B2 — Menyesuaikan FO dengan accord

Journey yang paling sering dipakai untuk produk yang dijual, karena basisnya bibit jadi.

```
Formula baru (tipe: full_perfume)
  -> Baris 1: FO "Tabbac 28"            94 g   [jenis: FO]
  -> Baris 2: Booster Soft-Longevity v5  6 g   [jenis: sub-formula]
  -> Rules: "FO 94% — aman, karakter asli masih memimpin"
  -> Simpan v1
  -> v2: tambah accord creamy 3%, FO turun ke 91%
  -> Rules: masih di atas 85%, lolos
  -> v3: accord dinaikkan ke 10%, FO jadi 84%
  -> Rules: "FO cuma 84% — karakter asli bibitnya mulai tertutup"
  -> Racik v1, v2, v3 -> evaluasi -> compare
```

Deret dosis untuk menguji aksen di atas FO sebaiknya melebar, bukan rata: **99:1, 97:3, 95:5, 90:10**. Efek accord di atas FO tidak linear — selisih 1% ke 3% terasa besar, selisih 15% ke 20% hampir tidak terasa karena FO-nya sudah tertutup.

### Journey C — Dari formula ke harga jual

```
Formula detail
  -> Hitung HPP
  -> Pilih ukuran botol & volume isi
  -> Set persentase: FO, booster, ethanol, aquades, solubilizer
  -> Pilih item packaging (botol, dus, sticker, seal, dus packing)
  -> Lihat HPP, kontribusi tiap komponen, margin di HET dan harga net
  -> Export PDF
```

### Journey D — Kelola master bahan (admin)

```
Admin
  -> Raw Materials
  -> Import CSV pricelist (nama, CAS, impact, kategori fungsi, odour profile, family, harga 5 tier)
  -> Review baris yang gagal / duplikat
  -> Edit manual, atau override nilai impact + alasannya
```

---

## 5. Konsep Data yang Harus Dipahami Dulu

Empat konsep ini menentukan seluruh desain. Kalau salah paham di sini, skema databasenya akan salah.

### 5.1 Dilusi

Bahan disimpan di rak dalam dua bentuk: murni (*neat*) atau sudah diencerkan (misal 10% dalam DPG). Formula mencatat **berat seperti ditimbang**, bukan berat bahan murni.

```
berat_murni = berat_timbang × (dilution_pct / 100)
```

Contoh: `Ambroxan 0,500 g @ 10% in DPG` → bahan murni yang masuk formula = 0,050 g.

**Semua perhitungan kekuatan dan harga memakai berat murni. Semua instruksi penimbangan memakai berat timbang.** Jangan sampai tertukar — ini sumber bug paling berbahaya di aplikasi jenis ini.

### 5.2 Odor Impact

Angka relatif kekuatan bau per satuan berat. Dalam sistem supplier yang dipakai (Ecofragrantica / Perfumers World ABC's):

| Kategori Fungsi | Rentang impact | Arti |
|---|---|---|
| **Bridger** | selalu 100 | titik acuan — penyambung antar bagian |
| **Fixative** | 3 – 98 | lemah per gram, tapi bertahan lama |
| **Diffuser** | 110 – 500 | kuat, mendorong keluar |
| **Modifier** | 36 – 4000 | rentang sangat lebar, pembentuk karakter |

**100 adalah baseline.** Di atas 100 = lebih kuat dari acuan. Di bawah 100 = lebih lemah tapi biasanya lebih tahan lama.

Catatan penting yang harus muncul di UI: angka ini **bucketed, bukan hasil pengukuran per molekul** (94 bahan bernilai persis 100, dan semua Bridger bernilai 100 tanpa kecuali). Bagus untuk mendeteksi "ini kelebihan dosis", tidak bagus untuk presisi. Karena itu setiap bahan punya field `odor_impact_override` + catatan alasan, supaya user bisa mengoreksi dari hasil penciumannya sendiri. Lama-lama kolom override inilah yang jadi aset asli aplikasi.

### 5.3 Rumus % Kekuatan

```
berat_murni_i   = berat_timbang_i × dilution_pct_i / 100
persen_murni_i  = berat_murni_i / Σ berat_murni × 100
kontribusi_i    = persen_murni_i × impact_efektif_i
persen_kekuatan = kontribusi_i / Σ kontribusi × 100
```

dengan `impact_efektif = odor_impact_override ?? odor_impact`.

Kalau ada bahan yang nilai impact-nya kosong, **jangan diam-diam dianggap 0 atau 100**. Tandai hasilnya sebagai tidak lengkap dan sebutkan bahan mana yang datanya hilang.

### 5.4 Tiga Jenis Komponen

Formula tidak hanya berisi raw material. Satu baris bisa berupa **raw material**, **FO** (bibit jadi dari pihak ketiga), atau **sub-formula** (accord/booster buatan sendiri). Ketiganya berperilaku berbeda di perhitungan — rinciannya di file 03 bagian 2.1.

Yang paling penting dipahami sejak awal: **FO tidak punya nilai impact dan tidak akan pernah punya.** Dia parfum lengkap berisi puluhan bahan yang komposisinya tidak diketahui. Jadi baris FO dihitung beratnya dan biayanya, tapi dikeluarkan dari perhitungan % kekuatan — dan aplikasi harus menyebutkan berapa persen formula yang sebenarnya ikut dinilai, bukan menampilkan angka yang terlihat utuh padahal hanya mewakili sebagian.

### 5.5 Versi

Formula adalah wadah (konsep). Yang berisi bahan adalah **versi**. Satu formula punya banyak versi, dan versi bisa bercabang (v3 melahirkan v4a dan v4b untuk subtraction test).

Field `change_note` pada setiap versi wajib diisi saat menyimpan versi ke-2 dan seterusnya. Itu bukan metadata — itu isi pelajarannya.

---

## 6. Goal & Success Metric MVP

MVP dianggap berhasil kalau dalam 1 bulan pemakaian:

| Metrik | Target |
|---|---|
| Formula tercatat lengkap dengan dilusi | ≥ 20 formula |
| Formula yang punya ≥ 2 versi dengan change_note terisi | ≥ 10 |
| Versi yang punya ≥ 1 evaluasi dengan minimal 3 titik waktu | ≥ 15 |
| Formula yang dievaluasi oleh lebih dari 1 orang | ≥ 3 |
| Waktu input satu formula 8 bahan | < 3 menit |
| Formula bisa dibuat ulang dari catatan app tanpa menebak | 100% |

Metrik baris terakhir adalah yang paling penting. Kalau formula tidak bisa direproduksi dari data di aplikasi, aplikasinya gagal — tidak peduli sebagus apa fitur lainnya.

Metrik "dievaluasi lebih dari 1 orang" ada karena **anosmia parsial**: sebagian orang tidak bisa mencium molekul musk atau sandalwood sintetis tertentu. Penilaian satu hidung tidak cukup, dan aplikasi harus mendorong kebiasaan ini sejak awal.

---

## 7. Yang TIDAK Masuk MVP

Ditulis eksplisit supaya tidak merembet saat dibangun:

- Rekomendasi bahan berbasis AI (ini v4, setelah ada data sendiri yang cukup)
- Prediksi aroma hasil campuran
- Manajemen stok / inventaris botol dan sisa bahan
- Marketplace atau katalog publik
- Kolaborasi real-time
- Mobile app native (web responsive saja)
- Payment / langganan
- Pengecekan IFRA otomatis (kolom disiapkan di tabel, tapi tidak ada logika validasi di v1)

---

## 8. Urutan Build

| Fase | Isi | File |
|---|---|---|
| 1 | Setup project, skema DB, seed master RM | 03 |
| 2 | CRUD formula + versi + baris, kalkulasi live | 02, 03 |
| 3 | Rules checker + evaluasi + compare versi | 02 |
| 4 | Desain system, polish UI, halaman admin | 04 |
| 5 | HPP calculator | 02 |
| 6 | Auth + deployment | 05 |

Bangun tanpa auth sampai fase 5. Pakai user dummy tetap supaya kolom `owner_id` dan RLS tetap bisa diuji sejak awal.
