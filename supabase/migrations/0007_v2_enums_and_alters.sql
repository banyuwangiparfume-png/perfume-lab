-- 0007_v2_enums_and_alters.sql
-- PRD v2 — kalkulator aroma berbasis piramida.
--
-- Dijalankan SETELAH 0001–0006. Aman di dua kondisi: database yang masih
-- kosong (0001–0006 baru saja dijalankan) maupun yang sudah berisi data v1.
--
-- Perubahan paling mendasar dari v1: **persen jadi sumber kebenaran baris
-- formula, gram jadi turunan.** v2 sering mengubah skala batch (3 g ↔ 120 g);
-- menyimpan gram memaksa konversi ulang tiap kali dan merusak reproduksi.
--
-- PERHATIAN: setelah migrasi ini, layar formula v1 (editor berbasis gram,
-- compare, detail) tidak lagi cocok dengan skemanya. Modul evaluasi dan
-- maserasi tetap jalan. Layar formula dibangun ulang di tahap berikutnya.

-- ------------------------------------------------------------- enum baru --
create type formula_category as enum ('fragrance','accord');
create type tier_key         as enum ('top','mid','base','all');
create type rule_source      as enum ('temen','klasik','saya');
create type impact_basis     as enum ('as_sold','active');
create type import_status    as enum ('previewed','applied','discarded');

-- `saved` memisahkan versi tersimpan dari draf kerja (version_no = 0).
alter type version_status add value if not exists 'saved' after 'draft';

-- v1 menyebutnya sub_formula; v2 menyebutnya accord, dan hanya formula
-- berkategori accord yang boleh dipakai sebagai komponen.
alter type line_type rename value 'sub_formula' to 'accord';

-- ----------------------------------------------------------- raw_materials --
alter table raw_materials
  add column if not exists name_normalized       text,
  add column if not exists fr_fl                 text,
  add column if not exists supplier_dilution_pct numeric(7,4) not null default 100,
  add column if not exists supplier_solvent_id   uuid references raw_materials(id),
  add column if not exists last_seen_import_id   uuid,
  add column if not exists impact_basis          impact_basis not null default 'as_sold',
  add column if not exists note_tier_hint        tier_key,
  add column if not exists facets_manual         boolean not null default false,
  add column if not exists is_bridge_candidate   boolean not null default true,
  add column if not exists is_solvent            boolean not null default false;

-- Normalisasi nama: file Ecofragrantica memuat karakter tak terlihat (U+2060
-- dan kerabatnya) yang membuat dua baris identik terlihat berbeda.
create or replace function public.normalize_material_name(s text)
returns text language sql immutable as $$
  select regexp_replace(
           lower(regexp_replace(normalize(s, NFKC), '[⁠​-‍﻿]', '', 'g')),
           '[^a-z0-9]+', '', 'g')
$$;

update raw_materials
   set name_normalized = public.normalize_material_name(name)
 where name_normalized is null;

alter table raw_materials alter column name_normalized set not null;

create or replace function public.touch_material_name_normalized()
returns trigger language plpgsql as $$
begin
  new.name_normalized = public.normalize_material_name(new.name);
  return new;
end $$;

create trigger raw_materials_normalize_name
  before insert or update of name on raw_materials
  for each row execute function public.touch_material_name_normalized();

-- Kunci keunikan pindah dari CAS ke NAMA.
-- Ecofragrantica menjual beberapa produk dengan CAS sama — "Ambroxan" dan
-- "Ambroxan 10-TEC" adalah dua produk berbeda dengan CAS identik. Index unik
-- berbasis CAS dari v1 akan menolak salah satunya.
drop index if exists raw_materials_cas_global_uniq;
drop index if exists raw_materials_name_global_uniq;

create unique index raw_materials_global_name_uniq
  on raw_materials (name_normalized) where owner_id is null;

create index if not exists raw_materials_category_idx on raw_materials (category);
create index if not exists raw_materials_search_idx
  on raw_materials using gin (
    to_tsvector('simple', name || ' ' || coalesce(synonym, ''))
  );

-- --------------------------------------------------------------- rm_prices --
alter table rm_prices rename column tier_grams to tier_size;
alter table rm_prices add column if not exists import_batch_id uuid;

-- Harga yang dipakai kalkulasi: baris terbaru per (bahan, tier).
create or replace view rm_current_prices as
select distinct on (raw_material_id, tier_size)
       raw_material_id,
       tier_size,
       price_idr,
       price_idr / tier_size as price_per_unit,
       effective_date
  from rm_prices
 order by raw_material_id, tier_size, effective_date desc;

-- ---------------------------------------------------------------- formulas --
alter table formulas
  add column if not exists category      formula_category,
  add column if not exists pyramid_mode  boolean not null default false,
  add column if not exists target_family text;

-- Tipe v1 dipetakan: apa pun yang dulu dipakai sebagai komponen jadi accord.
update formulas
   set category = case
         when type in ('accord','base','booster') then 'accord'::formula_category
         else 'fragrance'::formula_category
       end
 where category is null;

update formulas set target_family = target_category where target_family is null;

alter table formulas alter column category set not null;
alter table formulas alter column category set default 'fragrance';

create index if not exists formulas_category_idx
  on formulas (owner_id, category, is_archived);

-- -------------------------------------------------------- formula_versions --
alter table formula_versions rename column batch_size_g to batch_g;

alter table formula_versions
  add column if not exists top_pct             numeric(7,4),
  add column if not exists mid_pct             numeric(7,4),
  add column if not exists base_pct            numeric(7,4),
  add column if not exists price_tier_override numeric(10,2),
  add column if not exists updated_at          timestamptz not null default now();

-- version_no = 0 adalah draf kerja yang di-autosave, jadi batas bawahnya turun.
alter table formula_versions drop constraint if exists version_no_positive;
alter table formula_versions
  add constraint version_no_nonneg check (version_no >= 0);

-- Draf tidak perlu catatan perubahan; versi tersimpan ke-2 ke atas tetap wajib.
alter table formula_versions drop constraint if exists change_note_required_after_v1;
alter table formula_versions
  add constraint change_note_required_after_v1 check (
    version_no <= 1 or (change_note is not null and btrim(change_note) <> '')
  );

-- Piramida wajib berjumlah 100 — TAPI hanya untuk versi tersimpan.
-- Draf boleh sementara 105% selagi user menggeser tier; banner merah di
-- header yang mengurusnya, bukan database.
alter table formula_versions
  add constraint pyramid_sum check (
    version_no = 0
    or top_pct is null
    or abs(top_pct + mid_pct + base_pct - 100) < 0.001
  );

create trigger formula_versions_touch before update on formula_versions
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------- formula_lines --
alter table formula_lines rename column dilution_pct to user_dilution_pct;
alter table formula_lines rename column sub_formula_version_id to accord_version_id;

alter table formula_lines
  add column if not exists tier            tier_key not null default 'all',
  add column if not exists pct             numeric(9,5),
  add column if not exists is_locked       boolean not null default true,
  add column if not exists user_solvent_id uuid references raw_materials(id);

-- Gram v1 jadi persen v2, dihitung dari total versinya masing-masing.
update formula_lines l
   set pct = round((l.weight_g * 100 / nullif(t.total, 0))::numeric, 5)
  from (
    select formula_version_id, sum(weight_g) as total
      from formula_lines group by formula_version_id
  ) t
 where t.formula_version_id = l.formula_version_id
   and l.pct is null;

update formula_lines set pct = 0 where pct is null;
alter table formula_lines alter column pct set not null;
alter table formula_lines add constraint pct_nonneg check (pct >= 0);

-- Pelarut pindah dari teks bebas ke FK, supaya bisa dijumlahkan dan dihargai.
-- Yang tidak bisa dipetakan otomatis dipindahkan ke catatan, bukan dibuang.
update formula_lines l
   set user_solvent_id = m.id
  from raw_materials m
 where l.user_solvent_id is null
   and l.solvent is not null
   and m.owner_id is null
   and m.name_normalized = public.normalize_material_name(l.solvent);

update formula_lines
   set note = btrim(coalesce(note, '') || ' [pelarut v1: ' || solvent || ']')
 where solvent is not null and user_solvent_id is null;

alter table formula_lines
  add constraint solvent_when_diluted check (
    user_dilution_pct = 100 or user_solvent_id is not null
  );

-- Constraint v1 memakai nama kolom lama; dibentuk ulang dengan nama baru.
alter table formula_lines drop constraint if exists ref_matches_type;
alter table formula_lines drop constraint if exists no_self_reference;

alter table formula_lines
  add constraint ref_matches_type check (
       (line_type = 'raw_material' and raw_material_id is not null
          and accord_version_id is null and fo_id is null)
    or (line_type = 'accord'       and accord_version_id is not null
          and raw_material_id is null and fo_id is null)
    or (line_type = 'fo'           and fo_id is not null
          and raw_material_id is null and accord_version_id is null)
  ),
  add constraint no_self_ref check (
    accord_version_id is null or accord_version_id <> formula_version_id
  );

create index if not exists formula_lines_tier_idx
  on formula_lines (formula_version_id, tier, sort_order);

-- Berat tidak lagi dipakai. Dibiarkan dulu supaya konversi di atas bisa
-- diperiksa; hapus lewat migrasi terpisah setelah datanya diverifikasi:
--   alter table formula_lines drop column weight_g, drop column solvent;
alter table formula_lines alter column weight_g drop not null;
alter table formula_lines drop constraint if exists weight_positive;

-- --------------------------------------------------------- RPC v1 dilepas --
-- Ketiganya menulis kolom yang sudah tidak ada (weight_g, batch_size_g).
-- Penggantinya adalah server action v2 (saveDraft / saveVersion).
drop function if exists public.save_formula_lines(uuid, jsonb);
drop function if exists public.duplicate_formula_version(uuid, text, text);
drop function if exists public.create_formula_version(uuid, text, text, uuid, numeric);
