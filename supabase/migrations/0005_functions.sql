-- 0005_functions.sql
-- Trigger updated_at, pengaman role, dan RPC yang harus berjalan dalam SATU
-- transaksi: pembuatan versi dan penyimpanan baris.

-- ------------------------------------------------------------ updated_at --
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger raw_materials_touch   before update on raw_materials
  for each row execute function public.touch_updated_at();
create trigger fragrance_oils_touch  before update on fragrance_oils
  for each row execute function public.touch_updated_at();
create trigger formulas_touch        before update on formulas
  for each row execute function public.touch_updated_at();
create trigger cost_sheets_touch     before update on cost_sheets
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------- pengaman role --
-- Policy "update own profile" mengizinkan user mengubah profilnya sendiri,
-- tapi role tidak boleh ikut berubah dari sana — kalau tidak, siapa pun bisa
-- mengangkat dirinya jadi admin.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role <> old.role and not public.is_admin() then
    raise exception 'role hanya bisa diubah oleh admin';
  end if;
  return new;
end $$;

create trigger profiles_guard_role before update on profiles
  for each row execute function public.guard_profile_role();

-- ------------------------------------------- pembuatan versi (atomik) --
-- version_no tidak boleh bentrok walau dua tab dibuka bersamaan. Advisory lock
-- per formula membuat pembacaan max(version_no) dan insert-nya jadi satu
-- langkah yang tidak bisa disela.
create or replace function public.create_formula_version(
  p_formula_id       uuid,
  p_label            text default null,
  p_change_note      text default null,
  p_parent_version_id uuid default null,
  p_batch_size_g     numeric default 10
)
returns formula_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_next integer;
  v_row  formula_versions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_formula_id::text, 0));

  select coalesce(max(version_no), 0) + 1 into v_next
  from formula_versions where formula_id = p_formula_id;

  insert into formula_versions
    (formula_id, version_no, label, change_note, parent_version_id, batch_size_g)
  values
    (p_formula_id, v_next, p_label, p_change_note, p_parent_version_id, p_batch_size_g)
  returning * into v_row;

  return v_row;
end $$;

-- --------------------------------------- duplikat versi beserta barisnya --
-- Menyalin SEMUA baris beserta dilusi dan pelarutnya. Kalau dilusi tidak ikut
-- tersalin, formula hasil duplikat tidak bisa direproduksi.
create or replace function public.duplicate_formula_version(
  p_version_id  uuid,
  p_change_note text,
  p_label       text default null
)
returns formula_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_src formula_versions;
  v_new formula_versions;
begin
  select * into v_src from formula_versions where id = p_version_id;
  if v_src.id is null then
    raise exception 'versi tidak ditemukan';
  end if;

  v_new := public.create_formula_version(
    v_src.formula_id, p_label, p_change_note, v_src.id, v_src.batch_size_g
  );

  insert into formula_lines (
    formula_version_id, line_type, raw_material_id, fo_id, sub_formula_version_id,
    weight_g, dilution_pct, solvent, note, sort_order
  )
  select
    v_new.id, line_type, raw_material_id, fo_id, sub_formula_version_id,
    weight_g, dilution_pct, solvent, note, sort_order
  from formula_lines
  where formula_version_id = p_version_id
  order by sort_order;

  return v_new;
end $$;

-- ------------------------------------------- penyimpanan baris (atomik) --
-- Ganti SELURUH baris sebuah versi dalam satu transaksi, supaya tidak pernah
-- ada versi yang separuh tersimpan.
--
-- p_lines adalah array json:
--   [{ "line_type": "raw_material", "raw_material_id": "...", "weight_g": 2.5,
--      "dilution_pct": 10, "solvent": "DPG", "note": null, "sort_order": 0 }, ...]
create or replace function public.save_formula_lines(
  p_version_id uuid,
  p_lines      jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status   version_status;
  v_count    integer;
  v_cycle    boolean;
  v_depth    integer;
  v_max_depth constant integer := 3;   -- samakan dengan T.maxSubFormulaDepth
begin
  select status into v_status from formula_versions where id = p_version_id for update;
  if v_status is null then
    raise exception 'versi tidak ditemukan';
  end if;

  -- Versi tidak pernah diubah setelah dievaluasi. Begitu sebuah versi punya
  -- evaluasi, perubahan harus membuat versi baru — kalau tidak, catatan
  -- penciuman jadi menggantung ke formula yang sudah berbeda.
  if v_status in ('evaluated', 'locked') then
    raise exception 'versi berstatus % tidak bisa diubah barisnya, duplikat jadi versi baru', v_status
      using errcode = 'check_violation';
  end if;

  delete from formula_lines where formula_version_id = p_version_id;

  insert into formula_lines (
    formula_version_id, line_type, raw_material_id, fo_id, sub_formula_version_id,
    weight_g, dilution_pct, solvent, note, sort_order
  )
  select
    p_version_id,
    (l->>'line_type')::line_type,
    nullif(l->>'raw_material_id', '')::uuid,
    nullif(l->>'fo_id', '')::uuid,
    nullif(l->>'sub_formula_version_id', '')::uuid,
    (l->>'weight_g')::numeric,
    coalesce((l->>'dilution_pct')::numeric, 100),
    nullif(l->>'solvent', ''),
    nullif(l->>'note', ''),
    coalesce((l->>'sort_order')::integer, (t.ord - 1)::integer)
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as t(l, ord);

  get diagnostics v_count = row_count;

  -- Jaring pengaman siklus & kedalaman. Pencegahan utamanya ada di aplikasi
  -- (lib/calc/cycle.ts) supaya pesannya bisa menyebut nama formula, tapi
  -- database tetap menolak kalau sampai lolos ke sini.
  with recursive reach as (
    select l.sub_formula_version_id as vid, 1 as depth
    from formula_lines l
    where l.formula_version_id = p_version_id
      and l.sub_formula_version_id is not null
    union all
    select l.sub_formula_version_id, r.depth + 1
    from reach r
    join formula_lines l on l.formula_version_id = r.vid
    where l.sub_formula_version_id is not null
      and r.depth < 10          -- berhenti walau datanya sudah bersiklus
  )
  select bool_or(vid = p_version_id), coalesce(max(depth), 0)
  into v_cycle, v_depth
  from reach;

  if coalesce(v_cycle, false) then
    raise exception 'baris sub-formula membentuk siklus'
      using errcode = 'check_violation';
  end if;

  if v_depth + 1 > v_max_depth then
    raise exception 'sarang sub-formula % tingkat, maksimal %', v_depth + 1, v_max_depth
      using errcode = 'check_violation';
  end if;

  return v_count;
end $$;
