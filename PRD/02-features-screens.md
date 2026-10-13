# Fase 2 — Fitur & Screen (PRD v2)

> Lanjutan file 01. Semua screen MVP, perilaku editor piramida secara detail, isi panel analisa, dan user stories.

---

## Peta Navigasi

```
Navbar: Dashboard · Formula · Bahan · HPP · Admin

/                         Dashboard
/formulas                 Daftar formula (tab: Fragrance | Accord)
/formulas/new             Wizard formula baru (step 1 info, step 2 piramida)
/formulas/[id]            Detail formula (versi, ringkasan, aksi)
/formulas/[id]/edit       EDITOR FORMULA  <- screen terpenting
/formulas/[id]/weigh      Lembar timbang (print-friendly)
/materials                Daftar bahan
/materials/[id]           Detail bahan (facet, impact, harga per tier, catatan)
/costing                  HPP produk (dari v1)
/admin/import             Upload pricelist Ecofragrantica
/admin/materials          Kelola bahan (edit, override, facet manual)
/admin/bridge-rules       Aturan jembatan
/admin/settings           Aturan tier harga, ambang peringatan
```

Modul evaluasi v1 (`/evaluations/...`, compare versi) tetap ada dan ditautkan dari Detail Formula. Tidak diubah di v2.

---

## P0 — Screen Inti

### 1. Dashboard — `/`

**Fungsi:** titik masuk cepat.

- Tombol CTA **+ Formula baru**
- Kartu "Terakhir diedit" (5 formula) — nama, kategori, batch, HPP/g, mini pie 3 facet teratas
- Kartu "Accord saya" (jumlah + 3 terbaru)
- Kartu status database: "Pricelist terakhir diupload 26 Apr 2026 · 459 bahan" + link ke `/admin/import`
- **Empty state** (belum ada formula): ilustrasi sederhana + "Mulai dari piramida: tentukan top, mid, base, lalu isi bahannya." + CTA

### 2. Daftar Formula — `/formulas`

- Tab **Fragrance | Accord**, pencarian nama, urut terakhir diedit
- Kolom: nama · kategori · versi terakhir · batch · jumlah bahan · HPP/g · facet dominan · diperbarui
- Aksi per baris: buka, duplikat, arsipkan
- Empty state per tab, beda copy: Accord → "Accord yang lo simpan di sini akan muncul sebagai pilihan bahan saat menyusun formula."

### 3. Wizard Formula Baru — `/formulas/new`

Dua langkah, satu halaman dengan stepper.

**Step 1 — Info dasar**
| Field | Keterangan |
|---|---|
| Nama | wajib |
| Kategori | `Fragrance` / `Accord` — tooltip menjelaskan bedanya (lihat file 01 §5.7) |
| Ukuran batch (g) | default 10, preset cepat: 3 · 10 · 30 · 50 · 100 |
| Mode piramida | ON (default untuk Fragrance) / OFF (default untuk Accord) |
| Target family | opsional: Floral, Woody, Oriental, Fresh, Gourmand, Spicy, Leather, Aquatic |
| Deskripsi | opsional |

**Step 2 — Piramida** (dilewati kalau mode piramida OFF)
- Tiga input persen: Top, Mid, Base. Preset: `15/25/60` · `20/30/50` · `10/30/60` · `25/35/40`
- Indikator total: hijau kalau 100%, merah kalau tidak, plus "kurang 5%" / "lebih 3%"
- Preview gram per tier langsung (dari ukuran batch)
- Visual piramida kecil (3 lapis, lebar sesuai persen)
- Tombol **Lanjut ke editor** aktif hanya kalau total 100%

Submit → buat `formulas` + `formula_versions` v1 (status draft) → redirect ke editor.

---

### 4. Editor Formula — `/formulas/[id]/edit`

Layout desktop: **kiri 60%** = kartu tier, **kanan 40%** = panel analisa (sticky). Mobile: kartu tier di atas, panel analisa jadi tab di bawah.

#### 4.1 Header editor
- Nama formula (inline edit), badge kategori, versi aktif
- **Ukuran batch** (input g) — mengubahnya hanya menghitung ulang gram & harga, persen tetap
- **Badge tier harga**: "Harga: tier 10 g" + menu kecil untuk override per formula
- **Piramida ringkas**: `Top 15 · Mid 25 · Base 60` — klik untuk ubah target tier
- Tombol: **Simpan versi** (CTA), Lembar timbang, ⋯ (duplikat, ubah kategori, arsip)
- Status simpan: "Draf tersimpan otomatis 10:42" (autosave draf tiap 2 detik setelah berhenti mengetik; "Simpan versi" membuat versi permanen)

#### 4.2 Kartu tier (Top / Mid / Base, atau satu kartu "Bahan" kalau piramida OFF)

Header kartu:
```
TOP · target 15%  ·  1,500 g                [ Atur rasio ]  [ Ratakan ]
terisi 15,00%  ✓
```
Kalau total baris ≠ target: badge kuning `terisi 16,00% · +1,00%` dengan dua aksi: **Normalisasi ke 15%** dan **Jadikan target 16%**.

Tiap baris bahan:
```
[🔓] Bergamot Oil Italy FCF          [ 10,000 ]%   1,000 g   Rp12.800
     Citrus · impact 100 · Bridger    dilusi 100% ▾          kekuatan 14,7%
```
| Elemen | Perilaku |
|---|---|
| Ikon gembok | 🔓 = ikut dibagi otomatis, 🔒 = angka dipatok user. Otomatis jadi 🔒 saat user mengetik persen. Klik untuk buka lagi. |
| Input % | % timbang dari **total formula** (bukan dari tier). 3 desimal. |
| Gram | turunan, read-only, 3 desimal |
| Dilusi ▾ | popover: dilusi user (%) + pelarut (pilih dari bahan kategori Solvent/Fixative: BB, TEC, DPG, IPM, Ethanol). Kalau bahan sudah encer dari supplier, tampilkan info read-only: "Bawaan supplier: 50% dalam BB". |
| Harga | biaya baris di batch ini (tier aktif) |
| Kekuatan | % kekuatan baris ini |
| Menu ⋯ | pindah ke tier lain, hapus, lihat detail bahan |

Baris accord menampilkan badge `ACCORD · 6 bahan` dan bisa di-expand untuk melihat isinya (read-only, persen sudah dikalikan).

Tombol **+ Tambah bahan** di bawah tiap kartu membuka `MaterialPicker` (file 04 §2.3).

#### 4.3 Aturan pembagian persen — WAJIB persis begini

Semua aturan berlaku **per tier**. Implementasi sebagai fungsi murni `allocateTier()` di `lib/calc/allocate.ts` (file 03 §4.2).

1. **Tambah bahan** → baris baru 🔓. Sisa = target tier − Σ baris 🔒. Sisa dibagi rata ke semua baris 🔓.
   - Top 15%, tambah Bergamot → 15%. Tambah DHM → 7,5% + 7,5%.
2. **Edit persen satu baris** → baris itu jadi 🔒. Baris 🔓 lainnya dibagi ulang dari sisa.
   - Bergamot diketik 10 → DHM jadi 5.
3. **Sisa negatif** (Σ 🔒 > target) → baris 🔓 jadi 0, tampilkan badge kelebihan. Tidak pernah ada persen negatif.
4. **Semua baris 🔒** → tidak ada yang otomatis berubah. Kalau total ≠ target, tampilkan badge + aksi (Normalisasi / Jadikan target).
5. **Normalisasi** → semua baris tier dikali `target / total`, semuanya 🔒.
6. **Hapus baris** → baris 🔓 sisanya dibagi ulang.
7. **Pindah baris ke tier lain** → baris dibawa dengan persennya (🔒), kedua tier dihitung ulang dengan aturan 1–4.
8. **Ubah target tier** (misal Top 15 → 20) → semua baris di tier itu dikali `20/15`, gembok tidak berubah. Total piramida jadi 105% → banner merah di header sampai user menyesuaikan tier lain. Tombol bantu: "Kurangi Base jadi 55%".
9. **Atur rasio** → dialog berisi semua baris tier dengan input rasio (default dari persen sekarang). User ketik `10 : 5` → persen = target × rasio / Σ rasio. Semua baris jadi 🔒.
10. **Ratakan** → semua baris tier jadi 🔓 dan dibagi rata.
11. **Mode piramida OFF** → satu tier bernama `all` dengan target 100%. Aturan sama persis.

Pembulatan: simpan persen dengan 5 desimal, tampilkan 3. Sisa pembulatan pembagian rata diberikan ke baris 🔓 terakhir supaya total tepat sama dengan target.

#### 4.4 Panel analisa (kanan)

Tab: **Ringkasan · Aroma · Kekuatan · Pelarut · HPP · Bridger**. Semua dihitung live di client dari fungsi `lib/calc/` yang sama dengan server.

**Ringkasan**
- Daftar peringatan dari rule engine (§4.5), diurutkan: merah → kuning → info
- 4 stat tile: Jumlah bahan (dibentangkan) · Bahan aktif % · HPP/g · Facet dominan
- Kalimat penutup tetap: "Ini perkiraan struktural dari data supplier. Cium dan nilai sendiri."

**Aroma** — chart pie (donut)
- 6 facet terbesar + "Lainnya", warna facet tetap (file 04 §1.6)
- Legenda dengan persen; hover/tap irisan → daftar bahan penyumbang facet itu
- Toggle **Semua · Top · Mid · Base** → pie per tier (berguna untuk lihat apakah top-nya benar-benar citrus)
- Catatan otomatis kalau ada bahan tanpa facet/impact, atau ada FO yang dikeluarkan

**Kekuatan**
- `StrengthChart` dari v1: dua batang per bahan (% timbang abu-abu, % kekuatan berwarna)
- Bahan dari accord ditampilkan dibentangkan, dengan label asal "via Jasmine Accord"
- Diurutkan dari kekuatan terbesar

**Piramida nyata** (bagian dari tab Kekuatan)
- Tiga batang horizontal per tier: target · % timbang terisi · % aktif (tanpa pelarut)
- Contoh: `Base: target 60 · terisi 60 · aktif 45,5`

**Pelarut**
- Tabel per pelarut: total eksplisit, rincian asal (langsung / dilusi baris X / dari accord Y), bawaan supplier, total efektif
- Kalimat saran koreksi (contoh di file 01 §5.3) + tombol **Terapkan saran** yang mengubah persen baris pelarut langsung
- Total semua pelarut sebagai % formula

**HPP**
- Tier harga aktif + alasannya ("batch 10 g → tier 10 g")
- Tabel biaya per bahan (dibentangkan), kontribusi %, harga/g yang dipakai, ikon ⚠ kalau harga diambil dari tier fallback
- Total batch, per gram, per 100 g
- Tombol **Hitung HPP produk** → `/costing?formula_version=...`

**Bridger** — lihat §4.6

#### 4.5 Rule engine (peringatan)

| Kode | Kondisi | Level | Pesan contoh |
|---|---|---|---|
| R1 | Total baris tier ≠ target (selisih > 0,01) | kuning | "Top terisi 16% dari target 15%." |
| R2 | Total target piramida ≠ 100 | merah | "Piramida 105%. Kurangi salah satu tier." |
| R3 | Satu pelarut datang dari ≥ 2 sumber | kuning | "Benzyl Benzoate dari 3 sumber, total efektif 17%." |
| R4 | Satu pelarut > 10% atau total pelarut > 25% (ambang di settings) | kuning | "Pelarut total 30% — performa bisa turun." |
| R5 | % kekuatan bahan ≥ 20% **dan** ≥ 3× % timbangnya | info | "Indole 5% berat tapi 26% kekuatan — paling dominan." |
| R6 | Ada bahan tanpa impact | info | "2 bahan belum punya impact, dihitung sebagai 100." |
| R7 | `note_tier_hint` bahan ≠ tier penempatan | info | "Iso E Super biasanya base, sekarang di Top." |
| R8 | Selisih % aktif vs target tier > 10 poin | kuning | "Base aktif cuma 45,5% dari target 60%." |
| R9 | Ada FO | info | "FO 30% tidak ikut dihitung di kekuatan & aroma." |
| R10 | Harga pakai tier fallback | info | "3 bahan tidak punya harga tier 10 g, pakai tier 5 g." |
| R11 | Bahan sama muncul langsung + dari accord | info | "Hedione ada langsung (20%) dan di Jasmine Accord (+6%)." |
| R12 | Kedalaman accord > 3 atau ada siklus | merah (blok simpan) | "Accord A memakai B yang memakai A." |

#### 4.6 Panel Bridger

Dua bagian:

**A. Antar tier** — `Top ↔ Mid`, `Mid ↔ Base` (dan `Top ↔ Base` disembunyikan di bawah "lihat lagi")
- Vektor facet tiap tier = jumlah facet bahan di tier itu, dibobot kekuatan
- Status: **Nyambung** (≥ 0,45) · **Renggang** (0,20–0,45) · **Jurang** (< 0,20), tampil dengan persen
- Untuk Renggang/Jurang: 5 saran bridger, tiap saran berisi nama, alasan (catatan aturan atau "nyambung ke Top lewat sisi Citrus, ke Mid lewat sisi Floral"), badge sumber (`aturan temen`/`klasik`/`saya`), kategori fungsi + impact, harga/g, badge "ada di stok"
- Tombol **+ Tambah ke Mid** — tier tujuan default: transisi Top↔Mid → Mid, Mid↔Base → Mid kalau `note_tier_hint` bahan = mid, selain itu Base. Dosis awal: 1% kalau impact ≤ 150, 0,5% kalau lebih.

**B. Dalam tier** — pasangan bahan di tier yang sama (maksimal 15 pasangan terlemah ditampilkan)
- Sama seperti Bridge Finder: status per pasangan + saran untuk yang bukan Nyambung
- Tombol tambah langsung ke tier itu

Filter **Hanya stok saya** (tabel `user_stock`, tandai stok dengan ☆ di mana pun bahan tampil).

Kalimat tetap di bawah panel: "Satu celah, satu bridger. Mulai dosis kecil, naikkan sampai sambungannya halus — bukan sampai bridger-nya kecium sendiri."

---

### 5. Detail Formula — `/formulas/[id]`

- Header: nama, kategori, versi aktif, batch default, tombol Edit (CTA), Lembar timbang, Hitung HPP, Duplikat
- Ringkasan read-only: piramida, tabel bahan (tier, %, gram, dilusi), mini pie, HPP/g
- **Riwayat versi**: daftar v1, v2, ... dengan `change_note`, tanggal, tombol "Buka" / "Jadikan dasar versi baru"
- Bagian evaluasi dari v1 (status mixed/diluted, daftar evaluasi)
- Untuk Accord: "Dipakai di 3 formula" + daftarnya

### 6. Lembar Timbang — `/formulas/[id]/weigh?batch=3`

- Input ukuran batch di atas (default batch formula)
- Tabel urut tier (Base dulu → Mid → Top, karena urutan menimbang yang umum: bahan berat & kental dulu, citrus terakhir supaya tidak lama terpapar udara)
- Kolom: centang · bahan · bentuk (neat / "10% dalam BB" / "bawaan 50 BB") · gram timbang (3 desimal) · kumulatif
- Accord ditampilkan sebagai satu baris (karena ditimbang dari botol accord), dengan catatan isi di bawahnya
- Print stylesheet: hitam putih, tanpa navbar
- Catatan: "Timbangan 0,01 g: bahan di bawah 0,05 g sebaiknya dibuat dilusi dulu." Baris yang gramnya < 0,05 g diberi ikon ⚠.

### 7. Daftar Bahan — `/materials`

- TanStack Table, pencarian nama/sinonim/CAS, filter: kategori, family, kategori fungsi, facet, tier hint, "punya impact", "stok saya"
- Kolom: ☆ · nama · kategori · family · fungsi · impact · 3 facet teratas · harga/g (tier default) · dilusi supplier
- Klik → detail

### 8. Detail Bahan — `/materials/[id]`

- Nama, sinonim, CAS, family, kategori, kategori fungsi, `ImpactBadge` (dengan override bila ada), link TGSC
- **Profil facet**: bar horizontal per facet (seperti "Citrus 94 · Floral 22 · Green 20 · Spicy 18") + teks odour profile asli. Tooltip: "Ini arah karakter bahan, bukan kekuatannya."
- Harga semua tier (5/10/50/100/500) + harga/g tiap tier + riwayat harga (tanggal upload)
- Dilusi supplier, tier hint, catatan pribadi
- "Bahan yang sering jadi jembatannya" — 5 bahan dengan kemiripan facet tertinggi di kedua arah (opsional P1)
- Dipakai di formula apa saja

### 9. HPP Produk — `/costing`

Dari v1, satu perubahan: sumber konsentrat bisa dipilih dari **versi formula** (harga/g otomatis dari kalkulasi formula pada tier yang dipilih) atau FO manual seperti v1. Komponen lain (booster, ethanol, aquades, Polysorbate 20, packaging, margin HET & net) tetap.

---

## P0 — Admin

Detail tampilan di file 04 §4. Ringkasnya:

### 10. Upload Pricelist — `/admin/import`
Upload `.xlsx` Ecofragrantica → pratinjau perubahan → terapkan. Aturan parsing di file 03 §6.

### 11. Kelola Bahan — `/admin/materials`
Edit field bahan, override impact (wajib alasan), edit facet manual (tandai `facets_manual`), set tier hint, tambah bahan manual (supplier lain), nonaktifkan.

### 12. Aturan Jembatan — `/admin/bridge-rules`
CRUD aturan: bahan · facet A · facet B · catatan · sumber. Seed dari `seed/seed-bridge-rules.csv`.

### 13. Setting — `/admin/settings`
- Aturan tier harga: daftar ambang (default: `<50 → 10`, `<100 → 50`, `<500 → 100`, `≥500 → 500`)
- Ambang status bridger (0,45 / 0,20), ambang R4 (10% / 25%), ambang R5 (20% & 3×)
- Pelarut yang dikenali dari nama supplier (TEC, BB, DPG, IPM, Etha/Ethanol, Castor) dan pemetaannya ke bahan

---

## User Stories

**Menyusun formula**
- Sebagai perfumer, saya ingin menentukan persen top/mid/base dulu, supaya struktur parfum saya terencana sebelum memilih bahan.
- Sebagai perfumer, saya ingin bahan yang saya tambahkan ke satu tier otomatis dibagi rata, supaya tidak menghitung manual.
- Sebagai perfumer, saya ingin mengunci persen satu bahan dan membiarkan sisanya menyesuaikan, supaya bisa mengatur rasio tanpa merusak total tier.
- Sebagai perfumer, saya ingin mengetik rasio seperti 10:5, supaya cepat mengatur perbandingan.
- Sebagai perfumer, saya ingin mengganti ukuran batch dari 3 g ke 120 g tanpa mengubah persen, supaya RnD kecil dan produksi memakai resep yang sama.

**Dilusi & pelarut**
- Sebagai perfumer, saya ingin mencatat dilusi tiap bahan, supaya tahu persen bahan aktif yang sebenarnya.
- Sebagai perfumer, saya ingin diberi tahu total Benzyl Benzoate dari semua sumber, supaya bisa menyesuaikan baris BB langsung.

**Analisa**
- Sebagai perfumer, saya ingin melihat pie dominasi aroma, supaya tahu parfum ini kira-kira akan dominan ke arah mana.
- Sebagai perfumer, saya ingin melihat bahan yang kekuatannya jauh melebihi porsinya, supaya bisa menurunkan dosisnya sebelum menimbang.
- Sebagai perfumer, saya ingin saran bridger antar tier dan antar bahan, supaya transisinya tidak putus.

**Harga & data**
- Sebagai pemilik brand, saya ingin HPP formula dihitung otomatis dengan harga yang sesuai ukuran beli, supaya angka modal realistis.
- Sebagai admin, saya ingin upload pricelist Ecofragrantica terbaru, supaya harga selalu update tanpa input manual.
- Sebagai admin, saya ingin koreksi impact dan facet saya tidak hilang saat upload ulang, supaya hasil belajar saya aman.

**Accord**
- Sebagai perfumer, saya ingin menyimpan formula sebagai Accord, supaya bisa dipakai lagi sebagai bahan di formula lain.
- Sebagai perfumer, saya ingin isi accord ikut dihitung di analisa formula induk, supaya kekuatan, pelarut, dan HPP tetap akurat.
