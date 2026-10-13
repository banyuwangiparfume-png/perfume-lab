# Perfumer's Notebook

Catat formula parfum beserta **dilusinya**, lihat **kekuatan sebenarnya** tiap
bahan, dan rekam hasil penciuman tiap versi.

Yang dijanjikan aplikasi ini: **"formula kamu tidak akan bubur."**
Yang TIDAK dijanjikan: "parfum kamu akan wangi." Semua analisanya struktural —
jumlah bahan, sebaran fungsi, distribusi kekuatan. Formula bisa lolos semua
pemeriksaan dan tetap berbau tidak enak, karena selera dan harmoni tidak bisa
dihitung.

> **PRD v2 sedang berjalan.** Spesifikasi aktif ada di folder `PRD/`.
> Lima file `0X-*.md` di root adalah PRD v1 dan sudah ketinggalan — pakai
> `PRD/` sebagai acuan.
>
> v2 mengubah inti aplikasi: formula disusun dari **piramida top/mid/base**,
> **persen jadi sumber kebenaran** (gram turunan), dilusi jadi **dua lapis**
> (user + supplier), pelarut jadi bahan ber-FK, plus facet aroma dan saran
> bridger. Modul evaluasi dan maserasi dari v1 tetap dipakai apa adanya.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Bikin project Supabase

Buka [supabase.com/dashboard](https://supabase.com/dashboard) → New project →
region **Singapore** (paling dekat).

### 3. Jalankan migrasi

Di **SQL Editor**, tempel dan jalankan **berurutan**:

| Urutan | File |
|---|---|
| 1 | `supabase/migrations/0001_enums.sql` |
| 2 | `supabase/migrations/0002_core_tables.sql` |
| 3 | `supabase/migrations/0003_costing.sql` |
| 4 | `supabase/migrations/0004_rls.sql` |
| 5 | `supabase/migrations/0005_functions.sql` |
| 6 | `supabase/migrations/0006_auth_profile_trigger.sql` |
| 7 | `supabase/migrations/0007_v2_enums_and_alters.sql` |
| 8 | `supabase/migrations/0008_v2_tables.sql` |
| 9 | `supabase/migrations/0009_v2_rls.sql` |
| 10 | `supabase/seed/seed.sql` |
| 11 | `supabase/seed/facets.sql` |

`seed.sql` membuat user dummy di `auth.users` (tanpa password — tidak bisa
dipakai login, fungsinya hanya memegang kepemilikan data pengembangan) beserta
profilnya dan enam item packaging awal.

> Kalau insert ke `auth.users` ditolak, buat user lewat
> **Authentication → Users → Add user**, lalu ganti UUID di `seed.sql` **dan**
> `DEV_OWNER_ID` di `.env.local` dengan UUID user itu.

### 4. Isi environment

```bash
cp .env.example .env.local
```

URL dan key ada di **Project Settings → API**. Lalu restart dev server.

### 5. Jalankan

```bash
npm run dev
```

Selama `.env.local` belum terisi, aplikasi menampilkan layar setup yang
menyebutkan variabel mana yang masih kosong — bukan halaman error.

### 6. Isi master bahan

Buka **Admin → Raw material** lalu import pricelist supplier (CSV). Alurnya
empat langkah: upload → pemetaan kolom → validasi → konfirmasi.

Kolom yang dikenali:

```
name, synonym, cas_number, family, category, odour_profile,
function_category, odor_impact, tgsc_url,
price_5g, price_10g, price_50g, price_100g, price_500g
```

**Prioritaskan ~40 bahan yang benar-benar kamu punya lebih dulu**, bukan seluruh
katalog. Daftar kecil yang datanya bersih jauh lebih berguna daripada katalog
besar yang bolong — dan untuk murid kelas nanti, pilihan terbatas memang
disengaja.

Untuk coba-coba sebelum pricelist asli masuk, ada
`supabase/seed/materials.sample.csv` (8 bahan dari tabel contoh di PRD).
**Hapus 8 baris itu sebelum mengimpor pricelist asli** — kolom kategori fungsi
dan harganya memang kosong, jadi rules checker akan menyala wajar.

---

## Perintah

```bash
npm run dev          # dev server
npm run build        # production build (output: standalone)
npm start            # jalankan hasil build
npm test             # unit test lapisan kalkulasi
npm run test:watch   # test mode watch
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

---

## Empat konsep yang menentukan seluruh desain

### 1. Dilusi adalah data wajib

Formula menyimpan **berat seperti ditimbang** plus dilusi secara terpisah.
Berat murni adalah turunan:

```
berat_murni = berat_timbang × dilution_pct / 100
```

Semua perhitungan kekuatan dan harga memakai berat **murni**. Semua instruksi
penimbangan memakai berat **timbang**. Tertukarnya dua angka ini adalah sumber
bug paling berbahaya di aplikasi jenis ini.

### 2. Odor impact, baseline 100

Angka relatif kekuatan bau per satuan berat. 100 = bahan kategori Bridger.
Angka supplier **bucketed, bukan hasil pengukuran** — bagus untuk mendeteksi
kelebihan dosis, tidak untuk presisi. Karena itu tiap bahan punya kolom
`odor_impact_override` plus alasannya, dan import ulang **tidak pernah**
menimpa kolom itu.

### 3. Tiga jenis baris formula

| Jenis | Isi bahannya | Punya impact? |
|---|---|---|
| `raw_material` | 1 molekul | ya |
| `fo` | tidak diketahui, biasanya 30–80 bahan | **tidak, dan tidak akan pernah** |
| `sub_formula` | diketahui, tercatat di app | ya, dihitung dari penyusunnya |

Baris FO **dikeluarkan** dari % kekuatan tapi tetap dihitung berat dan
biayanya, dan app menyebutkan berapa persen formula yang sebenarnya ikut
dinilai (`strengthBasis`). Tabel `fragrance_oils` tidak punya kolom
`odor_impact` — jangan pernah ditambahkan.

### 4. Versi tidak diubah setelah dievaluasi

Begitu sebuah versi punya evaluasi, perubahan harus membuat versi baru. Kalau
tidak, catatan penciuman jadi menggantung ke formula yang sudah berbeda.
Dipaksa di dua tempat: server action dan RPC `save_formula_lines`.

### 5. Dua tanggal, bukan satu

Praktik lab memisahkan dua masa istirahat yang tujuannya berbeda:

| Tahap | Dari | Durasi | Tujuan |
|---|---|---|---|
| Oil phase rest | `mixed_at` | 24–48 jam | bahan larut sempurna antar sesamanya sebelum ketemu ethanol |
| Maserasi | `diluted_at` | 2–4 minggu | alcohol bite turun, kristal larut, larutan stabil |

**Umur maserasi SELALU dihitung dari `diluted_at`, tidak pernah dari
`mixed_at`.** Kalau salah pakai, angkanya selalu kelebihan beberapa hari dan
perbandingan antar versi jadi menyesatkan tanpa ada yang sadar. Rumusnya ada di
`lib/lab.ts`, dan ada test khusus yang menjaganya.

Constraint `dilute_after_mix` menolak tanggal pengenceran yang lebih awal dari
tanggal pencampuran.

### 6. Screening vs final

Dua jenis penilaian yang tidak boleh dicampur:

| | `screening` | `final` |
|---|---|---|
| Kapan | oil rest 24 jam, encerkan, cium setelah ~48 jam | setelah maserasi penuh 2–4 minggu |
| Untuk apa | menyaring kandidat, membandingkan A vs B | memutuskan produk siap dijual |
| Syarat sahnya | semua sampel diperlakukan **identik** | kondisinya sama dengan yang diterima pembeli |

Maserasi penuh per versi akan membatasi pembelajaran jadi beberapa putaran
setahun. Perbandingan terkontrol tidak butuh kondisi sempurna — butuh kondisi
**identik**. Jadi penyaringan awal boleh cepat, asal semua sampel diperlakukan
sama. Yang perlu disadari: urutan juara bisa berubah setelah maserasi penuh,
jadi keputusan akhir tetap menunggu evaluasi `final`.

**Rule 8** (`lib/rules/compare.ts`) memeriksa apakah dua evaluasi layak
dibandingkan sama sekali, dan hasilnya ditempel **di atas** tabel compare.
Tabel yang terlihat rapi tapi datanya dari kondisi berbeda lebih berbahaya
daripada tidak punya tabel: user akan menarik kesimpulan dengan percaya diri
dari perbandingan yang tidak sah.

---

## Struktur

```
app/
  actions/        server action (mutasi)
  materials/ fo/ formulas/ evaluations/ admin/
components/
  formula/        editor, tabel kekuatan, chart, rules panel
  evaluation/     timeline input, descriptor tags
  materials/ fo/ shared/ ui/
lib/
  calc/           FUNGSI MURNI — formula, expand, cycle, scale, pricing, format
  rules/          rules checker + Rule 8 (compare) + thresholds
  lab.ts          FUNGSI MURNI — oil rest, maserasi, tahap lab, kode buta
  data/           pembacaan database (server-only)
  supabase/       klien + tipe skema
  csv/            parser pricelist
supabase/
  migrations/     0001–0006
  seed/           seed.sql + materials.sample.csv
```

**`lib/calc/` dan `lib/rules/` tidak boleh menyentuh database.** Itu yang
membuat panel kalkulasi live di editor memakai rumus yang sama persis dengan
yang dipakai server — tidak ada perhitungan kedua yang bisa berbeda diam-diam.
Pintu masuknya satu: `analyze()` di `lib/calc/analyze.ts`, yang memastikan
rules selalu berjalan di atas daftar yang sudah dibentangkan.

Ambang batas rules ada di satu file: `lib/rules/thresholds.ts`. Setelah 20–30
formula dengan catatan penciuman, cek korelasinya — apakah formula yang dinilai
"bubur" di evaluasi memang yang melanggar Rule 3? Kalau tidak, ambangnya yang
salah, bukan usernya.

### Catatan pembacaan vs mutasi

PRD menaruh fungsi `list*`/`get*` di `app/actions/`. Di repo ini fungsi
pembacaan ditaruh di `lib/data/` dengan nama yang sama, dan `app/actions/` hanya
berisi mutasi. Alasannya: tiap export di modul `"use server"` jadi endpoint HTTP
yang bisa dipanggil dari luar, dan pembacaan untuk Server Component tidak perlu
itu.

---

## Status

### PRD v2 — sudah jalan

- Skema v2 (migrasi 0007–0009): piramida, dua lapis dilusi, pelarut ber-FK,
  facet, aturan bridger, stok, riwayat import, settings
- **Lapisan kalkulasi `lib/calc/` lengkap dan terbukti** — 150 test, termasuk
  `seed/calc-fixture-01.json` yang mereproduksi persis seluruh rantai:
  alokasi persen, dilusi dua lapis, pembentangan accord, kekuatan, pelarut,
  piramida nyata, pie aroma, HPP, dan saran bridger
- `facetize` mereproduksi 410 dari 413 bahan acuan dalam toleransi 0,01

### PRD v2 — belum

- Seluruh UI v2: wizard piramida, editor tier, panel analisa, panel bridger,
  lembar timbang, halaman admin
- Import pricelist `.xlsx` (butuh file `Pricelist_Ecofragrantica_2026.xlsx`)
- Store editor (Zustand) dan autosave draf
- Auth dan deploy

### Warisan v1

Modul evaluasi dan maserasi tetap dipakai utuh: antrean lab, screening vs
final, kode buta, Rule 8, compare versi.

Layar formula v1 (editor berbasis gram, detail, compare) **tidak akan cocok
dengan skema v2** setelah migrasi 0007 dijalankan — kolom `weight_g` tidak
lagi jadi sumber kebenaran dan RPC v1 dilepas. Layar itu dibangun ulang di
tahap berikutnya. Kalkulasi v1 dipindahkan ke `lib/legacy/calc/` supaya repo
tetap bisa di-build sementara itu.


---

## Sebelum dibuka ke jaringan

Aplikasi ini **belum punya autentikasi**. `lib/supabase/db.ts` memakai
service-role key dan melewati RLS, dan `/admin/*` belum dijaga apa pun.
Jalankan hanya di localhost sampai fase auth selesai.

**Backup sejak hari pertama.** Ratusan formula dengan catatan penciuman tidak
bisa dibuat ulang kalau hilang, dan tidak bisa di-scrape dari mana pun. Supabase
free tier tidak menyimpan backup otomatis yang panjang — buat cron mingguan
`pg_dump` ke penyimpanan lain, dan **uji restore-nya minimal sekali**.
