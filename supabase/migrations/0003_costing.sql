-- 0003_costing.sql
-- Packaging + cost sheet untuk kalkulator HPP (fase 5 di urutan build).
-- Tabelnya dibuat sekarang supaya skemanya utuh sejak awal.

create table packaging_items (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  name          text not null,              -- "Botol 35ml", "Dus", "Sticker"
  unit_cost_idr numeric(14,2) not null,
  unit          text not null default 'pcs',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),

  constraint packaging_cost_nonneg check (unit_cost_idr >= 0)
);

create index packaging_items_owner_idx on packaging_items (owner_id, is_active);

create table cost_sheets (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references profiles(id) on delete cascade,
  name               text not null,
  formula_version_id uuid references formula_versions(id) on delete set null,

  bottle_volume_ml   numeric(8,2) not null,
  fill_volume_ml     numeric(8,2) not null,
  -- Asumsi densitas 1 g/ml adalah PEMBULATAN, bukan kebenaran.
  -- Dicatat sebagai kolom supaya asumsinya terlihat, bukan tersembunyi di kode.
  density_assumed    numeric(6,3) not null default 1.0,

  fo_pct             numeric(6,3) not null default 30,
  -- Harga FO disimpan di cost sheet, bukan di raw_materials, karena FO adalah
  -- bibit jadi dari pihak ketiga — bukan raw material tunggal.
  fo_price_per_g     numeric(12,2) not null,
  booster_pct        numeric(6,3) not null default 6,
  ethanol_pct        numeric(6,3) not null default 59,
  water_pct          numeric(6,3) not null default 3,
  solubilizer_pct    numeric(6,3) not null default 2,
  solvent_cost_idr   numeric(12,2) not null default 0,  -- ethanol+aquades+poly20 digabung
  misc_cost_idr      numeric(12,2) not null default 0,

  het_price_idr      numeric(14,2),
  net_price_idr      numeric(14,2),        -- setelah potongan marketplace

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint cost_volumes_positive check (bottle_volume_ml > 0 and fill_volume_ml > 0),
  constraint cost_fill_fits        check (fill_volume_ml <= bottle_volume_ml),
  constraint cost_density_positive check (density_assumed > 0),
  constraint cost_pcts_total_100   check (
    abs((fo_pct + booster_pct + ethanol_pct + water_pct + solubilizer_pct) - 100) < 0.01
  )
);

create index cost_sheets_owner_idx on cost_sheets (owner_id);

create table cost_sheet_items (
  id                uuid primary key default gen_random_uuid(),
  cost_sheet_id     uuid not null references cost_sheets(id) on delete cascade,
  packaging_item_id uuid not null references packaging_items(id) on delete restrict,
  quantity          numeric(10,2) not null default 1,

  constraint cost_item_qty_positive check (quantity > 0),
  unique (cost_sheet_id, packaging_item_id)
);

create index cost_sheet_items_sheet_idx on cost_sheet_items (cost_sheet_id);
