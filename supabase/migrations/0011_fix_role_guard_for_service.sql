-- 0011_fix_role_guard_for_service.sql
--
-- Perbaikan bug: guard_profile_role() memblokir seed dan skrip migrasi.
--
-- Trigger di 0005 menolak perubahan kolom `role` kecuali pemanggilnya admin.
-- Masalahnya, di luar sesi user — skrip seed, migrasi, Management API, SQL
-- Editor — `auth.uid()` bernilai null, jadi is_admin() mengembalikan false dan
-- trigger menolak pekerjaan administratif yang justru sah.
--
-- Gejalanya: seed.sql gagal di baris
--   insert into profiles (...) on conflict (id) do update set role = 'admin'
-- dengan "P0001: role hanya bisa diubah oleh admin".
--
-- Perbaikannya: pemeriksaan hanya berlaku kalau memang ADA user yang sedang
-- login. Ini tidak melonggarkan keamanan — RLS di profiles sudah membatasi
-- update hanya ke baris milik sendiri (`id = auth.uid()`), jadi satu-satunya
-- cara mencapai trigger ini dengan auth.uid() null adalah lewat service-role
-- atau superuser, yang memang sudah dipercaya penuh.
--
-- Yang tetap dicegah, dan itu intinya: user biasa yang sedang login mengangkat
-- dirinya sendiri jadi admin.

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'role hanya bisa diubah oleh admin'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
