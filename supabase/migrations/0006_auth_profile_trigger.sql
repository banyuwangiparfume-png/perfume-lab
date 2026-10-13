-- 0006_auth_profile_trigger.sql
-- Pembuatan profil otomatis saat user baru mendaftar.
--
-- Ini bagian dari FASE 5 (auth), tapi aman dijalankan sekarang: tanpa user
-- baru yang mendaftar, trigger-nya tidak pernah menyala. Menjalankannya lebih
-- awal berarti akun pertama yang dibuat nanti sudah langsung punya profil.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
