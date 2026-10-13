# Fase 2 — Fitur & Screen

> Lanjutan dari `01-overview-core-flow.md`. File ini merinci tiap halaman: fungsinya, elemen UI, aksi user, dan kondisi (empty, loading, error).

**Prioritas:** `P0` = wajib ada supaya aplikasi berguna · `P1` = penting, kerjakan setelah P0 jalan · `P2` = boleh belakangan.

---

## Peta Navigasi

```
/                      Dashboard                        P0
/materials             Daftar raw material              P0
/materials/[id]        Detail raw material              P1
/fo                    Daftar FO (bibit parfum jadi)    P0
/fo/[id]               Detail FO                        P1
/formulas              Daftar formula                   P0
/formulas/new          Buat formula baru                P0
/formulas/[id]         Detail formula + versi aktif     P0
/formulas/[id]/edit    Editor versi                     P0
/formulas/[id]/compare Bandingkan antar versi           P1
/evaluations/new       Form evaluasi penciuman          P0
/evaluations/[id]      Detail evaluasi                  P1
/costing               Kalkulator HPP                   P1
/costing/[id]          Detail cost sheet                P1
/admin/materials       Admin master RM + import CSV     P1
/admin/packaging       Admin item packaging             P2
```

Navbar: Dashboard · Formula · Bahan · FO · HPP · Admin.

**Catatan lintas-halaman.** Satu baris formula bisa berisi tiga hal berbeda — raw material, FO (bibit jadi), atau sub-formula (accord/booster buatan sendiri). Bedanya dijelaskan di file 03 bagian 2.1, dan perbedaan itu muncul di hampir semua layar di bawah. Baca bagian itu dulu sebelum membangun editor.

---

## P0 — Screen Inti

### 1. Dashboard — `/`

**Fungsi:** titik masuk harian. Menjawab "apa yang perlu gue kerjain hari ini".

**Elemen UI:**
- 4 stat tile: total formula · versi bulan ini · evaluasi bulan ini · bahan tanpa data impact
- **Panel "Menunggu dievaluasi"** — versi berstatus `mixed` yang belum punya evaluasi, diurut dari yang paling lama. Tampilkan umur maserasi: *"Jasmine Accord v2 — dicampur 18 hari lalu, belum dievaluasi"*. Ini panel terpenting di dashboard, karena masalah utama praktik lab adalah racikan yang dibuat lalu terlupakan.
- Daftar formula yang baru diubah (5 terakhir)
- Tombol besar: **+ Formula Baru**

**Aksi:** klik formula → detail · klik item antrean → langsung ke form evaluasi dengan versi sudah terpilih.

**Kondisi:**
- *Empty:* "Belum ada formula. Mulai dari membedah formula yang sudah ada — itu cara belajar paling cepat." + tombol buat formula.
- *Loading:* skeleton card.
- *Error:* banner merah + tombol coba lagi. Jangan tampilkan halaman kosong tanpa penjelasan.

---

### 2. Daftar Raw Material — `/materials`

**Fungsi:** referensi bahan. Dipakai sambil menyusun formula.

**Elemen UI:**
- Search (nama, sinonim, CAS)
- Filter: Family · Kategori Fungsi · "punya data impact" / "belum"
- Tabel: Nama · Family · Kategori Fungsi · Impact · Harga/g (tier terkecil & terbesar) · Odour Profile (dipotong)
- Kolom Impact diberi **badge warna** berdasarkan posisi relatif ke baseline 100:
  - < 50 → abu-abu, label "lemah / tahan lama"
  - 50–150 → biru, label "sedang"
  - 150–500 → oranye, label "kuat"
  - > 500 → merah, label "sangat kuat — dosis kecil"
- Sort: nama · impact · harga/g
- Baris yang `odor_impact` kosong ditandai jelas, karena bahan itu akan membuat analisa formula tidak lengkap

**Aksi:** klik baris → detail bahan · tombol "tambah ke formula" kalau datang dari editor.

**Kondisi:** *Empty:* "Master bahan belum diisi. Import pricelist dulu di Admin → Raw Materials." + tombol ke sana.

---

### 2b. Daftar FO — `/fo` · P0

**Fungsi:** mendata bibit parfum jadi. Dipisah dari raw material karena sifatnya berbeda — FO adalah parfum lengkap, bukan molekul tunggal.

**Elemen UI:**
- Tabel: Nama · Inspired by · Family · Supplier · Harga/g · DEP% · aktif
- Filter: family, supplier
- Tombol **+ FO Baru**
- Form FO: nama, inspired by, supplier, family (wajib), sub-family, catatan piramida notes (teks bebas), harga per gram, DEP %, catatan pribadi

**Yang sengaja TIDAK ada di form ini:** kolom odor impact dan kategori fungsi. FO tidak punya nilai itu, dan mengisinya dengan tebakan akan merusak seluruh analisa. Kalau ada yang bertanya kenapa, taruh teks kecil di bawah form:

> FO berisi puluhan bahan yang komposisinya tidak kita ketahui, jadi dia tidak bisa diberi satu nilai kekuatan. Di analisa formula, bagian FO dihitung beratnya tapi tidak ikut dinilai kekuatannya.

**Kondisi:** *Empty:* "Belum ada FO terdaftar. Tambahkan bibit yang kamu pakai supaya bisa dipanggil di formula." + tombol.

---

### 3. Daftar Formula — `/formulas`

**Elemen UI:**
- Filter: tipe (`accord` / `base` / `booster` / `full_perfume` / `experiment`) · sumber (`own` / `ecofragrantica` / `kurdlab` / `other`) · kategori target · arsip
- Tiap kartu: nama · tipe (badge) · jumlah versi · versi terakhir + tanggal · jumlah evaluasi · status versi terakhir
- Toggle grid/tabel
- Tombol **+ Formula Baru**

**Aksi:** klik → detail · menu titik-tiga: duplikat, arsipkan, hapus.

---

### 4. Buat Formula Baru — `/formulas/new`

**Elemen UI:** form pendek saja:
- Nama (wajib)
- Tipe (wajib, dropdown)
- Kategori target (opsional: Floral / Woody / Oriental / Fresh / Gourmand / Spicy)
- Sumber + catatan sumber (misal: "formula accord dari Ecofragrantica, diterima 2026-10-01")
- Deskripsi / tujuan (opsional, tapi dorong diisi: *"apa yang mau dicapai formula ini?"*)

**Aksi:** Simpan → langsung masuk ke editor versi v1. Jangan buat halaman perantara.

---

### 5. Detail Formula — `/formulas/[id]`

Halaman paling padat. Bagi jadi 3 kolom di desktop, bertumpuk di mobile.

**Header:** nama · tipe · dropdown pemilih versi (v1, v2, v3…) · status versi · tombol: Edit · Duplikat jadi versi baru · Compare · Evaluasi · Hitung HPP

**Kolom kiri — Tabel komponen (read-only):**

| # | Komponen | Jenis | Timbang (g) | Dilusi | Murni (g) | % murni | Impact | % kekuatan |
|---|---|---|---|---|---|---|---|---|

Baris total di bawah. Kolom "% kekuatan" diberi bar horizontal supaya proporsinya langsung terlihat.

**Perlakuan per jenis baris:**

| Jenis | Badge | Impact | % kekuatan |
|---|---|---|---|
| Raw material | — | nilai bahan | dihitung |
| **FO** | badge "FO" | `—` | **`—`**, sel diberi arsir tipis |
| **Sub-formula** | badge "Accord"/"Booster" sesuai tipe | impact agregat, ditandai *(rata-rata)* | dihitung |

Baris sub-formula bisa **diperluas** (chevron di kiri) untuk menampilkan bahan penyusunnya sebagai sub-baris indentasi, dengan berat yang sudah diskalakan ke porsinya di formula ini. Default tertutup supaya tabel tetap ringkas.

**Kalau ada baris FO**, tampilkan label di atas kolom % kekuatan:

> % kekuatan dihitung dari **{strengthBasis}%** formula ini. Bagian FO tidak ikut dinilai karena isinya tidak diketahui.

Jangan sembunyikan ini atau menulisnya dengan font pucat. User yang mengira angka itu mewakili seluruh formula akan mengambil keputusan yang salah.

**Kolom tengah — Analisa:**
- Chart batang horizontal: % berat vs % kekuatan berdampingan per bahan. **Ini visual inti aplikasi** — perbedaan dua batang itulah pelajarannya.
- Donut: sebaran % kekuatan per Kategori Fungsi (Diffuser / Modifier / Bridger / Fixative)
- Ringkasan: jumlah bahan · total berat · estimasi biaya per gram · bahan paling dominan

**Kolom kanan — Rules Checker + riwayat:**
- Panel hasil pemeriksaan (detail di bawah)
- `change_note` versi ini
- Daftar evaluasi untuk versi ini, dengan nama penilai

**Kondisi:**
- *Versi tanpa baris:* "Versi ini masih kosong" + tombol Edit.
- *Ada bahan tanpa impact:* banner kuning di atas panel analisa — *"3 bahan belum punya nilai impact. Persentase kekuatan di bawah belum lengkap."* Jangan sembunyikan ini.

---

### 6. Editor Versi — `/formulas/[id]/edit`

**Fungsi:** input dan ubah baris bahan. Harus cepat — target input 8 bahan di bawah 3 menit.

**Elemen UI:**
- Field atas: label versi · target batch size (gram, default 10) · status
- Tabel baris yang bisa diedit. Tiap baris:
  - **Jenis** — toggle kecil di awal baris: Bahan · FO · Formula. Menentukan isi picker di kolom sebelahnya.
  - **Komponen** — picker bertab sesuai jenis:
    - *Bahan* — combobox raw material, menampilkan impact + kategori fungsi di daftar pilihan supaya user belajar sambil memilih
    - *FO* — daftar bibit jadi, menampilkan family + inspired-by
    - *Formula* — versi formula lain milik user (accord, base, booster). Hanya menampilkan versi yang tidak menyebabkan siklus, dan hanya sampai kedalaman 3 tingkat. Versi yang tidak boleh dipilih tetap ditampilkan tapi non-aktif, dengan alasannya di tooltip — jangan disembunyikan diam-diam, user akan bingung mencarinya.
  - **Berat timbang (g)** — input angka, 3 desimal
  - **Dilusi** — dropdown: Neat (100%) · 50% · 25% · 10% · 5% · 1% · custom
  - **Pelarut** — dropdown: — / DPG / TEC / IPM / Ethanol / Jojoba (nonaktif kalau Neat)
  - **Catatan** — teks pendek
  - Tombol hapus baris, handle drag untuk urutan
- Tombol **+ Tambah bahan**
- **Panel kalkulasi live di samping** — update tiap ketikan: % murni, % kekuatan, total, peringatan rules
- Field **"Apa yang diubah dari versi sebelumnya?"** — wajib diisi untuk versi ke-2 ke atas. Blokir tombol simpan kalau kosong, dengan pesan yang menjelaskan kenapa: *"Catatan perubahan ini yang bikin kamu belajar. Tulis singkat saja."*
- Tombol: Simpan sebagai revisi versi ini · Simpan sebagai versi baru

**Fitur scaling:** tombol "Skalakan ke __ gram" — mengalikan semua berat proporsional dan membulatkan ke 3 desimal. Tampilkan hasil sebelum diterapkan.

**Kondisi:**
- *Baris tanpa bahan terpilih:* tandai merah, cegah simpan
- *Berat 0 atau kosong:* tandai, cegah simpan
- *Bahan ganda:* peringatkan ("bahan ini sudah ada di baris 3 — gabungkan?")
- *Dilusi dipilih tapi pelarut kosong:* peringatan kuning, tidak memblokir

---

### 7. Rules Checker

Bukan halaman tersendiri — panel yang muncul di detail formula dan editor. Berjalan di client supaya instan.

Hasil berupa daftar temuan dengan tiga tingkat: `info` (biru) · `warning` (kuning) · `critical` (merah).

**Semua rule berjalan di atas daftar yang sudah dibentangkan** (`expandLines`), bukan daftar baris mentah. Formula berisi 3 sub-formula harus terbaca sebagai 24 bahan, bukan 3.

**Rule 1 — Jumlah bahan**
```
n = jumlah raw material setelah sub-formula dibentangkan
n > 12  -> warning  "Formula ini punya n bahan. Untuk pemula, di atas 12 bahan
                     sulit dikendalikan dan hasilnya cenderung bubur."
n <= 3  -> info     "Formula sangat sederhana. Bagus untuk belajar rasio."

ada baris FO
  -> info     "Hitungan n bahan di atas belum termasuk isi FO. Satu FO biasanya
               berisi 30–80 bahan yang tidak terlihat di sini."
```

**Rule 2 — Sebaran fungsi** (pakai % kekuatan, bukan % berat)
```
fixative_share < 15%        -> warning  "Porsi Fixative cuma X%. Drydown kemungkinan
                                         tipis dan wangi cepat hilang."
diffuser+modifier > 85%     -> warning  "Formula didominasi bahan yang mendorong keluar.
                                         Kemungkinan terasa menusuk di awal."
bridger_share == 0
  DAN jumlah family >= 3    -> warning  "Tidak ada bahan kategori Bridger, padahal formula
                                         mencakup N keluarga aroma. Transisi berisiko patah."
```

Persentase di rule ini memakai % kekuatan, yang berarti **bagian FO tidak ikut terhitung**. Jadi kalau formula isinya 94% FO + 6% booster, "porsi Fixative" yang dinilai adalah porsi di dalam 6% itu, bukan terhadap seluruh botol. Tulis ini di tooltip rule, karena angkanya akan terlihat aneh kalau user tidak tahu basisnya.

Penghitungan jumlah family **termasuk** family FO, karena FO tetap menyumbang karakter walau kekuatannya tidak dinilai.
Untuk rule terakhir, tampilkan **tombol "Lihat kandidat Bridger"** yang membuka daftar bahan berkategori Bridger yang dimiliki user. Ini mengubah peringatan jadi langkah yang bisa dikerjakan.

**Rule 3 — Dominansi**
```
top1_share < 20%  -> warning  "Tidak ada nada yang memimpin — porsi kekuatan terlalu rata.
                               Ini penyebab paling umum formula terasa bubur."
top1_share > 60%  -> warning  "[Bahan] menguasai X% kekuatan. Bahan lain kemungkinan
                               tidak terbaca."
```

**Rule 4 — Bahan yang menelan / tenggelam**
```
untuk tiap bahan:
  share_kekuatan >= 3 x share_berat DAN share_kekuatan > 25%
      -> warning  "[Bahan] cuma X% berat tapi Y% kekuatan. Cek apakah dosisnya kelebihan."

  share_kekuatan < 1%
      -> info     "[Bahan] kontribusinya di bawah 1%. Naikkan dosisnya atau hapus —
                   saat ini dia hanya menambah biaya."
```

**Rule 5 — Kelengkapan data**
```
ada raw material dengan impact kosong
  -> critical  "N bahan belum punya nilai impact. Semua persentase kekuatan di halaman
                ini belum bisa dipercaya sampai data itu dilengkapi."
```

**Rule 6 — Dominasi FO** *(hanya jalan kalau ada baris FO)*
```
fo_neat_share < 85%
  -> warning  "FO cuma X% dari formula. Di bawah 85%, karakter asli bibitnya mulai
               tertutup oleh bahan tambahan. Kalau itu memang tujuanmu, abaikan —
               tapi jangan berharap hasilnya masih mirip FO aslinya."

fo_neat_share >= 99%
  -> info     "Tambahan di luar FO cuma X%. Kemungkinan besar efeknya tidak akan terasa."
```

Tujuan rule ini: FO bukan bahan, dia badan utama formula. Begitu porsinya turun terlalu jauh, user sebenarnya sedang membuat parfum baru, bukan menyesuaikan FO — dan itu pekerjaan yang jauh lebih sulit daripada yang dia kira.

**Rule 7 — Lebih dari satu FO**
```
fo_count >= 2
  -> warning  "Formula ini menggabungkan N bibit jadi. Tiap FO adalah parfum lengkap
               berisi puluhan bahan yang tidak dirancang untuk digabung — ini penyebab
               paling umum hasil terasa bubur."

  DAN kalau porsi FO terbesar < 70%
      -> warning  "Tidak ada FO yang jelas memimpin (terbesar cuma X%). Dua bibit dengan
                   porsi seimbang akan saling berebut. Naikkan salah satu ke 70% atau lebih."

  DAN kalau family antar FO berbeda
      -> warning  "FO yang digabung berasal dari family berbeda ([A] dan [B]). Penggabungan
                   dua bibit hanya masuk akal kalau family-nya berdekatan."
```

Rule 7 tidak memblokir apa pun — menggabungkan dua FO tobacco dengan porsi 70:30 adalah hal yang wajar dan sering berhasil. Yang dicegah adalah melakukannya tanpa sadar risikonya.

**Footer panel — wajib ada, jangan dihapus:**
> Pemeriksaan ini hanya menilai struktur, bukan aroma. Formula bisa lolos semua pemeriksaan dan tetap berbau tidak enak. Keputusan akhir tetap di hidung kamu.

Ambang batas tiap rule disimpan sebagai konstanta di satu file (`lib/rules/thresholds.ts`), bukan ditulis tersebar, supaya gampang dikalibrasi setelah dipakai beberapa minggu.

---

### 8. Form Evaluasi — `/evaluations/new`

**Fungsi:** merekam hasil penciuman. Ini data yang paling bernilai jangka panjang dan paling sering tidak dicatat orang.

**Elemen UI — Langkah 1, konteks:**
- Pilih formula → pilih versi (kalau datang dari dashboard, sudah terisi)
- **Nama penilai** — teks bebas, default nama user. Harus bisa diisi nama orang lain.
- Media: Blotter / Kulit / Kain
- Diencerkan dalam (opsional): misal "20% in ethanol"
- Umur maserasi (hari) — terisi otomatis dari `mixed_at` kalau ada, bisa ditimpa
- Tanggal evaluasi

**Elemen UI — Langkah 2, titik waktu:**

Baris waktu preset: **5 menit · 30 menit · 1 jam · 3 jam · 6 jam** (bisa tambah titik custom). Tiap titik:
- Nada dominan (teks pendek)
- Deskriptor (input tag multi: creamy, woody, tajam, manis, hangat, …) dengan saran dari deskriptor yang pernah dipakai
- Intensitas 1–10 (slider)
- Catatan bebas

User boleh mengisi sebagian titik lalu kembali lagi nanti — **simpan parsial harus bisa**, karena pengisian memang terpisah berjam-jam. Jangan paksa semua titik terisi sebelum simpan.

**Elemen UI — Langkah 3, penutup:**
- Kesan keseluruhan
- Rating 1–5 (opsional)
- Checkbox: "Transisi terasa mulus" / "Terasa patah" / "Terasa bubur" — tiga kotak ini langsung memetakan masalah yang mau dipecahkan aplikasi

**Aksi:** Simpan → kembali ke detail formula, ubah status versi jadi `evaluated`.

**Kondisi:**
- *Belum ada versi berstatus mixed:* "Belum ada racikan yang siap dinilai. Tandai dulu versi yang sudah kamu campur."
- *Versi ini sudah dievaluasi orang lain:* tampilkan info *"Versi ini sudah dinilai oleh [nama]. Jangan lihat catatannya dulu sebelum kamu selesai menilai sendiri."* — mencegah bias.

---

## P1 — Screen Pendukung

### 9. Detail Raw Material — `/materials/[id]`

- Data lengkap: nama, sinonim, CAS, family, kategori fungsi, odour profile, link TGSC
- Impact: nilai dari supplier + field **override** dengan catatan alasan. Kalau sudah di-override, tampilkan keduanya berdampingan: ~~80~~ → **110** *(terasa lebih kuat dari angka supplier, tes 2026-10-04)*
- Tabel harga per tier (5/10/50/100/500 g) + harga per gram tiap tier, tandai tier termurah
- **"Dipakai di formula mana saja"** — daftar formula + dosis yang dipakai. Berguna untuk melihat kebiasaan sendiri.
- Catatan pribadi tentang bahan ini (bau, perilaku, jebakan)

### 10. Compare Versi — `/formulas/[id]/compare`

- Pilih 2–3 versi
- Tabel bahan berdampingan, selisih ditandai warna: hijau = naik, merah = turun, abu = baru/dihapus
- Chart % kekuatan bertumpuk
- `change_note` tiap versi ditampilkan sejajar
- Ringkasan evaluasi tiap versi: rating, checkbox mulus/patah/bubur, kutipan catatan menit 180

Layar ini yang menutup siklus belajar. Prioritaskan di atas HPP kalau waktu terbatas.

### 11. Kalkulator HPP — `/costing`

- Pilih formula (biasanya tipe `booster` atau `full_perfume`)
- Ukuran botol (ml) + volume isi aktual (ml) — defaultkan isi lebih kecil dari botol, sediakan headspace
- Komposisi cairan: FO % · booster % · ethanol % · aquades % · solubilizer % (harus total 100, tampilkan sisa secara live)
- Harga FO per gram (input manual)
- Pilih item packaging + jumlah
- Biaya lain-lain / losses
- **Output:** tabel biaya per item + kolom % HPP · HPP total · margin di HET dan di harga net setelah biaya marketplace
- Tombol Export PDF

Catat asumsi densitas 1 g/ml secara eksplisit di UI — itu pembulatan, bukan kebenaran.

### 12. Admin — Raw Materials — `/admin/materials`

- Tabel master lengkap, CRUD
- **Import CSV** — kolom: `name, synonym, cas_number, family, category, odour_profile, function_category, odor_impact, tgsc_url, price_5g, price_10g, price_50g, price_100g, price_500g`
  - Alur: upload → pratinjau 10 baris pertama + pemetaan kolom → validasi → tampilkan ringkasan (N baru, N update, N gagal + alasan) → konfirmasi → jalankan
  - Cocokkan baris lama/baru pakai **CAS number** sebagai kunci utama, nama sebagai cadangan
  - Jangan pernah menimpa `odor_impact_override` milik user saat import
- Update harga massal: import ulang hanya kolom harga, simpan `effective_date` baru, harga lama tetap tersimpan sebagai riwayat

### 13. Admin — Packaging — `/admin/packaging` (P2)

CRUD sederhana: nama item, biaya satuan, aktif/tidak.

---

## User Stories

**Mencatat & mereproduksi**
- Sebagai peracik, saya ingin mencatat dilusi tiap bahan, supaya formula bisa dibuat ulang persis enam bulan kemudian.
- Sebagai peracik, saya ingin menskalakan formula dari 5 g ke 50 g otomatis, supaya saya tidak salah hitung saat produksi.
- Sebagai peracik, saya ingin memakai accord yang sudah saya buat sebagai satu baris di formula lain, supaya saya tidak perlu menyalin 8 bahan setiap kali memakainya.
- Sebagai peracik, saya ingin mencatat FO sebagai komponen formula, bukan hanya sebagai angka di kalkulator HPP, supaya campuran "FO + accord + booster" tercatat utuh sebagai satu formula.

**Bekerja dengan FO**
- Sebagai peracik, saya ingin diberi tahu kalau porsi FO saya sudah turun di bawah 85%, supaya saya sadar sedang membuat parfum baru, bukan menyesuaikan bibit.
- Sebagai peracik, saya ingin diperingatkan saat menggabungkan dua FO beserta alasannya, supaya saya berhenti mengulangi percobaan yang hasilnya selalu bubur.
- Sebagai peracik, saya ingin tahu berapa persen formula yang benar-benar ikut dinilai kekuatannya, supaya saya tidak salah membaca angka saat bekerja dengan bibit jadi.

**Belajar**
- Sebagai peracik, saya ingin menduplikat versi lalu menghapus satu bahan, supaya saya tahu persis apa kontribusi bahan itu.
- Sebagai peracik, saya ingin melihat % kekuatan di samping % berat, supaya saya paham bahan mana yang sebenarnya mengendalikan formula.
- Sebagai peracik, saya ingin membandingkan tiga versi berdampingan beserta catatan penciumannya, supaya saya bisa menyimpulkan perubahan mana yang berhasil.
- Sebagai peracik, saya ingin diberi tahu kalau formula saya tidak punya bahan penyambung, supaya saya tidak menemukan transisinya patah setelah telanjur meracik.

**Menilai**
- Sebagai peracik, saya ingin mencatat apa yang tercium di menit 5, 30, 60, 180, dan 360, supaya saya punya rekaman perjalanan wanginya, bukan cuma kesan akhir.
- Sebagai peracik, saya ingin mencatat penilaian orang lain atas formula yang sama, supaya saya tidak tertipu oleh anosmia saya sendiri.
- Sebagai peracik, saya ingin melihat racikan mana yang sudah lama dicampur tapi belum dinilai, supaya tidak ada eksperimen yang terbuang.

**Berjualan**
- Sebagai pemilik brand, saya ingin menghitung HPP langsung dari formula, supaya harga jual saya tidak meleset.
- Sebagai pemilik brand, saya ingin mengekspor rincian HPP ke PDF, supaya bisa saya simpan dan bagikan.

**Mengelola**
- Sebagai admin, saya ingin mengimpor pricelist supplier dari CSV, supaya saya tidak mengetik 400 bahan satu per satu.
- Sebagai admin, saya ingin menimpa nilai impact bawaan supplier dengan angka saya sendiri beserta alasannya, supaya database ini perlahan jadi milik saya, bukan jiplakan supplier.
