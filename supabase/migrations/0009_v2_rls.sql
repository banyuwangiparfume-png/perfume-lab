-- 0009_v2_rls.sql
-- RLS untuk tabel v2. Pola sama dengan v1: baris global boleh dibaca semua
-- orang, baris milik user hanya pemiliknya, penulisan global hanya admin.

-- ------------------------------------------------------------------ facets --
-- Daftar facet adalah data acuan bersama — semua orang boleh baca, hanya
-- admin yang boleh mengubah.
alter table facets enable row level security;

create policy "read facets" on facets
  for select using (true);

create policy "admin writes facets" on facets
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------ raw_material_facets --
alter table raw_material_facets enable row level security;

create policy "read facets of visible materials" on raw_material_facets
  for select using (
    exists (
      select 1 from raw_materials m
      where m.id = raw_material_facets.raw_material_id
        and (m.owner_id is null or m.owner_id = auth.uid())
    )
  );

create policy "write facets of own materials" on raw_material_facets
  for all using (
    exists (
      select 1 from raw_materials m
      where m.id = raw_material_facets.raw_material_id
        and m.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from raw_materials m
      where m.id = raw_material_facets.raw_material_id
        and m.owner_id = auth.uid()
    )
  );

create policy "admin manages all facets" on raw_material_facets
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ bridge_rules --
alter table bridge_rules enable row level security;

create policy "read global + own rules" on bridge_rules
  for select using (owner_id is null or owner_id = auth.uid());

create policy "write own rules" on bridge_rules
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "admin manages all rules" on bridge_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------- user_stock --
alter table user_stock enable row level security;

create policy "own rows" on user_stock
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------- import_batches --
alter table import_batches enable row level security;

create policy "own rows" on import_batches
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------------ app_settings --
alter table app_settings enable row level security;

create policy "own rows" on app_settings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
