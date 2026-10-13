-- seed.sql
-- Data awal untuk pengembangan fase 1-4, saat auth belum dipasang.
--
-- Semua tabel punya owner_id dengan FK ke profiles, dan profiles punya FK ke
-- auth.users. Jadi user dummy harus benar-benar ada di auth.users — bukan cuma
-- UUID yang dikarang. Baris di bawah membuatnya tanpa password: akun ini tidak
-- bisa dipakai login, fungsinya hanya memegang kepemilikan data pengembangan.
--
-- Di fase 5 nanti: daftar akun asli, lalu jalankan SQL pemindahan kepemilikan
-- di 05-auth-payment-deploy.md §1.2 langkah 7.
--
-- UUID ini harus sama dengan DEV_OWNER_ID di .env.local.

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'dev@perfumers-notebook.local',
  '', now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dev (pengembangan)"}'::jsonb
)
on conflict (id) do nothing;

-- Kalau migrasi 0006 sudah dijalankan, trigger on_auth_user_created sudah
-- membuat profilnya. Baris ini menangani kasus sebaliknya.
insert into profiles (id, email, display_name, role)
values (
  '00000000-0000-0000-0000-000000000001',
  'dev@perfumers-notebook.local',
  'Dev (pengembangan)',
  'admin'
)
on conflict (id) do update set role = 'admin';

-- ------------------------------------------------------- packaging items --
-- Dipakai kalkulator HPP. Biaya di bawah angka awal — sesuaikan dengan
-- harga supplier yang sebenarnya lewat /admin/packaging.
insert into packaging_items (owner_id, name, unit_cost_idr, unit)
values
  ('00000000-0000-0000-0000-000000000001', 'Botol 35ml',   6500, 'pcs'),
  ('00000000-0000-0000-0000-000000000001', 'Dus',          2500, 'pcs'),
  ('00000000-0000-0000-0000-000000000001', 'Sticker',       800, 'pcs'),
  ('00000000-0000-0000-0000-000000000001', 'Shrink Seal',   400, 'pcs'),
  ('00000000-0000-0000-0000-000000000001', 'Dus Packing',  1500, 'pcs'),
  ('00000000-0000-0000-0000-000000000001', 'Jasa Maklon',  3000, 'pcs')
on conflict do nothing;

-- ---------------------------------------------------------- master bahan --
-- Master raw material TIDAK di-seed dari sini. Import lewat /admin/materials
-- supaya pencocokan CAS, deteksi duplikat, dan laporan baris gagal ikut jalan.
--
-- Prioritaskan ~40 bahan yang benar-benar dimiliki lebih dulu, bukan seluruh
-- katalog pricelist: coverage data untuk bahan yang dimiliki hampir 100%,
-- sementara seluruh katalog hanya 72%. Daftar kecil yang datanya bersih jauh
-- lebih berguna daripada katalog besar yang bolong.
--
-- Untuk smoke test sebelum pricelist asli masuk, tersedia
-- supabase/seed/materials.sample.csv (8 bahan dari tabel contoh di PRD).
