# Fase 4 — UI/UX, Design System & Admin (PRD v2)

> Lanjutan file 01–03. Design system tetap **iOS SaaS Storefront** dari v1. Yang baru: warna facet, komponen editor piramida, komponen analisa, dan halaman admin import pricelist.

---

## 1. Design System — iOS SaaS Storefront

Latar terang, kartu putih, CTA hitam, aksen biru. Dipilih karena aplikasi ini isinya angka yang dibaca lama.

### 1.1 Token Warna (sama dengan v1)

```css
:root {
  --bg:#f0f2f5; --surface:#ffffff; --surface-muted:#f7f8fa;
  --border:#e3e6ea; --border-strong:#cfd4da;
  --text:#11151a; --text-muted:#5c6672; --text-subtle:#8b949e;
  --accent:#2563eb; --accent-soft:#dbeafe;
  --cta:#0a0a0a; --cta-text:#ffffff;
  --ok:#0f9d58; --ok-soft:#e3f5ea; --warn:#c2770b; --warn-soft:#fdf3e2;
  --danger:#d14343; --danger-soft:#fdecec; --info:#2563eb; --info-soft:#e8f0fe;
  --impact-low:#9aa3ad; --impact-mid:#2563eb; --impact-high:#e07b16; --impact-xhigh:#d14343;
  --radius:12px; --radius-sm:8px;
  --shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10);
  --shadow-lg:0 4px 12px rgba(16,24,40,.08);
}
```

### 1.2 Warna tier

Dipakai di header kartu tier, piramida, dan toggle pie per tier.

| Tier | Warna | Soft |
|---|---|---|
| Top | `#0ea5b7` | `#e0f6f8` |
| Mid | `#8b5cf6` | `#efe9fe` |
| Base | `#b7791f` | `#f7eedf` |
| All (piramida OFF) | `#5c6672` | `#f0f2f5` |

### 1.3 Tipografi

**DM Sans**, fallback `system-ui`. Judul halaman 28/600 · judul bagian 20/600 · judul kartu 16/600 · isi 14/400 · label 13/500 muted.
**Semua angka `tabular-nums`, rata kanan.** Gram 3 desimal, persen 3 desimal di input dan 1 desimal di chart, rupiah format `id-ID` tanpa desimal (kecuali di tabel HPP rinci: 2 desimal).

### 1.4 Navbar, tombol, kartu, tabel

Sama dengan v1: navbar kaca sticky 56px (Dashboard · Formula · Bahan · HPP · Admin), CTA hitam radius 10px, secondary putih ber-border, kartu putih radius 12 + shadow tipis, header tabel uppercase 12px muted.

### 1.5 Fungsi bahan (dari v1)

```
Diffuser #e07b16 · Modifier #2563eb · Bridger #0f9d58 · Fixative #7c5cbf
```

### 1.6 Warna facet (untuk pie, bar facet, chip)

Warna **tetap per facet** di seluruh aplikasi — user belajar "ungu = floral" lama-lama. Disimpan di tabel `facets.color`.

| Facet | Hex | Facet | Hex |
|---|---|---|---|
| citrus | `#e5b100` | spicy | `#d2691e` |
| green | `#4f9d3a` | woody | `#8b5a2b` |
| aromatic | `#2f9c8f` | earthy | `#6b7b3a` |
| fruity | `#e8668a` | amber | `#c98a1b` |
| floral | `#b04fa0` | resin | `#9c4a2f` |
| rose | `#d94a64` | gourmand | `#a8743f` |
| white | `#9b7fd1` | creamy | `#d9b98c` |
| powdery | `#a99cc9` | musk | `#7d8ba8` |
| clean | `#6fb0e0` | animalic | `#5a3e36` |
| aquatic | `#1f7fc4` | smoky | `#4a4f57` |
| *Lainnya* | `#c3c9d0` | | |

Pie maksimal 7 irisan (6 + Lainnya), jadi warna yang berdekatan jarang tampil bersama. Selalu sertakan label teks + persen di legenda — **jangan mengandalkan warna saja**.

---

## 2. Komponen

### 2.1 `PyramidInput` (wizard step 2 + header editor)
- Tiga baris: label tier (dengan titik warna tier) · input % · gram turunan
- Visual piramida di samping: trapesium 3 lapis, tinggi tiap lapis proporsional persen, warna tier
- Indikator total di bawah: `Total 100% ✓` hijau / `Total 95% · kurang 5%` merah
- Chip preset di atas: `15/25/60` `20/30/50` `10/30/60` `25/35/40`
- Input menerima koma desimal ("7,5")

### 2.2 `TierCard`
- Header: strip warna tier di kiri, `TOP · target 15% · 1,500 g`, status `terisi 15,000% ✓`, tombol ghost **Atur rasio** dan **Ratakan**
- Status tidak cocok: badge `--warn-soft` + dua tombol kecil (Normalisasi ke 15% / Jadikan target 16%)
- Isi: daftar `LineRow`
- Footer: tombol **+ Tambah bahan** (lebar penuh, border putus-putus) → `MaterialPicker`
- Empty state di dalam kartu: "Belum ada bahan di Top. Biasanya diisi citrus, green, atau aldehyde."

### 2.3 `MaterialPicker`
Command palette (dialog, fokus langsung ke input pencarian). Tab: **Bahan · Accord saya · FO**.

Tiap opsi Bahan, tiga baris:
```
Ambroxan                              [400] Modifier      ☆
CAS 6790-58-5 · Musk / Animalic · tier hint: base
●Amber 98 ●Musk 18 ●Gourmand 11            Rp22.005/g (tier 10)
```
- Facet tampil sebagai titik warna + angka (3 teratas)
- Bahan yang sudah dipakai di formula diberi centang
- Bahan dengan `note_tier_hint` ≠ tier yang sedang diisi diberi teks kecil "biasanya base" (bukan larangan)
- Filter cepat: chip facet, "stok saya"
- Keyboard: ↑↓ pilih, Enter tambah, Esc tutup; Shift+Enter tambah dan tetap buka (untuk menambah banyak sekaligus)

Tab **Accord saya**: hanya formula kategori Accord, versi tersimpan terakhir:
```
Jasmine Accord · v3        6 bahan · ●Floral 55 ●White 21 ●Animalic 9 · Rp2.140/g
```
Accord yang akan membuat siklus atau kedalaman > 3 tetap tampil tapi non-aktif dengan tooltip alasannya.

### 2.4 `LineRow`
Grid: `[gembok] [nama + meta] [input %] [gram] [harga] [kekuatan] [⋯]`. Di mobile berubah jadi kartu 2 baris.
- Meta di bawah nama: facet teratas · impact · fungsi · badge dilusi kalau bukan 100% (`10% dalam BB`) · badge supplier (`bawaan 50 BB`)
- Kolom kekuatan: angka + bar mini; bar merah kalau R5 terpicu
- Baris accord: badge `ACCORD`, chevron expand, isi ditampilkan menjorok, read-only, persen sudah dikalikan

### 2.5 `LockToggle`
Ikon gembok 20px. Terbuka abu-abu, terkunci hitam. Tooltip: "Terkunci: angka ini tidak ikut dibagi otomatis." Saat user mengetik persen, gembok berubah dengan animasi kecil 150 ms supaya user sadar.

### 2.6 `DilutionPopover`
- Input dilusi user (%) dengan chip cepat 100 · 50 · 25 · 10 · 5 · 1
- Select pelarut (hanya bahan `is_solvent`), wajib kalau < 100%
- Info read-only kalau ada dilusi supplier: "Produk ini sudah 50% dalam Benzyl Benzoate (dari nama supplier)."
- Hasil hitung langsung, teks 14px tebal (bukan abu-abu pucat):
  > 5,000% @ 10% = **0,500% Ambroxan** · 4,500% BB masuk formula

### 2.7 `RatioDialog`
Daftar baris tier dengan input rasio. Kolom kanan menampilkan hasil persen live. Tombol Terapkan → semua baris terkunci.

### 2.8 `AnalysisPanel`
Kartu sticky di kanan (desktop), tab di bawah (mobile). Tab: Ringkasan · Aroma · Kekuatan · Pelarut · HPP · Bridger. Badge angka di tab Ringkasan = jumlah peringatan kuning/merah.

### 2.9 `AromaDonut`
- Donut (inner radius 60%), di tengah: facet dominan + persennya ("Floral 19,8%")
- Legenda di samping (desktop) / bawah (mobile): titik warna · label · persen
- Klik irisan/legenda → daftar penyumbang ("Hedione 9,1 · Indole 50 BB 5,4 · ...")
- Segmented control di atas: Semua · Top · Mid · Base
- Catatan kecil di bawah kalau ada data yang tidak ikut dihitung

### 2.10 `StrengthChart` (dari v1)
Dua batang per bahan: tipis abu = % timbang, tebal berwarna fungsi = % kekuatan. Urut dari kekuatan terbesar. Bahan dari accord diberi label kecil "via Jasmine Accord".

### 2.11 `RealPyramid`
Per tier, tiga bar bertumpuk tipis: target (outline), terisi (warna tier pucat), aktif (warna tier penuh). Angka di kanan: `60 · 60 · 45,5`. Caption: "Aktif = bahan pewangi setelah pelarut dikeluarkan."

### 2.12 `SolventTable`
Baris per pelarut, expandable ke rincian asal. Total efektif tebal. Kalau R3/R4 terpicu, kartu saran di bawahnya:
> Target BB efektif: [ 10 ]%  → turunkan BB langsung dari 10% ke **3%**   [ Terapkan ]

### 2.13 `CostTable` + `PriceTierBadge`
- Badge: `Harga tier 10 g` + tooltip aturan ("batch 10 g → tier 10 g; batch 120 g → tier 100 g")
- Tabel: bahan · gram · Rp/g · biaya · kontribusi % (bar mini) · ⚠ fallback
- Footer: Total batch · per gram · per 100 g, tombol **Hitung HPP produk**
- Catatan: "1 ml dianggap 1 g."

### 2.14 `BridgePanel`
- Bagian **Antar tier**: kartu per transisi, header `Top ↔ Mid` + badge status (hijau Nyambung / kuning Renggang / merah Jurang) + persen
- Bagian **Dalam tier**: daftar pasangan terlemah
- Kartu saran: nama · skor (bar) · alasan · badge sumber (`aturan temen` / `klasik` / `saya`) · fungsi + impact · Rp/g · ☆ stok · tombol **+ Tambah ke Mid**
- Toggle "Hanya stok saya" di kanan atas panel
- Footer tetap: kalimat "Satu celah, satu bridger..."

### 2.15 Komponen bersama
- `ImpactBadge` (v1): <50 abu · 50–150 biru · 150–500 oranye · >500 merah · null putus-putus "—" · FO "tidak dinilai". Override: nilai supplier dicoret kecil di sebelahnya.
- `FacetBars`: bar horizontal per facet dengan warna facet + angka 0–100. Tooltip: "Arah karakter bahan, bukan kekuatannya."
- `StarStock`: ☆/★, toggle `user_stock`, optimistic update.
- `WarningList`: ikon level · pesan · tombol aksi opsional. Kosong → "Strukturnya sehat. Sekarang racik dan cium sendiri."
- `StatTile`, `EmptyState`: sama dengan v1.

---

## 3. Catatan UX

- **Kecepatan input**: editor bisa dipakai penuh dari keyboard. `/` membuka picker untuk tier yang sedang fokus, Tab pindah antar input persen, `L` toggle gembok baris yang fokus.
- **Angka berubah harus terlihat**: saat pembagian otomatis mengubah baris lain, angka yang berubah di-highlight kuning pucat 600 ms.
- **Undo**: Ctrl/Cmd+Z untuk 20 langkah terakhir di editor (stack di Zustand). Penting karena pembagian otomatis bisa mengubah banyak angka sekaligus.
- **Nada peringatan**: informatif, bukan menghakimi. "Indole kemungkinan akan mendominasi" — bukan "formula kamu salah".
- **Istilah**: UI bahasa Indonesia kasual; istilah perfumery tetap Inggris (Top, Mid, Base, Fixative, Bridger, accord, drydown).
- **Kosong vs nol**: impact kosong tampil "—", tidak pernah "0".
- **Responsif**: breakpoint 768 & 1280. Di < 768px, panel analisa jadi tab di bawah kartu tier, dan donut full-width.

---

## 4. Halaman Admin

Akses `profiles.role = 'admin'`. Fase 1–4 tanpa gate; dipasang di fase 5.

### 4.1 Upload Pricelist · `/admin/import`

Tiga langkah dengan stepper:

**1. Upload**
- Dropzone `.xlsx` (maks 10 MB). Teks bantuan: "Upload file pricelist Ecofragrantica apa adanya. Sistem mencari sheet daftar RM secara otomatis."
- Setelah upload: nama file, sheet yang terdeteksi (`Price List Aromachemical EcoFra ✓ · Essential Oil ✓ · Specialty Accord ✓ · Sheet1 diabaikan`), jumlah baris unik, tanggal pricelist (editable)

**2. Pratinjau**
- Kartu ringkasan: `42 baru · 118 harga berubah · 7 data supplier berubah · 13 terdeteksi encer · 3 tidak ada lagi · 290 tidak berubah · 4 dilewati`
- Tab per kelompok, masing-masing tabel:
  - *Harga berubah*: bahan · tier · lama → baru · selisih % (merah naik, hijau turun)
  - *Terdeteksi encer*: bahan · % · pelarut — dua kolom bisa diedit sebelum diterapkan
  - *Dilewati*: nomor baris · alasan
- Info: "Koreksi lo (impact override, facet manual, tier hint, catatan) tidak akan tertimpa."

**3. Terapkan**
- Tombol CTA **Terapkan perubahan** → progress → ringkasan hasil + link "Lihat bahan baru"
- Riwayat import di bawah halaman: tanggal, file, ringkasan, status

**Kondisi:** file bukan xlsx / tidak ada sheet berformat Eco → pesan jelas: "Tidak menemukan header 'Name Raw Materials' di sheet mana pun. Pastikan ini file pricelist Ecofragrantica." Jangan cuma "terjadi kesalahan".

### 4.2 Kelola Bahan · `/admin/materials`

- Tabel + filter (kategori, family, fungsi, ada/tidak impact, facet manual, tidak ada di pricelist terbaru)
- Badge: total bahan · tanpa impact · override · facet manual
- Klik baris → **drawer edit**, dua bagian dipisah jelas:
  - **Data supplier** (abu tipis, label "akan diperbarui saat upload pricelist"): nama, sinonim, CAS, family, kategori, odour profile, fungsi, impact, dilusi supplier
  - **Koreksi lo** (putih, label "tidak pernah ditimpa"): impact override + alasan (wajib), impact basis, tier hint, is_solvent, kandidat bridger, catatan pribadi
  - **Facet**: `FacetBars` yang bisa diedit (slider 0–100 per facet + tambah facet). Menyimpan mengaktifkan `facets_manual`. Tombol "Kembalikan ke otomatis".
- Tombol **+ Bahan manual** (supplier lain): form sama, harga diisi manual per tier

### 4.3 Aturan Jembatan · `/admin/bridge-rules`

- Tabel: bahan · facet A ↔ facet B (chip berwarna) · catatan · sumber · aksi
- Filter sumber dan facet
- Form tambah: pilih bahan (picker), dua facet (select), catatan, sumber default `saya`
- Info di atas: "Aturan memberi bonus skor saat bahan ini dipertimbangkan sebagai jembatan antara dua facet tersebut."

### 4.4 Setting · `/admin/settings`

- **Tier harga**: tabel aturan (batas batch → tier), tombol tambah/hapus baris, preview "3 g → 10 · 30 g → 10 · 60 g → 50 · 120 g → 100 · 600 g → 500"
- **Ambang**: bridger (0,45 / 0,20), pelarut (10% / 25%), dominasi (20% & 3×)
- **Pemetaan token pelarut supplier**: TEC, BB, DPG, ETHA, CASTOR, IPM → pilih bahan
- Tombol Simpan; perubahan langsung berlaku di editor
