-- 0004_rls.sql
-- Row Level Security aktif di SEMUA tabel sejak hari pertama, meski aplikasinya
-- masih single-user. Supaya membuka akses untuk murid kelas nanti tidak perlu
-- migrasi, dan supaya policy-nya ikut teruji sejak awal.
--
-- Selama fase 1-4 (belum ada auth) server actions memakai service-role key,
-- yang melewati RLS. JANGAN menonaktifkan RLS sebagai gantinya.

-- Helper: cek admin tanpa memicu RLS di profiles itu sendiri (security definer).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------- profiles --
alter table profiles enable row level security;

create policy "read own profile" on profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Insert profil dilakukan oleh trigger handle_new_user (security definer),
-- bukan oleh klien. Tidak ada policy insert di sini dengan sengaja.

-- ----------------------------------------------------------- raw_materials --
-- Tabel ini punya baris GLOBAL (owner_id null) hasil import pricelist, plus
-- baris tambahan milik tiap user.
alter table raw_materials enable row level security;

create policy "read global + own" on raw_materials
  for select using (owner_id is null or owner_id = auth.uid() or public.is_admin());

create policy "insert own only" on raw_materials
  for insert with check (owner_id = auth.uid());

create policy "update own only" on raw_materials
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "delete own only" on raw_materials
  for delete using (owner_id = auth.uid());

-- Admin mengelola baris global. USING dan WITH CHECK dua-duanya diisi —
-- policy FOR ALL yang hanya punya USING tidak mengizinkan insert.
create policy "admin manages all materials" on raw_materials
  for all using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------- rm_prices --
alter table rm_prices enable row level security;

create policy "read prices of visible materials" on rm_prices
  for select using (
    exists (
      select 1 from raw_materials m
      where m.id = rm_prices.raw_material_id
        and (m.owner_id is null or m.owner_id = auth.uid())
    )
  );

create policy "write prices of own materials" on rm_prices
  for all using (
    exists (
      select 1 from raw_materials m
      where m.id = rm_prices.raw_material_id and m.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from raw_materials m
      where m.id = rm_prices.raw_material_id and m.owner_id = auth.uid()
    )
  );

create policy "admin manages all prices" on rm_prices
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------- fragrance_oils --
-- Tidak ada baris global: FO adalah stok pribadi tiap orang.
alter table fragrance_oils enable row level security;

create policy "own rows" on fragrance_oils
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- --------------------------------------------------------------- formulas --
alter table formulas enable row level security;

create policy "own rows" on formulas
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- -------------------------------------------------------- formula_versions --
alter table formula_versions enable row level security;

create policy "via parent" on formula_versions
  for all using (
    exists (
      select 1 from formulas f
      where f.id = formula_versions.formula_id and f.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from formulas f
      where f.id = formula_versions.formula_id and f.owner_id = auth.uid()
    )
  );

-- ----------------------------------------------------------- formula_lines --
alter table formula_lines enable row level security;

create policy "via parent" on formula_lines
  for all using (
    exists (
      select 1 from formula_versions v
      join formulas f on f.id = v.formula_id
      where v.id = formula_lines.formula_version_id and f.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from formula_versions v
      join formulas f on f.id = v.formula_id
      where v.id = formula_lines.formula_version_id and f.owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------- evaluations --
alter table evaluations enable row level security;

create policy "own rows" on evaluations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------ evaluation_points --
alter table evaluation_points enable row level security;

create policy "via parent" on evaluation_points
  for all using (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_points.evaluation_id and e.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_points.evaluation_id and e.owner_id = auth.uid()
    )
  );

-- --------------------------------------------------------- packaging_items --
alter table packaging_items enable row level security;

create policy "own rows" on packaging_items
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------------ cost_sheets --
alter table cost_sheets enable row level security;

create policy "own rows" on cost_sheets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------- cost_sheet_items --
alter table cost_sheet_items enable row level security;

create policy "via parent" on cost_sheet_items
  for all using (
    exists (
      select 1 from cost_sheets c
      where c.id = cost_sheet_items.cost_sheet_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from cost_sheets c
      where c.id = cost_sheet_items.cost_sheet_id and c.owner_id = auth.uid()
    )
  );
