-- Tandai stok gagal: "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification".
--
-- 0015 mengganti kunci tabel ini dengan dua indeks unik PARSIAL. Postgres
-- hanya bisa memakai indeks parsial untuk ON CONFLICT kalau predikat WHERE-nya
-- ikut disebut, dan PostgREST (upsert dari aplikasi) tidak pernah
-- menyebutkannya. Akibatnya setiap klik bintang ditolak.
--
-- Unique constraint biasa sudah cukup, dan alasan 0015 menghindarinya keliru:
-- NULL memang tidak pernah dianggap bentrok, tapi justru itu yang diinginkan.
-- Baris FO punya raw_material_id NULL, jadi mereka tidak saling bentrok di
-- constraint bahan — sementara baris bahan (raw_material_id terisi) tetap
-- tidak bisa dobel. Begitu juga sebaliknya untuk FO.

drop index if exists user_stock_rm_uniq;
drop index if exists user_stock_fo_uniq;

alter table user_stock
  drop constraint if exists user_stock_owner_rm_key,
  add constraint user_stock_owner_rm_key unique (owner_id, raw_material_id);

alter table user_stock
  drop constraint if exists user_stock_owner_fo_key,
  add constraint user_stock_owner_fo_key unique (owner_id, fragrance_oil_id);
