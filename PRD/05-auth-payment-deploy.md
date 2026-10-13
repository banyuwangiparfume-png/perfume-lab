# Fase 5 — Auth, Deploy & Checklist Launch (PRD v2)

> Fase terakhir. Jalankan setelah fase 1–4 jalan tanpa login.
> **Tidak ada payment di v2** — aplikasi dipakai sendiri.

---

## 1. Repo & Alur Kerja (siapkan di awal, sebelum fase 1)

1. Buat repo GitHub private, misal `banyu-formula-lab`
2. `npx create-next-app@latest` (TypeScript, Tailwind, App Router, ESLint), push ke `main`
3. Buat project Supabase (region Singapore), simpan URL + anon key + service role key
4. Pasang Supabase CLI, `supabase init`, semua perubahan skema lewat file di `supabase/migrations/` — **jangan ubah skema lewat dashboard** supaya repo tetap jadi sumber kebenaran
5. Hubungkan repo ke Vercel → tiap push ke branch dapat Preview URL, `main` = Production
6. Taruh folder `seed/` (facet-keywords.json, seed-bridge-rules.csv, calc-fixture-01.json, bridge-db.json) di root repo
7. Tambahkan `CLAUDE.md` di root berisi: ringkasan PRD, perintah test (`npm run test`), aturan "semua rumus di `lib/calc/`, wajib ada test", dan "jangan ubah skema tanpa file migrasi"

Alur kerja dengan Claude Code: satu branch per tahap build (file 01 §8), minta Claude Code menjalankan `npm run test` + `npm run build` sebelum commit, review di Preview URL Vercel, merge ke `main`.

---

## 2. Auth — Email/Password + Google

Sama dengan PRD v1 §1, ringkasnya:

### 2.1 Yang sudah siap sejak fase 1
Semua tabel punya `owner_id`, RLS aktif berbasis `auth.uid()`, tabel `profiles` ada, satu profil dummy `DEV_OWNER_ID` (role admin).

### 2.2 Langkah
1. **Supabase → Authentication → Providers**: Email/Password (konfirmasi email aktif di produksi) dan Google OAuth (Client ID/Secret dari Google Cloud Console; redirect `https://<ref>.supabase.co/auth/v1/callback`; authorized origins = domain Vercel preview + produksi). Tambahkan juga URL Vercel ke *Redirect URLs* di Supabase Auth settings.
2. **Trigger `handle_new_user`** → insert `profiles` (role `user`) + insert `app_settings` default.
3. **Halaman**: `/login` (email+password, tombol Google), `/register`, `/forgot`, `/reset`, route handler `/auth/callback`. Kartu putih 400px di tengah latar `#f0f2f5`, CTA hitam.
4. **Middleware** `@supabase/ssr`: semua route kecuali halaman auth butuh sesi; redirect `/login?next=...`.
5. **Ganti `DEV_OWNER_ID`** dengan user dari sesi server di semua server action dan loader. Service-role key hanya tersisa di `applyImport` (lewat RPC) dan skrip seed.
6. **`requireAdmin()`** di setiap halaman `/admin/*` dan setiap server action admin (import, edit bahan global, aturan bridger). Cek di server, jangan cuma sembunyikan menu.
7. **Pindahkan data dummy** ke akun asli:
```sql
update profiles set role = 'admin' where email = '<email-pemilik>';
update formulas       set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update fragrance_oils set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update user_stock     set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update import_batches set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update bridge_rules   set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update app_settings   set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update evaluations    set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update packaging_items set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update cost_sheets    set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update raw_materials  set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';  -- baris global (null) tidak disentuh
delete from profiles where id = '<uuid-dummy>';
```
Backup dulu (Supabase → Database → Backups, atau `supabase db dump`).

### 2.3 Peta halaman vs auth

| Halaman | Login | Admin |
|---|---|---|
| `/login`, `/register`, `/forgot`, `/reset`, `/auth/callback` | tidak | — |
| `/`, `/formulas/**`, `/materials/**`, `/costing`, `/evaluations/**` | ya | tidak |
| `/admin/**` | ya | **ya** |

---

## 3. Payment

Tidak ada. Kalau nanti dibuka untuk murid kelas: mulai dengan **kode undangan** (bukan payment gateway). Kalau benar-benar butuh langganan: Mayar / Tripay / DOKU. Jangan bangun apa pun sekarang.

---

## 4. Variabel Lingkungan

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, JANGAN diawali NEXT_PUBLIC_
NEXT_PUBLIC_SITE_URL=           # redirect OAuth
DEV_OWNER_ID=                   # hanya fase 1–4, hapus setelah auth aktif
```
Isi di Vercel → Settings → Environment Variables untuk Preview dan Production. `.env.local` masuk `.gitignore`.

---

## 5. Checklist Testing Sebelum Launch

### 5.1 Kalkulasi (Vitest, wajib hijau)
- [ ] `calc-fixture-01.json` lolos penuh: alokasi, komposisi nyata, pelarut, piramida nyata, kekuatan, pie, HPP, scaling 3 g & 120 g
- [ ] `allocateTier`: tambah/hapus/edit/normalisasi/rasio/ratakan/pindah tier/ubah target — total tier selalu tepat sama dengan target bila ada baris terbuka
- [ ] Sisa negatif → baris terbuka jadi 0, tidak pernah negatif
- [ ] Pembulatan: 3 baris terbuka di target 10% → 3,33333 / 3,33333 / 3,33334, total 10,00000
- [ ] `parseSupplierDilution` untuk semua contoh di file 03 §4.3
- [ ] Accord 2 tingkat dibentangkan benar; siklus dan kedalaman > 3 ditolak dengan pesan menyebut nama formula
- [ ] Bahan yang sama langsung + via accord dijumlahkan di komposisi nyata, R11 terpicu
- [ ] `pickTier`: 3→10, 30→10, 49,9→10, 50→50, 120→100, 600→500; override per formula menang
- [ ] Harga fallback: tier kosong → tier lebih kecil, lalu lebih besar, lalu "harga belum ada"
- [ ] FO dikeluarkan dari kekuatan & pie; coverage dilaporkan
- [ ] Bahan tanpa impact dihitung 100 dan ditandai, tidak diam-diam 0
- [ ] `facetize` menghasilkan facet yang sama dengan `bridge-db.json` untuk 20 bahan acak (toleransi 0,01)
- [ ] `suggestBridges` untuk Bergamot ↔ Rose Oxide mengembalikan Linalool di urutan 1

### 5.2 Editor
- [ ] Menambah 8 bahan ke 3 tier lewat keyboard < 3 menit
- [ ] Ganti batch tidak mengubah persen; gram, harga, dan tier harga berubah
- [ ] Autosave draf jalan; refresh halaman tidak kehilangan perubahan
- [ ] Simpan versi ditolak kalau piramida ≠ 100 atau ada tier yang tidak terisi sesuai target (dengan pesan jelas)
- [ ] Undo 20 langkah
- [ ] Baris accord menampilkan isi saat di-expand; badge "ada versi baru" muncul

### 5.3 Import pricelist
- [ ] File `Pricelist_Ecofragrantica_2026.xlsx` → 459 bahan unik, Sheet1 diabaikan
- [ ] Upload file yang sama dua kali → tidak ada duplikat, pratinjau kedua "0 baru, 0 berubah"
- [ ] Ubah satu harga di file → terdeteksi di "harga berubah", riwayat lama tetap ada
- [ ] Impact override, facet manual, tier hint, catatan pribadi **tidak berubah** setelah upload ulang
- [ ] Karakter tak terlihat (U+2060) di nama tidak membuat duplikat
- [ ] `Ambroxan` dan `Ambroxan 10-TEC` tetap dua bahan berbeda
- [ ] File yang bukan pricelist Eco → pesan error yang jelas

### 5.4 Auth & keamanan
- [ ] User B tidak bisa membaca/mengubah formula, stok, setting user A (uji dengan dua akun)
- [ ] User biasa tidak bisa membuka `/admin/*` atau memanggil server action admin
- [ ] Service-role key tidak muncul di bundle client (`grep` hasil `next build`)
- [ ] Login Google jalan di Preview URL dan domain produksi

### 5.5 UI
- [ ] Layout 375px: tidak ada scroll horizontal, panel analisa jadi tab
- [ ] Semua angka tabular & rata kanan; koma desimal diterima di input
- [ ] Pie: maksimal 7 irisan, legenda berlabel teks
- [ ] Lembar timbang tercetak rapi hitam-putih

---

## 6. Deploy — Vercel + Supabase

1. **Supabase produksi**: `supabase link --project-ref <ref>` → `supabase db push` (semua migrasi) → jalankan seed `facets`
2. **Vercel**: import repo GitHub, framework Next.js, isi env (§4), deploy
3. **Domain** (opsional): tambahkan di Vercel, update `NEXT_PUBLIC_SITE_URL`, Google OAuth origins, dan Supabase Redirect URLs
4. **Data awal**: login sebagai admin → `/admin/import` upload pricelist → seed `bridge_rules` (skrip `npm run seed:bridges` yang membaca CSV dan mencocokkan ke bahan)
5. **Smoke test produksi**: buat formula fixture 01 manual lewat UI, bandingkan angka dengan `calc-fixture-01.json`
6. **Backup**: aktifkan backup harian Supabase; sebelum setiap migrasi besar, `supabase db dump > backup-YYYYMMDD.sql`

---

## 7. Setelah Launch

- Catat bahan yang facet otomatisnya terasa salah → koreksi lewat admin (facet manual). Lama-lama data koreksi ini jadi aset utama aplikasi.
- Tambah aturan jembatan `saya` dari hasil uji blotter yang berhasil.
- Kandidat v3: data volatilitas/substantivity per bahan (untuk piramida nyata berbasis waktu), validasi IFRA, mode kelas dengan kode undangan.
