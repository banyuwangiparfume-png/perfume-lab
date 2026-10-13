-- 0008_v2_tables.sql
-- Tabel baru PRD v2: facet, aturan jembatan, stok, riwayat import, settings.

-- ------------------------------------------------------------------ facets --
-- 20 facet tetap. Warnanya disimpan di sini, bukan di kode, supaya "ungu =
-- floral" konsisten di pie, bar, dan chip tanpa ada dua sumber kebenaran.
create table facets (
  key        text primary key,
  label      text not null,
  color      text not null,
  sort_order integer not null
);

-- Vektor facet tiap bahan, dinormalisasi L2 (panjang 1).
-- Dihitung otomatis saat import, KECUALI bahan yang facets_manual = true.
create table raw_material_facets (
  raw_material_id uuid not null references raw_materials(id) on delete cascade,
  facet_key       text not null references facets(key),
  weight          numeric(4,3) not null check (weight > 0 and weight <= 1),
  primary key (raw_material_id, facet_key)
);

create index raw_material_facets_facet_idx on raw_material_facets (facet_key);

-- ------------------------------------------------------------ bridge_rules --
-- Pengetahuan nyata dari hidung orang: "bahan X menyambungkan facet A ke B".
-- Diberi bonus skor di atas kemiripan vektor, karena vektor cuma menghitung
-- kemiripan teks deskriptor — bukan hasil mencium.
create table bridge_rules (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references profiles(id) on delete cascade, -- null = bawaan
  raw_material_id uuid not null references raw_materials(id) on delete cascade,
  facet_a         text not null references facets(key),
  facet_b         text not null references facets(key),
  note            text,
  source          rule_source not null default 'saya',
  created_at      timestamptz not null default now(),

  constraint facets_differ check (facet_a <> facet_b)
);

create index bridge_rules_material_idx on bridge_rules (raw_material_id);
create index bridge_rules_facets_idx on bridge_rules (facet_a, facet_b);

-- ------------------------------------------------------------- user_stock --
create table user_stock (
  owner_id        uuid not null references profiles(id) on delete cascade,
  raw_material_id uuid not null references raw_materials(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (owner_id, raw_material_id)
);

-- --------------------------------------------------------- import_batches --
-- Pratinjau disimpan sebelum diterapkan, supaya user bisa memeriksa dampak
-- sebuah upload sebelum apa pun berubah — dan supaya ada riwayatnya.
create table import_batches (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references profiles(id) on delete cascade,
  file_name      text not null,
  pricelist_date date not null,
  status         import_status not null default 'previewed',
  summary        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  applied_at     timestamptz
);

create index import_batches_owner_idx on import_batches (owner_id, created_at desc);

alter table raw_materials
  add constraint raw_materials_last_import_fk
  foreign key (last_seen_import_id) references import_batches(id) on delete set null;

alter table rm_prices
  add constraint rm_prices_import_fk
  foreign key (import_batch_id) references import_batches(id) on delete set null;

-- ----------------------------------------------------------- app_settings --
-- Semua ambang aplikasi (tier harga, status bridger, batas pelarut, dominasi)
-- ada di sini supaya bisa dikalibrasi tanpa deploy. Default-nya di
-- lib/settings.ts.
create table app_settings (
  owner_id uuid primary key references profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
);

-- ------------------------------------------------------------ cost_sheets --
-- Konsentrat boleh berasal dari versi formula, bukan cuma FO manual.
-- Harganya dibekukan saat cost sheet disimpan: HPP yang pernah dipakai
-- menentukan harga jual tidak boleh berubah diam-diam karena pricelist baru.
alter table cost_sheets
  add column if not exists concentrate_source text not null default 'fo',
  add column if not exists concentrate_price_per_g_snapshot numeric(12,2);

alter table cost_sheets
  add constraint concentrate_source_valid
  check (concentrate_source in ('fo','formula'));

-- fo_price_per_g wajib di v1; di v2 bisa kosong kalau konsentratnya dari formula.
alter table cost_sheets alter column fo_price_per_g drop not null;
