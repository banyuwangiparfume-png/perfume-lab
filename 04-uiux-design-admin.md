# Fase 4 — UI/UX, Design System & Admin

> Lanjutan file 01–03. Berisi design system, komponen berulang, dan detail halaman admin.

---

## 1. Design System — iOS SaaS Storefront

Dipilih karena aplikasi ini isinya tabel angka yang dibaca lama. Latar terang mengurangi kelelahan mata saat input gramasi, dan kartu putih di atas abu memberi pemisahan tanpa perlu banyak garis.

### 1.1 Token Warna

```css
:root {
  /* Permukaan */
  --bg:            #f0f2f5;   /* latar halaman */
  --surface:       #ffffff;   /* kartu, tabel, panel */
  --surface-muted: #f7f8fa;   /* baris bergantian, header tabel */
  --border:        #e3e6ea;
  --border-strong: #cfd4da;

  /* Teks */
  --text:          #11151a;
  --text-muted:    #5c6672;
  --text-subtle:   #8b949e;

  /* Aksen */
  --accent:        #2563eb;   /* link, state aktif, bar chart utama */
  --accent-soft:   #dbeafe;
  --cta:           #0a0a0a;   /* tombol aksi utama — hitam, bukan biru */
  --cta-text:      #ffffff;

  /* Semantik */
  --ok:            #0f9d58;
  --ok-soft:       #e3f5ea;
  --warn:          #c2770b;
  --warn-soft:     #fdf3e2;
  --danger:        #d14343;
  --danger-soft:   #fdecec;
  --info:          #2563eb;
  --info-soft:     #e8f0fe;

  /* Skala impact — dipakai di badge dan chart */
  --impact-low:    #9aa3ad;   /* < 50   */
  --impact-mid:    #2563eb;   /* 50–150 */
  --impact-high:   #e07b16;   /* 150–500 */
  --impact-xhigh:  #d14343;   /* > 500  */

  --radius:     12px;
  --radius-sm:   8px;
  --shadow:     0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10);
  --shadow-lg:  0 4px 12px rgba(16,24,40,.08);
}
```

### 1.2 Tipografi

Font: **DM Sans** (Google Fonts), fallback `system-ui, sans-serif`.

| Peran | Ukuran / tebal |
|---|---|
| Judul halaman | 28px / 600 |
| Judul bagian | 20px / 600 |
| Judul kartu | 16px / 600 |
| Teks isi | 14px / 400 |
| Label & meta | 13px / 500, `--text-muted` |
| Angka di tabel | 14px / 500, **tabular-nums** |

```css
.numeric { font-variant-numeric: tabular-nums; text-align: right; }
```

Semua kolom angka wajib `tabular-nums` dan rata kanan. Gramasi 3 desimal yang tidak sejajar sangat sulit dibandingkan sekilas.

### 1.3 Navbar

Sticky atas, efek kaca:
```css
background: rgba(255,255,255,.72);
backdrop-filter: blur(12px);
border-bottom: 1px solid var(--border);
height: 56px;
```
Isi: logo kiri · menu tengah (Dashboard, Formula, Bahan, HPP, Admin) · avatar kanan. Menu aktif ditandai teks `--accent` + garis bawah 2px.

Mobile: menu jadi drawer, navbar tetap sticky.

### 1.4 Tombol

| Jenis | Gaya |
|---|---|
| **Primary (CTA)** | bg `--cta` hitam, teks putih, radius 10px, padding 10×18, hover sedikit terangkat |
| **Secondary** | bg putih, border `--border-strong`, teks `--text` |
| **Ghost** | transparan, teks `--text-muted`, hover bg `--surface-muted` |
| **Danger** | teks `--danger`, border `--danger` tipis, bg putih |

CTA hitam adalah ciri khas style ini — jangan diganti biru. Biru dipakai untuk link dan state aktif saja.

### 1.5 Kartu & Tabel

```css
.card  { background: var(--surface); border: 1px solid var(--border);
         border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; }
```

Tabel: header `--surface-muted` dengan teks 12px uppercase `--text-muted` letter-spacing .04em; baris tinggi 44px; pembatas `--border` 1px; hover baris `--surface-muted`.

---

## 2. Komponen Berulang

### 2.1 `ImpactBadge`

Menampilkan nilai impact dengan warna dan label.

```
< 50      abu-abu   "lemah · tahan lama"
50–150    biru      "sedang"
150–500   oranye    "kuat"
> 500     merah     "sangat kuat"
null      putus-putus, teks "—"  tooltip: "belum ada data impact"
FO        abu pucat, teks "—"    tooltip: "FO tidak punya nilai impact tunggal"
```

Dua keadaan null terakhir harus **dibedakan**. "Belum ada data" berarti ada yang perlu dilengkapi. "FO tidak punya nilai" berarti memang begitu seharusnya, dan tidak akan pernah terisi. Kalau keduanya terlihat sama, user akan menghabiskan waktu mencari data yang tidak ada.

Kalau ada override, tampilkan nilai supplier dicoret kecil di sebelah nilai baru, dan tooltip berisi alasan override. Jangan sembunyikan nilai aslinya.

### 2.2 `StrengthChart` — komponen paling penting

Bar chart horizontal, **dua batang per bahan**:
- Batang atas tipis, abu-abu — **% berat**
- Batang bawah tebal, warna sesuai Kategori Fungsi — **% kekuatan**

Perbedaan panjang dua batang itulah pelajarannya. Beri label di atas chart:

> Batang abu = porsi berat. Batang berwarna = porsi kekuatan sebenarnya. Kalau batang berwarna jauh lebih panjang, bahan itu mendominasi lebih dari yang terlihat di resep.

Warna per Kategori Fungsi (konsisten di seluruh aplikasi):
```
Diffuser  #e07b16   Modifier  #2563eb
Bridger   #0f9d58   Fixative  #7c5cbf
```

Urutkan dari % kekuatan terbesar, bukan urutan resep.

**Baris FO** tidak punya batang berwarna — hanya batang abu (% berat), dengan teks `tidak dinilai` di tempat batang kedua. Jangan menggambar batang kosong sepanjang nol, itu terbaca seolah kekuatannya memang nol.

Kalau ada FO di formula, tambahkan catatan di bawah chart:
> Batang kekuatan dihitung dari {strengthBasis}% formula. FO tidak ikut dinilai.

### 2.3 `ComponentPicker`

Picker bertab di editor, satu untuk tiap jenis baris.

**Tab Bahan** — tiap opsi menampilkan tiga baris informasi supaya user belajar sambil memilih:
```
Ambroxan                                    [400] Modifier
Amber Ether · Ambrofix · CAS 6790-58-5
ambergris sweet labdanum dry        Rp15.048/g
```
Cari berdasarkan nama, sinonim, dan CAS. Bahan yang sudah dipakai di formula ini diberi tanda centang.

**Tab FO** — menampilkan nama, inspired-by, dan family:
```
Tabbac 28                                        Tobacco
inspired by Maison Alhambra Tabac       Rp1.000/g
```
Tidak ada kolom impact di sini. Kalau ruang kosongnya terasa janggal, isi dengan badge abu bertuliskan `tidak dinilai` — lebih baik menjelaskan daripada membiarkan user mengira datanya belum diisi.

**Tab Formula** — versi formula milik user yang bisa dipakai sebagai komponen:
```
Jasmine Accord · v3                    8 bahan · impact rata-rata 112
Soft-Longevity Booster · v5            8 bahan · impact rata-rata  58
```
Versi yang akan menyebabkan siklus atau melewati kedalaman 3 tetap ditampilkan, tapi non-aktif dengan alasan di tooltip (*"formula ini sudah memakai formula yang kamu edit"*). Menyembunyikannya hanya membuat user mencari-cari.

### 2.3b `LineTypeToggle`

Toggle tiga posisi di awal tiap baris editor: **Bahan · FO · Formula**. Lebarnya tetap, ikon + teks pendek. Mengubah jenis mengosongkan komponen yang sudah dipilih — konfirmasi dulu kalau barisnya sudah terisi.

Beri warna latar baris yang sangat tipis sesuai jenis, supaya tabel campuran tetap terbaca sekilas:
```
Bahan    : putih (default)
FO       : #fbfaf7  (hangat tipis)
Formula  : #f7f9fc  (biru tipis)
```
Jangan lebih kuat dari ini — ini petunjuk, bukan highlight.

### 2.4 `DilutionSelect`

Dropdown: Neat (100%) · 50% · 25% · 10% · 5% · 1% · Custom…

Saat bukan Neat, munculkan field pelarut di sebelahnya. Di bawah input, tampilkan hasil hitungnya langsung sebagai teks kecil:

> 0,500 g @ 10% = **0,050 g bahan murni**

Ini mencegah kesalahan paling mahal di aplikasi jenis ini. Jangan buat teks ini kecil sekali atau abu-abu pucat — ini bukan hiasan.

### 2.5 `RulesPanel`

Daftar temuan. Tiap baris: ikon tingkat · pesan · tombol aksi opsional.

```
⚠  Tidak ada bahan kategori Bridger, padahal formula mencakup 4 keluarga aroma.
   Transisi berisiko patah.                        [ Lihat kandidat Bridger ]
```

Kalau tidak ada temuan:
> Struktur formula ini sehat. Sekarang racik dan cium sendiri — pemeriksaan ini tidak bisa menilai aroma.

Footer panel selalu ada, dengan teks 12px `--text-subtle`:
> Pemeriksaan ini hanya menilai struktur, bukan aroma. Formula bisa lolos semua pemeriksaan dan tetap berbau tidak enak.

### 2.6 `TimelineInput`

Input evaluasi per titik waktu. Tata letak vertikal dengan garis penghubung di kiri (timeline), tiap simpul = satu titik waktu.

Tiap simpul: label waktu (5 menit, 30 menit, 1 jam, 3 jam, 6 jam) · nada dominan · tag deskriptor · slider intensitas 1–10 · catatan.

Titik yang belum diisi tampil pucat dengan teks "belum dinilai". **Simpan parsial harus bisa** — tombol simpan selalu aktif, tidak menunggu semua titik terisi. Beri tombol "+ titik waktu lain" untuk interval custom.

Di mobile, komponen ini harus tetap nyaman — pengisian menit ke-5 hampir selalu terjadi sambil berdiri di meja kerja, bukan di depan laptop.

### 2.7 `EmptyState`

Ikon · judul · satu kalimat penjelasan · satu tombol aksi. Jangan pernah menampilkan tabel kosong tanpa penjelasan.

### 2.8 `StatTile`

Angka besar (28px/600), label kecil di bawah (13px, `--text-muted`), ikon kiri atas opsional. Tanpa sparkline di v1.

---

## 3. Catatan UX Khusus

**Fokus pada kecepatan input.** Editor baris harus bisa dioperasikan dari keyboard: Tab antar sel, Enter membuat baris baru, Esc membatalkan. Target: 8 bahan dalam 3 menit.

**Pembulatan.** Berat tampil 3 desimal. Persen tampil 1 desimal. Jangan membulatkan di penyimpanan — hanya di tampilan.

**Angka nol vs kosong.** Impact kosong tidak sama dengan impact 0. Tampilkan `—`, bukan `0`, dan jangan ikut sertakan dalam perhitungan diam-diam.

**Bahasa.** Antarmuka berbahasa Indonesia kasual, tapi istilah teknis perfumery tetap bahasa Inggris (Fixative, Bridger, Diffuser, Modifier, accord, drydown, sillage) karena itu yang dipakai di literatur dan katalog supplier.

**Mencegah bias saat evaluasi.** Pada form evaluasi, jangan tampilkan catatan evaluator sebelumnya. Cukup beri tahu bahwa versi ini sudah dinilai orang lain. Catatan mereka baru muncul setelah evaluasi disimpan.

**Nada peringatan.** Rules checker memberi informasi, bukan menghakimi. Tulis "ini kemungkinan terjadi karena…", bukan "formula kamu salah". User yang merasa dimarahi aplikasi akan berhenti mencatat — dan catatan adalah seluruh nilai produk ini.

**Responsif.** Breakpoint 768px dan 1280px. Di bawah 768px: tabel baris formula berubah jadi kartu bertumpuk, chart jadi full-width, panel analisa pindah ke bawah tabel.

---

## 4. Halaman Admin

Akses: `profiles.role = 'admin'`. Selama fase 1–4 belum ada auth, buka saja tanpa penjagaan dan pasang gate-nya di fase 5.

### 4.1 Admin — Raw Materials · `/admin/materials`

**Fungsi:** mengelola master bahan dan memasukkan pricelist supplier.

**Elemen UI:**
- Tabel master dengan search + filter (family, kategori fungsi, ada/tidak ada impact, global/milik user)
- Edit inline untuk kolom pendek (impact, kategori fungsi, family)
- Tombol **Import CSV** dan **Update Harga**
- Badge jumlah: total bahan · bahan tanpa impact · bahan yang di-override

**Alur Import CSV** — empat langkah, jangan dipotong:

1. **Upload** — drag & drop `.csv`. Tampilkan nama file dan jumlah baris terdeteksi.
2. **Pemetaan kolom** — tampilkan 10 baris pertama, cocokkan kolom CSV ke kolom database. Tebak otomatis dari nama header, tapi biarkan bisa diubah.
3. **Validasi** — jalankan pemeriksaan, tampilkan ringkasan:
   ```
   412 baris terbaca
   → 388 baru
   →  19 update (cocok lewat CAS)
   →   5 gagal
       baris 47  : odor_impact bukan angka ("n/a")
       baris 112 : nama kosong
       baris 203 : CAS ganda dengan baris 198
       ...
   ```
   Baris gagal bisa diunduh sebagai CSV untuk diperbaiki.
4. **Konfirmasi & jalankan** — tampilkan hasil akhir.

**Aturan import yang tidak boleh dilanggar:**
- Kunci pencocokan utama adalah **CAS number**, nama hanya cadangan
- **Jangan pernah menimpa `odor_impact_override` dan `odor_impact_note`** — itu hasil belajar user, bukan data supplier
- **Jangan pernah menimpa `personal_note`**
- Kolom impact kosong tetap disimpan sebagai null, **jangan diisi 0 atau 100**
- Import harus idempoten: menjalankan file yang sama dua kali tidak membuat duplikat

**Alur Update Harga:** import CSV berisi `cas_number` + kolom harga saja. Membuat baris baru di `rm_prices` dengan `effective_date` hari ini. Harga lama tidak dihapus — riwayat harga berguna untuk melihat pergerakan biaya.

**Kondisi:**
- *Empty:* "Master bahan masih kosong. Mulai dengan mengimpor pricelist supplier." + tombol import
- *Import gagal total:* tampilkan alasan teknisnya, jangan hanya "terjadi kesalahan"
- *Import sedang berjalan:* progress bar + jumlah baris diproses, jangan biarkan layar membeku tanpa kabar

### 4.2 Admin — Packaging · `/admin/packaging` (P2)

Tabel sederhana: nama item · biaya satuan · satuan · aktif. CRUD inline. Dipakai oleh kalkulator HPP.

Seed awal: Botol 35ml, Dus, Sticker, Shrink Seal, Dus Packing, Jasa Maklon.

### 4.3 Rencana Admin untuk Kelas (v2, jangan dibangun sekarang)

Dicatat supaya skema sekarang tidak menghalangi:
- Lihat semua formula murid, filter per angkatan
- Bagikan formula starter ke sekelompok murid (`formulas.parent_formula_id` sudah menyiapkan jalurnya)
- Batasi kit bahan per kelas (butuh tabel `material_kits` + `kit_items` — tambahan, bukan perubahan)
- Statistik: bahan paling sering dipakai, rule yang paling sering dilanggar

Karena `owner_id` dan RLS sudah terpasang sejak v1, semua ini bisa ditambahkan tanpa migrasi data.
