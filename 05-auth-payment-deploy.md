# Fase 5 — Auth, Deployment & Checklist Launch

> Fase terakhir. Jalankan setelah fase 1–4 selesai dan aplikasi sudah bisa dipakai tanpa login.
> **Tidak ada payment di v1** — aplikasi ini dipakai sendiri, belum dijual.

---

## 1. Transisi dari Mode Tanpa-Auth ke Mode Auth

Selama fase 1–4 aplikasi berjalan dengan satu `owner_id` dummy tetap. Fase ini menukarnya dengan user asli.

### 1.1 Yang sudah siap sejak awal

- Semua tabel sudah punya `owner_id`
- RLS sudah aktif dengan policy berbasis `auth.uid()`
- Tabel `profiles` sudah ada

Artinya pekerjaan di fase ini hanya: pasang alur login, ganti sumber `owner_id`, dan pindahkan data dummy ke akun asli.

### 1.2 Langkah

**Langkah 1 — Nyalakan provider di Supabase**
Dashboard → Authentication → Providers:
- Email/Password: aktif, konfirmasi email **aktif** untuk produksi, boleh nonaktif saat development
- Google OAuth: aktif. Buat OAuth Client di Google Cloud Console, isi Client ID + Secret, daftarkan redirect URI:
  ```
  https://<project-ref>.supabase.co/auth/v1/callback
  ```
  Lalu di Google Cloud, Authorized JavaScript origins diisi domain aplikasi (Vercel preview + domain produksi).

**Langkah 2 — Trigger pembuatan profil**

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          'user');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Langkah 3 — Halaman auth**

```
/login          Email + password, tombol "Masuk dengan Google", link ke daftar & lupa password
/register       Email, password, nama tampilan
/forgot         Kirim link reset
/reset          Form password baru (dari link email)
/auth/callback  Route handler untuk pertukaran kode OAuth
```

Desainnya mengikuti style iOS SaaS Storefront: kartu putih di tengah latar `#f0f2f5`, CTA hitam, font DM Sans. Satu kolom, maksimal 400px.

**Langkah 4 — Middleware**

```ts
// middleware.ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|register|forgot|reset|auth).*)'],
}
```
Sesi disegarkan lewat `@supabase/ssr`. Belum login → redirect ke `/login?next=<path asal>`.

**Langkah 5 — Ganti sumber `owner_id`**

Cari seluruh pemakaian UUID dummy dan ganti dengan user dari sesi server. Setelah ini, hentikan pemakaian service-role key di jalur normal — service-role hanya boleh dipakai di skrip migrasi dan import admin, tidak pernah di request biasa.

**Langkah 6 — Gate admin**

```ts
// lib/auth/requireAdmin.ts
export async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')
  return user
}
```
Panggil di awal tiap halaman `/admin/*` dan di setiap server action admin. **Jangan hanya menyembunyikan menunya** — cek di server.

**Langkah 7 — Pindahkan data dummy**

```sql
update profiles set role = 'admin' where email = '<email-pemilik>';

-- pindahkan kepemilikan data pengembangan ke akun asli
update formulas        set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update evaluations     set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update packaging_items set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update cost_sheets     set owner_id = '<uuid-asli>' where owner_id = '<uuid-dummy>';
update raw_materials   set owner_id = '<uuid-asli>'
  where owner_id = '<uuid-dummy>';   -- biarkan baris global (owner_id null) apa adanya

delete from profiles where id = '<uuid-dummy>';
```

Jalankan di staging dulu. Backup sebelum menjalankan di produksi.

### 1.3 Peta Halaman vs Auth

| Halaman | Butuh login | Butuh admin |
|---|---|---|
| `/login`, `/register`, `/forgot`, `/reset` | tidak | — |
| `/` dashboard | ya | tidak |
| `/materials`, `/materials/[id]` | ya | tidak |
| `/formulas/**` | ya | tidak |
| `/evaluations/**` | ya | tidak |
| `/costing/**` | ya | tidak |
| `/admin/**` | ya | **ya** |

Tidak ada halaman publik di v1. Landing page baru dibutuhkan kalau aplikasi dibuka untuk murid kelas.

---

## 2. Payment

**Tidak ada di v1.** Aplikasi dipakai sendiri.

Kalau nanti dibuka untuk murid kelas, kemungkinan besar aksesnya diberikan sebagai bagian dari paket kelas — jadi yang dibutuhkan bukan payment gateway, melainkan **sistem kode undangan**: admin membuat kode, murid memakainya saat daftar, kode menentukan kit bahan dan formula starter yang bisa diakses.

Kalau nanti benar-benar butuh langganan mandiri, gateway yang sesuai pasar Indonesia: **Mayar**, **Tripay**, atau **DOKU**.

Jangan bangun apa pun soal ini sekarang.

---

## 3. Variabel Lingkungan

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, JANGAN diawali NEXT_PUBLIC_

# App
NEXT_PUBLIC_SITE_URL=             # dipakai untuk redirect OAuth
```

`SUPABASE_SERVICE_ROLE_KEY` hanya boleh dipakai di: skrip seed, import CSV admin, dan migrasi. Tidak pernah di komponen client, tidak pernah di request user biasa.

---

## 4. Checklist Testing Sebelum Launch

### 4.1 Kalkulasi — paling kritis

- [ ] Bahan `1,000 g @ 10%` menghasilkan berat murni `0,100 g`
- [ ] Mengubah dilusi mengubah % kekuatan, tapi **tidak** mengubah instruksi penimbangan
- [ ] Total % murni selalu 100,0 (±0,1 untuk pembulatan)
- [ ] Total % kekuatan selalu 100,0
- [ ] Satu bahan dengan impact null → `strengthComplete = false` dan banner muncul; bahan itu **tidak** dianggap impact 0
- [ ] Skalakan 5 g → 50 g: semua rasio tetap, total sesuai target ±0,01 g
- [ ] Skalakan lalu skalakan balik mengembalikan angka semula (dalam batas pembulatan 3 desimal)
- [ ] Formula dengan satu bahan tidak membuat pembagian nol
- [ ] Formula kosong tidak membuat halaman error
- [ ] Biaya per gram memakai berat **murni**, bukan berat timbang
- [ ] Angka hasil hitung di aplikasi cocok dengan hitungan manual di spreadsheet untuk satu formula nyata

### 4.1b FO & sub-formula

- [ ] Baris FO: `strengthPct` kosong, tapi `weightPct` dan biaya tetap terhitung
- [ ] FO **tidak** diperlakukan sebagai impact 0 — cek bahwa menambah FO tidak menurunkan % kekuatan bahan lain
- [ ] `strengthBasis` ditampilkan dan angkanya benar (formula 94% FO + 6% booster → basis 6%)
- [ ] Formula berisi sub-formula menghasilkan % kekuatan **identik** dengan formula yang sama ditulis datar
- [ ] Baris sub-formula bisa diperluas, berat sub-baris terskala benar ke porsinya
- [ ] Rules berjalan di atas daftar yang sudah dibentangkan — formula 3 sub-formula × 8 bahan memicu Rule 1
- [ ] Memilih versi yang menyebabkan siklus ditolak dengan pesan yang menyebut nama formulanya, bukan UUID
- [ ] Kedalaman 4 tingkat ditolak di tingkat ke-4
- [ ] Mengubah sub-formula yang sudah dipakai formula lain **tidak** mengubah formula induk diam-diam — induk merujuk ke versi tertentu, bukan ke formula secara umum. Uji ini dengan sengaja: ubah accord v3, pastikan formula yang memakai v3 tetap memakai v3.
- [ ] Rule 6 menyala saat porsi FO di bawah 85%
- [ ] Rule 7 menyala saat ada 2 FO, dan menyebut family keduanya dengan benar
- [ ] FO tidak bisa diberi nilai impact dari UI mana pun

### 4.2 Versi & reproduksi

- [ ] Versi ke-2 tidak bisa disimpan tanpa `change_note`
- [ ] Versi berstatus `evaluated` tidak bisa diubah barisnya, hanya bisa diduplikat
- [ ] Duplikat versi menyalin semua baris **beserta dilusi dan pelarutnya**
- [ ] `version_no` tidak pernah bentrok walau dua tab dibuka bersamaan
- [ ] **Tes reproduksi:** cetak satu formula dari aplikasi, serahkan ke orang lain, minta dia meracik hanya dari kertas itu. Kalau dia perlu bertanya apa pun, aplikasinya belum lengkap.

### 4.3 Rules checker

- [ ] Formula 15 bahan memicu Rule 1
- [ ] Formula tanpa Fixative memicu Rule 2
- [ ] Formula 4 family tanpa Bridger memicu peringatan Bridger + tombol kandidat berfungsi
- [ ] Formula dengan semua bahan porsi sama memicu Rule 3 (tidak ada yang memimpin)
- [ ] Bahan dosis kecil berimpact tinggi memicu Rule 4
- [ ] Bahan tanpa impact memicu Rule 5 sebagai `critical`
- [ ] Formula sehat menampilkan pesan "struktur sehat" + disclaimer
- [ ] Disclaimer selalu ada di semua kondisi

### 4.4 Evaluasi

- [ ] Bisa menyimpan dengan hanya satu titik waktu terisi
- [ ] Kembali lagi dan menambah titik waktu tidak menghapus yang sudah ada
- [ ] `evaluator_name` bisa diisi nama orang lain
- [ ] Dua evaluasi dari penilai berbeda untuk versi yang sama tampil berdampingan
- [ ] Catatan penilai sebelumnya tidak terlihat saat mengisi evaluasi baru
- [ ] Dashboard "menunggu dievaluasi" mengurutkan dari yang paling lama dicampur

### 4.5 Import CSV

- [ ] File dengan 400+ baris selesai tanpa timeout
- [ ] Baris rusak dilaporkan dengan nomor baris dan alasannya
- [ ] Import ulang file yang sama tidak membuat duplikat
- [ ] `odor_impact_override`, `odor_impact_note`, dan `personal_note` **tidak** tertimpa
- [ ] Kolom impact kosong tersimpan sebagai null, bukan 0
- [ ] Update harga membuat baris baru di `rm_prices`, tidak menghapus riwayat

### 4.6 Auth & keamanan

- [ ] Belum login → semua halaman internal redirect ke `/login`
- [ ] Setelah login, `?next=` membawa ke halaman yang dituju semula
- [ ] Google OAuth berhasil di domain produksi, bukan hanya localhost
- [ ] User biasa membuka `/admin` → ditolak **di server**, bukan hanya menunya disembunyikan
- [ ] User A tidak bisa membaca formula user B lewat URL langsung (uji dengan dua akun asli)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` tidak muncul di bundle client (`grep` hasil build)
- [ ] Logout membersihkan sesi di semua tab

### 4.7 UI

- [ ] Semua tabel punya empty state yang menjelaskan langkah berikutnya
- [ ] Semua aksi punya loading state
- [ ] Error menampilkan pesan yang bisa ditindaklanjuti, bukan "terjadi kesalahan"
- [ ] Editor baris bisa dioperasikan penuh dari keyboard
- [ ] Form evaluasi nyaman dipakai di layar ponsel
- [ ] Kolom angka memakai `tabular-nums` dan rata kanan
- [ ] Teks konversi dilusi (`0,500 g @ 10% = 0,050 g murni`) terbaca jelas, bukan abu-abu pucat

---

## 5. Deployment

### 5.1 Tahap Development — Vercel + Supabase Cloud

1. Push repo ke GitHub
2. Import ke Vercel, framework terdeteksi Next.js otomatis
3. Isi environment variables (semua tiga lingkungan: Production, Preview, Development)
4. Di Supabase → Authentication → URL Configuration:
   - Site URL: domain produksi
   - Redirect URLs: tambahkan `https://*-<nama-project>.vercel.app/**` supaya preview deployment ikut jalan
5. Jalankan migrasi: `supabase db push` atau tempel SQL lewat dashboard
6. Jalankan seed master RM
7. Deploy

**Backup sejak hari pertama.** Supabase free tier tidak menyimpan backup otomatis yang panjang. Buat cron mingguan `pg_dump` ke penyimpanan lain. Data yang dibangun di aplikasi ini — ratusan formula dengan catatan penciuman — tidak bisa dibuat ulang kalau hilang. Ini bukan data yang bisa di-scrape ulang dari mana pun.

### 5.2 Tahap Produksi — VPS

Jalankan setelah aplikasi stabil.

**Opsi A — Coolify (disarankan).** Pasang Coolify di VPS, hubungkan repo GitHub, isi env vars, Coolify menangani build, HTTPS (Let's Encrypt), dan auto-deploy saat push. Paling dekat dengan pengalaman Vercel.

**Opsi B — Docker manual.**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Tambahkan `output: 'standalone'` di `next.config.js`. Di depannya pasang Nginx atau Caddy sebagai reverse proxy + TLS.

**Database di tahap produksi — dua pilihan:**
- *Tetap pakai Supabase Cloud* (disarankan): paling sedikit kerjaan, auth dan backup tetap terkelola. Cukup pindahkan aplikasinya saja.
- *Supabase self-host di VPS*: kendali penuh, tapi auth, storage, dan backup jadi tanggung jawab sendiri. Butuh RAM minimal 4 GB. Hanya ambil jalur ini kalau ada alasan kuat.

**Checklist pindah ke VPS:**
- [ ] Tidak ada API khusus Vercel yang dipakai (`@vercel/*`, Edge Runtime)
- [ ] `output: 'standalone'` aktif
- [ ] Env vars dipindahkan dengan aman (bukan lewat chat atau email)
- [ ] Redirect URL OAuth diperbarui ke domain baru di Google Cloud **dan** Supabase
- [ ] DNS diarahkan, TLS aktif dan auto-renew
- [ ] Backup database terjadwal dan **sudah diuji restore-nya** minimal sekali
- [ ] Monitoring uptime terpasang
- [ ] Rollback plan: domain lama di Vercel tetap hidup sampai VPS terbukti stabil beberapa hari

---

## 6. Setelah Launch

Setelah dipakai 3–4 minggu, tinjau ulang dua hal:

**Ambang batas rules.** Angka di `lib/rules/thresholds.ts` adalah tebakan awal. Setelah ada 20–30 formula dengan catatan penciuman, cek korelasinya: apakah formula yang ditandai "bubur" di evaluasi memang yang melanggar Rule 3? Kalau tidak, ambangnya yang salah, bukan usernya.

**Nilai impact.** Lihat berapa banyak bahan yang sudah di-override beserta alasannya. Itu ukuran paling jujur apakah aplikasi ini benar-benar dipakai untuk belajar, atau cuma jadi tempat menyimpan file.

Dua tinjauan ini yang menentukan apakah fitur AI di versi berikutnya punya pondasi data yang layak — atau cuma menebak di atas data supplier orang lain.
