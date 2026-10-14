-- Stok juga berlaku untuk FO.
--
-- Tabelnya semula hanya bisa menunjuk raw_materials, padahal pertanyaannya
-- sama saja untuk keduanya: "apakah botolnya ada di rak saya". FO yang tidak
-- bisa ditandai membuat filter "hanya stok saya" berbohong — dia akan
-- menyembunyikan FO yang justru dimiliki.
--
-- Satu baris menunjuk TEPAT SATU dari keduanya. Dipaksakan lewat constraint,
-- bukan lewat kesepakatan: baris yang menunjuk dua-duanya atau tidak sama
-- sekali tidak punya arti yang bisa dibaca.

alter table user_stock drop constraint if exists user_stock_pkey;

alter table user_stock
  alter column raw_material_id drop not null,
  add column if not exists fragrance_oil_id uuid
    references fragrance_oils(id) on delete cascade,
  add column if not exists id uuid not null default gen_random_uuid();

alter table user_stock
  drop constraint if exists user_stock_one_target,
  add constraint user_stock_one_target check (
    (raw_material_id is not null and fragrance_oil_id is null)
    or
    (raw_material_id is null and fragrance_oil_id is not null)
  );

alter table user_stock add primary key (id);

-- Indeks parsial, bukan unique gabungan: kolom yang null tidak pernah
-- dianggap bentrok oleh unique biasa, jadi satu bahan bisa masuk dua kali.
create unique index if not exists user_stock_rm_uniq
  on user_stock (owner_id, raw_material_id)
  where raw_material_id is not null;

create unique index if not exists user_stock_fo_uniq
  on user_stock (owner_id, fragrance_oil_id)
  where fragrance_oil_id is not null;
