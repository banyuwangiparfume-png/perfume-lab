# Fase 1 — Overview & Core Flow (PRD v2 · Kalkulator Aroma)

> PRD v2 ini mengembangkan aplikasi formula notebook dari PRD v1. Fokus barunya: **menyusun formula berbasis piramida top/mid/base**, dengan kalkulasi dilusi, pelacakan pelarut, harga per tier, chart dominasi aroma, dan saran bridger.
>
> Kalau v1 sudah dibangun, baca juga bagian "Migrasi dari v1" di file 03. Modul evaluasi dan maserasi dari v1 tetap dipakai, tidak diubah.

---

## 1. Problem Statement

Saat menyusun formula, perfumer pemula (dan menengah) berpikir dalam **piramida**: "top-nya 15%, mid 25%, base 60%, lalu isi bahannya." Tapi alat yang ada (Excel, catatan HP) memaksa dia menghitung semuanya manual:

1. **Bagi-bagi persen dan gram.** Tiap kali bahan ditambah ke satu tier, semua angka di tier itu harus dihitung ulang. Ganti ukuran batch dari 3 g ke 120 g, hitung ulang lagi.
2. **Dilusi bikin angka menipu.** Ambroxan 5% di formula tapi dipakai dalam bentuk 10% → yang masuk sebenarnya cuma 0,5%. Indole dari supplier sudah berbentuk "50 BB" → separuhnya Benzyl Benzoate. Tanpa dihitung, piramida "60% base" bisa ternyata cuma 45% bahan aktif.
3. **Pelarut menumpuk diam-diam.** Kalau formula sudah pakai BB 10% sebagai fixative, lalu Ambroxan dan Indole juga diencerkan dalam BB, total BB bisa 17% tanpa disadari. Itu mengubah karakter dan performa.
4. **Tidak tahu bahan mana yang akan mendominasi.** Persen berat tidak sama dengan kekuatan bau. Indole 5% bisa lebih "keras" daripada Hedione 20%.
5. **Bingung bridger-nya apa** saat menggabungkan bahan yang beda keluarga, atau saat transisi top → mid → base terasa putus.
6. **HPP formula dihitung manual** dan harga supplier beda per ukuran beli.

## 2. Target User

| Siapa | Ciri |
|---|---|
| **Pengguna utama:** Bayu (founder Banyu Wangi), solo | Paham dasar perfumery, RnD skala kecil (3–120 g), beli bahan di Ecofragrantica |
| **Nanti:** murid kelas parfum | Awam sampai menengah, butuh penjelasan di setiap angka (tooltip, empty state jelas) |

Database dirancang multi-user sejak awal (`owner_id` + RLS), walau v2 dipakai sendiri.

## 3. Posisi Produk — tetap sama dengan v1

Aplikasi ini **tidak bisa mencium**. Semua angka (kekuatan, dominasi aroma, skor bridger) adalah **perkiraan struktural** dari data supplier, bukan prediksi bau. Setiap panel analisa ditutup dengan kalimat yang mengembalikan keputusan ke hidung user. Jangan pernah menulis "formula ini bagus" — tulis "strukturnya sehat, sekarang cium dan nilai sendiri".

---

## 4. Core User Journey

Fase 1–4 dibangun **tanpa login**. Pakai satu user dummy (UUID tetap) supaya `owner_id` dan RLS tetap teruji.

### Journey A — Menyusun formula fragrance dari piramida (journey utama)

```
Dashboard
  -> + Formula baru
  -> Step 1: Info dasar
       nama, kategori = Fragrance, ukuran batch = 10 g
  -> Step 2: Piramida
       Top 15% · Mid 25% · Base 60%   (total wajib 100%)
       preview: Top 1,5 g · Mid 2,5 g · Base 6 g
  -> Step 3: Editor formula (3 kolom/kartu: Top, Mid, Base)
       Top  + Bergamot Oil   -> otomatis 15%  (1,5 g)
       Top  + Dihydromyrcenol -> dibagi rata: 7,5% + 7,5%
       User ubah Bergamot jadi 10% -> DHM otomatis 5% (tier tetap 15%)
       Mid  + Hedione, + Indole 50 BB
       Base + Iso E Super, + Ambroxan (dilusi 10% dalam BB), + Musk T, + Benzyl Benzoate
  -> Panel analisa live (kanan / bawah di mobile):
       • Pie dominasi aroma: Floral 20% · Citrus 17% · Animalic 12% · ...
       • Kekuatan per bahan: "Indole 5% berat tapi 26% kekuatan — paling dominan"
       • Piramida nyata: Base diset 60%, bahan aktif cuma 45,5% (sisanya pelarut)
       • Peringatan pelarut: "Benzyl Benzoate total 14,5% (+2,5% bawaan Indole 50 BB)"
       • HPP batch: Rp38.607 · Rp3.861/g (harga tier 10 g)
  -> Panel bridger:
       • "Top ↔ Mid renggang (41%)" -> saran: Nerol, Linalool, Neroli, Petitgrain, Citronellol
       • "Mid ↔ Base renggang (22%)" -> saran: Alpha Ionone, Beta Ionone, Hexyl Cinnamic Aldehyde, Vertenex
       • Klik "+ Tambah ke Mid" -> baris baru dengan dosis awal
       (angka di atas hasil hitung nyata dari data 2026, lihat fixture di file 03 §10)
  -> Simpan (jadi v1)
  -> Ubah ukuran batch ke 3 g untuk RnD -> semua gram & harga dihitung ulang
       (persen tidak berubah; harga pakai tier 10 g)
  -> Cetak lembar timbang
```

### Journey B — Membuat accord, lalu memakainya di formula lain

```
+ Formula baru
  -> kategori = Accord, mode piramida = OFF (satu daftar bahan)
  -> isi: Hedione 60%, Indole 50 BB 5%, Benzyl Salicylate 20%, ...
  -> simpan "Jasmine Accord" v1

+ Formula baru (Fragrance)
  -> di tier Mid, cari "Jasmine" -> muncul "Jasmine Accord (accord saya)"
  -> tambahkan 10%
  -> analisa membentangkan accord ke bahan-bahannya:
       kekuatan, pie, pelarut, dan HPP ikut menghitung isi accord
```

Formula berkategori **Fragrance tidak muncul** di daftar pilihan bahan. Hanya **Accord** yang muncul.

### Journey C — Update database harga dari Ecofragrantica

```
Admin -> Database Bahan -> Upload pricelist (.xlsx dari Ecofragrantica)
  -> sistem baca sheet daftar RM, tampilkan pratinjau:
       42 bahan baru · 118 harga berubah · 290 tidak berubah · 3 tidak ada lagi di file
  -> user cek, klik Terapkan
  -> harga lama disimpan sebagai riwayat; koreksi user (impact override, facet manual) tidak tertimpa
  -> formula yang belum dikunci otomatis memakai harga baru
```

### Journey D — Dari formula ke HPP produk (dari v1, disesuaikan)

```
Detail formula -> Hitung HPP produk
  -> pilih botol (35 ml, isi 30 ml)
  -> konsentrat = formula ini, 30%; ethanol 59%; aquades 3%; Polysorbate 20 2%; booster 6% (opsional)
  -> harga konsentrat per gram diambil otomatis dari formula
  -> tambah packaging -> HPP, kontribusi, margin
```

---

## 5. Konsep yang Wajib Dipahami Sebelum Ngoding

### 5.1 Piramida = target desain, bukan hasil

User menentukan Top/Mid/Base dalam persen. Tiap baris bahan ditaruh di salah satu tier. Total persen baris di satu tier harus sama dengan target tier itu.

Aplikasi juga menampilkan **piramida nyata**: persen bahan aktif per tier setelah dilusi dan pelarut dikeluarkan. Dua angka ini sering beda jauh, dan bedanya itulah informasi penting buat user.

Tier itu label penempatan, bukan fakta kimia. Bahan "top" yang sebenarnya awet tetap awet. Karena itu setiap bahan punya `note_tier_hint` (perkiraan dari family, bisa dikoreksi admin), dan app memberi peringatan lembut kalau, misalnya, Iso E Super ditaruh di Top.

### 5.2 Persen timbang vs persen aktif — dua lapis dilusi

Satu baris punya:
- **% timbang** — yang diinput user, porsi baris itu dari total formula
- **dilusi user** — user mengencerkan sendiri (misal Ambroxan 10% dalam BB)
- **dilusi supplier** — bahan sudah encer dari pabrik, terbaca dari nama ("Indole 50 BB" = 50% dalam BB, "Safranal 10-TEC" = 10% dalam TEC)

```
massa_produk  = % timbang × dilusi_user           -> dipakai untuk kekuatan & harga produk
massa_aktif   = massa_produk × dilusi_supplier    -> molekul murni, untuk info & IFRA
pelarut_user  = % timbang × (1 − dilusi_user)     -> masuk komposisi sebagai bahan pelarut
pelarut_bawaan= massa_produk × (1 − dilusi_supplier) -> dicatat, tidak dihitung ulang kekuatannya
```

**Kenapa kekuatan pakai massa produk, bukan massa aktif:** nilai impact dari Ecofragrantica menempel ke produk seperti yang dijual (Indole 50 BB punya impact 350 sendiri). Kalau dihitung dari massa aktif, kekuatannya jadi terhitung setengah. Asumsi ini ditulis di UI dan bisa diubah per bahan (`impact_basis`).

### 5.3 Pelarut adalah bahan

BB, TEC, DPG, IPM, ethanol adalah baris `raw_materials` biasa (kategori Solvent atau Fixative). Pelarut dari dilusi user ikut dijumlahkan dengan baris pelarut yang ditambahkan langsung. App menampilkan total per pelarut beserta asal-usulnya, dan memberi saran koreksi:

> Benzyl Benzoate total **14,5%** = 10% langsung + 4,5% dari dilusi Ambroxan. Ditambah 2,5% bawaan Indole 50 BB → **17% efektif**. Kalau target BB lo 10%, turunkan baris BB langsung jadi 3%.

Pelarut dari dilusi user **dihitung di tier tempat baris asalnya**, tapi tidak dihitung sebagai bahan aktif di piramida nyata.

### 5.4 Impact vs facet — dua hal berbeda

| | Impact | Facet |
|---|---|---|
| Menjawab | seberapa **keras** baunya per gram | baunya **ke arah mana** |
| Sumber | kolom Relative Odor Impact Ecofragrantica (100 = acuan) | dihitung dari teks Odour Profile |
| Contoh Bergamot | 100 | Citrus 94 · Floral 22 · Green 20 · Spicy 18 |

Angka facet adalah **komposisi karakter** bahan itu sendiri (dinormalisasi), bukan kekuatannya. Bergamot dan Hedione bisa sama-sama punya facet citrus, tapi kekuatannya beda.

### 5.5 Dari formula ke pie dominasi aroma

```
kekuatan_i = massa_produk_i × impact_i
share_facet_f = Σ_i  kekuatan_i × (facet_i[f] / Σ facet_i)
pie = share_facet dinormalisasi ke 100%, tampilkan 6 terbesar + "Lainnya"
```

Bahan tanpa impact → pakai 100 dan ditandai "impact belum ada". Bahan tanpa facet → tidak masuk pie, ditandai. Baris FO tidak punya impact maupun facet → dikeluarkan, dan pie menyebut "X% formula tidak ikut dihitung".

### 5.6 Harga ikut skala batch

Ecofragrantica punya 5 tier harga: 5, 10, 50, 100, 500 (g/ml). Aturan default:

```
tier = tier terbesar yang ≤ ukuran batch, minimal tier 10 g
  3 g   -> tier 10 g
  30 g  -> tier 10 g
  60 g  -> tier 50 g
  120 g -> tier 100 g
  600 g -> tier 500 g
```

Aturan ini disimpan sebagai setting (bisa diubah), dan bisa di-override per formula. Kalau harga di tier itu kosong, pakai tier terdekat yang lebih kecil (lebih mahal = konservatif), lalu tandai.

### 5.7 Kategori formula

- **Fragrance** — parfum utuh. Tidak bisa dipakai sebagai bahan formula lain.
- **Accord** — modul (jasmine accord, booster, base). Muncul di daftar bahan saat menyusun formula, dan dibentangkan saat dianalisa.

Bahan "accord" yang dibeli jadi dari Ecofragrantica (Base Rose, Single Notes, Specialty Accord) disimpan sebagai `raw_materials` biasa dengan kategori Accord/Base, bukan sebagai formula.

---

## 6. Goal & Success Metric MVP

| Metrik | Target |
|---|---|
| Waktu menyusun formula 8 bahan dari nol (piramida → simpan) | < 3 menit |
| Ganti ukuran batch → semua gram & harga benar | 100%, diverifikasi unit test |
| Formula tersimpan dengan dilusi tercatat | ≥ 20 dalam 1 bulan |
| Formula yang memakai minimal 1 accord buatan sendiri | ≥ 5 |
| Upload pricelist baru tanpa kehilangan koreksi user | 100% |
| Formula bisa dibuat ulang dari lembar timbang tanpa menebak | 100% |

## 7. Yang TIDAK Masuk v2

- Prediksi bau / AI yang "mencium"
- Data volatilitas atau umur bahan per jam (belum ada sumber data yang bisa dipercaya)
- Validasi IFRA otomatis (kolom disiapkan, logika belum)
- Manajemen stok botol / sisa gram
- Payment / langganan
- Kolaborasi real-time
- Aplikasi mobile native (web responsive saja)

## 8. Urutan Build

| Tahap | Isi | File |
|---|---|---|
| 1 | Setup repo GitHub, Next.js, Supabase, skema DB | 03 |
| 2 | Import pricelist Ecofragrantica + hitung facet + seed aturan bridger | 02, 03 |
| 3 | Editor formula piramida + lapisan kalkulasi + unit test | 02, 03 |
| 4 | Panel analisa: kekuatan, pie, piramida nyata, pelarut, HPP | 02, 03 |
| 5 | Saran bridger | 02, 03 |
| 6 | Accord sebagai bahan, versi, lembar timbang | 02 |
| 7 | Design polish + halaman admin | 04 |
| 8 | Auth + deploy Vercel | 05 |

**Lapisan kalkulasi (`lib/calc/`) dibangun dan dites sebelum UI-nya.** Semua angka di aplikasi turunan dari sana.
