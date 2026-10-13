-- 0002_core_tables.sql
-- Tabel inti: profil, master bahan, FO, formula, versi, baris, evaluasi.
--
-- Dua prinsip yang menentukan bentuk tabel di sini:
--   1. Simpan BERAT, hitung persen. Tidak ada kolom `percentage` di mana pun.
--   2. Simpan berat seperti ditimbang + dilusi secara TERPISAH. Berat murni
--      adalah turunan, dihitung di aplikasi.

-- ---------------------------------------------------------------- profiles --
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  role         user_role not null default 'user',
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------- raw_materials --
create table raw_materials (
  id                   uuid primary key default gen_random_uuid(),

  -- NULL  = bahan master global (hasil import pricelist supplier)
  -- terisi = bahan tambahan milik satu user
  owner_id             uuid references profiles(id) on delete cascade,

  name                 text not null,
  synonym              text,
  cas_number           text,
  family               text,              -- Woody, Floral, Musk/Animalic, Green, Citrus, ...
  category             text,              -- Aromachemical, Aldehyde, Natural Isolate, ...
  odour_profile        text,              -- deskriptor mentah dari supplier
  function_category    function_category,

  -- Data supplier dan koreksi user disimpan di kolom BERBEDA, supaya import
  -- ulang tidak pernah menghapus hasil belajar user.
  odor_impact          numeric(10,2),     -- dari supplier; 100 = baseline (Bridger)
  odor_impact_override numeric(10,2),     -- koreksi user dari hasil penciumannya
  odor_impact_note     text,              -- alasan koreksi

  default_dilution_pct numeric(6,3) not null default 100,  -- bentuk yang biasa dipakai
  default_solvent      text,

  ifra_cat4_limit_pct  numeric(6,3),      -- disiapkan, TIDAK divalidasi di v1
  tgsc_url             text,
  supplier             text,
  personal_note        text,
  is_active            boolean not null default true,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint rm_impact_nonneg
    check (odor_impact is null or odor_impact >= 0),
  constraint rm_impact_override_nonneg
    check (odor_impact_override is null or odor_impact_override >= 0),
  constraint rm_default_dilution_range
    check (default_dilution_pct > 0 and default_dilution_pct <= 100)
);

create index raw_materials_owner_idx    on raw_materials (owner_id);
create index raw_materials_function_idx on raw_materials (function_category);
create index raw_materials_family_idx   on raw_materials (family);

-- Kunci pencocokan utama saat import pricelist adalah CAS number.
create unique index raw_materials_cas_global_uniq
  on raw_materials (cas_number)
  where owner_id is null and cas_number is not null;

-- Nama sebagai kunci cadangan untuk baris global yang tidak punya CAS.
-- Index ini yang membuat import idempoten: file yang sama dijalankan dua kali
-- tidak menghasilkan duplikat.
create unique index raw_materials_name_global_uniq
  on raw_materials (lower(name))
  where owner_id is null and cas_number is null;

-- -------------------------------------------------------------- rm_prices --
-- Harga per tier, dengan riwayat. Harga lama tidak pernah dihapus — pergerakan
-- biaya berguna untuk menilai ulang harga jual.
create table rm_prices (
  id              uuid primary key default gen_random_uuid(),
  raw_material_id uuid not null references raw_materials(id) on delete cascade,
  tier_grams      numeric(10,2) not null,     -- 5, 10, 50, 100, 500
  price_idr       numeric(14,2) not null,
  supplier        text,
  effective_date  date not null default current_date,
  created_at      timestamptz not null default now(),

  constraint rm_prices_tier_positive  check (tier_grams > 0),
  constraint rm_prices_price_nonneg   check (price_idr >= 0),
  -- satu harga per bahan per tier per tanggal — import harga jadi idempoten
  unique (raw_material_id, tier_grams, effective_date)
);

create index rm_prices_lookup_idx
  on rm_prices (raw_material_id, effective_date desc);

-- --------------------------------------------------------- fragrance_oils --
-- FO sengaja ditaruh di tabel terpisah, bukan diberi flag di raw_materials.
-- Alasannya: FO tidak punya CAS, tidak punya function_category, dan tidak
-- punya odor_impact. Kalau dicampur ke tabel yang sama, setiap kueri dan setiap
-- fungsi kalkulasi harus menulis pengecualian — dan satu pengecualian yang
-- kelupaan akan menghasilkan angka yang salah tanpa ada yang sadar.
--
-- TIDAK ADA kolom odor_impact di tabel ini, dan jangan pernah ditambahkan.
-- Kalau suatu saat tergoda mengisinya dengan angka tebakan supaya rules bisa
-- jalan, itu artinya rules-nya yang harus diperbaiki, bukan datanya dikarang.
create table fragrance_oils (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references profiles(id) on delete cascade,

  name           text not null,           -- "Tabbac 28"
  inspired_by    text,                    -- "Maison Alhambra Tabac"
  supplier       text,
  -- family WAJIB: dipakai Rule 7 untuk memeriksa jarak antar FO saat ada
  -- lebih dari satu FO dalam satu formula.
  family         text not null,
  sub_family     text,
  note_pyramid   text,                    -- catatan top/heart/base, teks bebas
  price_per_gram numeric(12,2),
  dep_pct        numeric(6,3) not null default 0,  -- fixative yang sudah ada di bibit
  personal_note  text,
  is_active      boolean not null default true,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint fo_price_nonneg check (price_per_gram is null or price_per_gram >= 0),
  constraint fo_dep_range    check (dep_pct >= 0 and dep_pct <= 100)
);

create index fragrance_oils_owner_idx on fragrance_oils (owner_id, is_active);

-- --------------------------------------------------------------- formulas --
-- Formula adalah WADAH (konsep). Yang berisi bahan adalah versi.
create table formulas (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references profiles(id) on delete cascade,
  name              text not null,
  description       text,
  type              formula_type not null default 'experiment',
  target_category   text,                 -- Floral, Woody, Oriental, Fresh, Gourmand, Spicy
  source            formula_source not null default 'own',
  source_note       text,
  parent_formula_id uuid references formulas(id) on delete set null,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index formulas_owner_idx on formulas (owner_id, is_archived);
create index formulas_type_idx  on formulas (owner_id, type);

-- -------------------------------------------------------- formula_versions --
create table formula_versions (
  id                uuid primary key default gen_random_uuid(),
  formula_id        uuid not null references formulas(id) on delete cascade,
  version_no        integer not null,
  label             text,                 -- "v3 — Ambroxan turun ke 2%"
  -- WAJIB untuk version_no > 1. Ini bukan metadata — ini isi pelajarannya.
  -- Dipaksa oleh constraint di bawah, bukan hanya oleh validasi di form.
  change_note       text,
  -- Percabangan: v3 melahirkan v4a (tanpa bahan X) dan v4b (bahan X 2x)
  -- untuk subtraction test.
  parent_version_id uuid references formula_versions(id) on delete set null,
  batch_size_g      numeric(10,3) not null default 10,
  status            version_status not null default 'draft',
  -- DUA tanggal, bukan satu. Praktik lab memisahkan dua masa istirahat yang
  -- tujuannya berbeda:
  --   oil phase rest  dari mixed_at,   24-48 jam  -- bahan larut antar sesamanya
  --   maserasi        dari diluted_at, 2-4 minggu -- alcohol bite turun, larutan stabil
  -- evaluations.maceration_days dihitung dari diluted_at, BUKAN mixed_at. Kalau
  -- salah pakai, umur maserasi selalu kelebihan beberapa hari dan perbandingan
  -- antar versi jadi menyesatkan.
  mixed_at          timestamptz,          -- kapan FASE MINYAK dicampur
  diluted_at        timestamptz,          -- kapan ETHANOL ditambahkan
  created_at        timestamptz not null default now(),

  unique (formula_id, version_no),
  constraint dilute_after_mix check (
    diluted_at is null or mixed_at is null or diluted_at >= mixed_at
  ),
  constraint version_no_positive check (version_no >= 1),
  constraint batch_size_positive check (batch_size_g > 0),
  constraint change_note_required_after_v1 check (
    version_no = 1 or (change_note is not null and btrim(change_note) <> '')
  )
);

create index formula_versions_formula_idx
  on formula_versions (formula_id, version_no desc);

-- Melayani antrean lab di dashboard. Tidak difilter status, karena kelompok
-- antrean ditentukan oleh dua tanggal di atas — bukan oleh status versi.
create index formula_versions_mixed_idx
  on formula_versions (mixed_at) where mixed_at is not null;
create index formula_versions_diluted_idx
  on formula_versions (diluted_at) where diluted_at is not null;

-- ----------------------------------------------------------- formula_lines --
-- Satu baris bisa merujuk ke salah satu dari TIGA hal yang sifatnya berbeda:
--   raw_material — bahan baku tunggal, punya nilai impact
--   fo           — bibit parfum jadi, isinya tidak diketahui, TIDAK punya impact
--   sub_formula  — versi formula lain milik sendiri, impact-nya bisa dihitung
create table formula_lines (
  id                     uuid primary key default gen_random_uuid(),
  formula_version_id     uuid not null references formula_versions(id) on delete cascade,

  line_type              line_type not null default 'raw_material',
  raw_material_id        uuid references raw_materials(id)    on delete restrict,
  fo_id                  uuid references fragrance_oils(id)   on delete restrict,
  sub_formula_version_id uuid references formula_versions(id)  on delete restrict,

  weight_g               numeric(12,4) not null,   -- BERAT SEPERTI DITIMBANG
  dilution_pct           numeric(6,3) not null default 100,
  solvent                text,                     -- DPG, TEC, IPM, Ethanol, Jojoba

  note                   text,
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now(),

  constraint weight_positive check (weight_g > 0),
  constraint dilution_range  check (dilution_pct > 0 and dilution_pct <= 100),

  -- Tepat satu kolom referensi terisi, dan harus cocok dengan line_type.
  constraint ref_matches_type check (
     (line_type = 'raw_material'
        and raw_material_id is not null and fo_id is null and sub_formula_version_id is null)
  or (line_type = 'fo'
        and fo_id is not null and raw_material_id is null and sub_formula_version_id is null)
  or (line_type = 'sub_formula'
        and sub_formula_version_id is not null and raw_material_id is null and fo_id is null)
  ),

  -- Hanya mencegah rujukan ke diri sendiri. Siklus tak langsung (A memakai B,
  -- B memakai A) dicegah di aplikasi — lihat lib/calc/cycle.ts.
  constraint no_self_reference check (sub_formula_version_id is distinct from formula_version_id)
);

create index formula_lines_version_idx on formula_lines (formula_version_id, sort_order);
create index formula_lines_sub_idx
  on formula_lines (sub_formula_version_id) where sub_formula_version_id is not null;
create index formula_lines_rm_idx
  on formula_lines (raw_material_id) where raw_material_id is not null;

-- ------------------------------------------------------------- evaluations --
create table evaluations (
  id                 uuid primary key default gen_random_uuid(),
  formula_version_id uuid not null references formula_versions(id) on delete cascade,
  owner_id           uuid not null references profiles(id) on delete cascade,

  -- Sengaja teks bebas, bukan FK ke profiles. Orang yang mencium belum tentu
  -- punya akun — dan memaksa mereka punya akun akan membunuh kebiasaan minta
  -- pendapat orang lain, padahal itu yang mau didorong karena anosmia parsial.
  evaluator_name     text not null,

  -- screening: oil rest 24 jam, encerkan, cium setelah ~48 jam. Untuk
  --            membandingkan versi A vs B dan menyaring kandidat.
  -- final:     setelah maserasi penuh 2-4 minggu. Untuk memutuskan produk
  --            siap dijual.
  -- Perbandingan terkontrol tidak butuh kondisi sempurna, tapi butuh kondisi
  -- IDENTIK — karena itu screening tidak boleh dibandingkan dengan final.
  purpose            eval_purpose not null default 'screening',

  medium             eval_medium not null default 'blotter',
  diluted_in         text,                 -- "20% in ethanol"
  maceration_days    integer,              -- dihitung dari diluted_at

  -- Diisi kalau penilai tidak tahu sampel mana yang sedang dicium. Kosong
  -- berarti penilaian terbuka — bukan dosa, tapi perlu terlihat, karena
  -- penilai yang tahu mana versi "perbaikan" cenderung menemukan perbaikan itu.
  blind_code         text,

  evaluated_at       timestamptz not null default now(),

  overall_note       text,
  rating             smallint check (rating between 1 and 5),
  transition_verdict transition_verdict,

  created_at         timestamptz not null default now(),

  constraint evaluator_name_not_blank check (btrim(evaluator_name) <> ''),
  constraint maceration_nonneg check (maceration_days is null or maceration_days >= 0)
);

create index evaluations_version_idx on evaluations (formula_version_id, evaluated_at desc);
create index evaluations_owner_idx   on evaluations (owner_id);
-- Dipakai antrean lab untuk memeriksa apakah sebuah versi sudah punya
-- evaluasi final.
create index evaluations_final_idx
  on evaluations (formula_version_id) where purpose = 'final';

-- ------------------------------------------------------ evaluation_points --
create table evaluation_points (
  id              uuid primary key default gen_random_uuid(),
  evaluation_id   uuid not null references evaluations(id) on delete cascade,
  minutes_elapsed integer not null,        -- 5, 30, 60, 180, 360, atau custom
  dominant_note   text,
  -- text[] dipilih supaya pencarian deskriptor gampang
  -- (descriptors @> ARRAY['creamy']) tanpa tabel tag terpisah.
  descriptors     text[] not null default '{}',
  intensity       smallint check (intensity between 1 and 10),
  note            text,

  unique (evaluation_id, minutes_elapsed),
  constraint minutes_nonneg check (minutes_elapsed >= 0)
);

create index evaluation_points_eval_idx on evaluation_points (evaluation_id, minutes_elapsed);
