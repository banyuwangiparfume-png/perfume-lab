# Perfumer's Notebook — catatan kerja

Kalkulator formula parfum: piramida top/mid/base, dilusi dua lapis, facet
aroma, saran bridger, dan HPP.

## Acuan

**Spesifikasi aktif ada di folder `PRD/` (PRD v2).** Lima file `0X-*.md` di root
adalah PRD v1 dan sudah ketinggalan — jangan dipakai.

Modul evaluasi dan maserasi dari v1 tetap dipakai utuh dan tidak diubah di v2.

## Perintah

```bash
npm run dev          # dev server
npm test             # unit test lib/calc/ — WAJIB hijau sebelum commit
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build — WAJIB sukses sebelum commit
```

## Aturan yang tidak boleh dilanggar

### 1. Semua rumus di `lib/calc/`, dan wajib ada test-nya

Tidak ada perhitungan di komponen React, di server action, atau di SQL. Semua
fungsi di `lib/calc/` adalah fungsi murni tanpa akses database, supaya panel
kalkulasi live di editor memakai rumus yang sama persis dengan yang dipakai
server — tidak ada perhitungan kedua yang bisa berbeda diam-diam.

Pintu masuknya satu: `analyze()` di `lib/calc/analyze.ts`.

### 2. `seed/calc-fixture-01.json` adalah acuan kebenaran

Fixture itu berisi satu formula contoh beserta seluruh angka yang diharapkan,
dan angkanya dihitung terpisah dari implementasi ini. **Kalau test fixture
gagal, yang salah hampir pasti kodenya — bukan fixture-nya.**

Jangan pernah mengubah angka di fixture supaya test lewat.

### 3. Jangan ubah skema tanpa file migrasi

Semua perubahan skema lewat file baru di `supabase/migrations/`. Jangan ubah
lewat dashboard Supabase — repo harus tetap jadi sumber kebenaran, dan migrasi
yang hanya ada di dashboard akan hilang saat deploy ke lingkungan lain.

### 4. Persen adalah sumber kebenaran, gram adalah turunan

Berubah dari v1. Aplikasi ini sering mengganti skala batch (3 g ↔ 120 g);
menyimpan gram memaksa konversi ulang tiap kali dan merusak reproduksi formula.

`gram = pct / 100 × batch_g`. Jangan simpan gram di database.

### 5. Dua lapis dilusi, jangan digabung

- `user_dilution_pct` di `formula_lines` — user yang mengencerkan sendiri
- `supplier_dilution_pct` di `raw_materials` — sudah encer dari pabrik,
  dibaca dari nama produk ("Indole 50 BB" = 50% dalam Benzyl Benzoate)

`productPct` = bentuk yang dibeli, dipakai untuk **kekuatan dan harga**.
`activePct` = molekul murni, dipakai untuk **piramida nyata dan IFRA**.

Tertukarnya dua angka ini adalah sumber bug paling berbahaya di aplikasi ini.

### 6. Data supplier dan koreksi user di kolom berbeda

Import pricelist hanya menyentuh kolom supplier. `odor_impact_override`,
`odor_impact_note`, facet manual, tier hint, dan catatan pribadi tidak pernah
ditimpa.

## Nada tulisan di UI

Bahasa Indonesia kasual; istilah perfumery tetap Inggris (Top, Mid, Base,
Fixative, Bridger, accord, drydown).

Peringatan memberi informasi, bukan menghakimi: "Indole kemungkinan akan
mendominasi", bukan "formula kamu salah". Setiap panel analisa ditutup dengan
kalimat yang mengembalikan keputusan ke hidung user — jangan pernah menulis
"formula ini bagus".

Impact kosong tampil `—`, tidak pernah `0`.

## Struktur

```
lib/calc/        FUNGSI MURNI — allocate, expand, strength, aroma, solvents,
                 price, cost, bridge, facetize, rules, analyze
lib/legacy/calc/ kalkulasi v1 berbasis gram; dipakai layar formula lama sampai
                 layar v2 selesai dibangun
lib/data/        pembacaan database (server-only)
app/actions/     server action (mutasi)
seed/            bridge-db.json · facet-keywords.json · calc-fixture-01.json
supabase/        migrations/ + seed/
```
