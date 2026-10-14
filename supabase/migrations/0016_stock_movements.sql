-- Inventori sebagai BUKU BESAR, bukan satu kolom saldo.
--
-- Sisa stok dihitung dari jumlah seluruh pergerakan, bukan disimpan sebagai
-- angka yang ditimpa tiap transaksi. Alasannya: angka saldo yang ditimpa tidak
-- bisa menjawab "kenapa tinggal segini" — dan itu pertanyaan yang selalu muncul
-- justru saat angkanya terlihat salah.
--
-- Satu baris = satu kejadian nyata: beli, meracik, atau mengoreksi hitungan.

create type movement_kind as enum ('pembelian', 'produksi', 'penyesuaian');

create table stock_movements (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references profiles(id) on delete cascade,

  -- Tepat satu dari keduanya, sama seperti user_stock.
  raw_material_id    uuid references raw_materials(id) on delete cascade,
  fragrance_oil_id   uuid references fragrance_oils(id) on delete cascade,

  kind               movement_kind not null,

  -- Positif menambah, negatif mengurangi. Tandanya ikut jenisnya, tapi tidak
  -- dipaksakan di sini: penyesuaian boleh ke dua arah, dan retur pembelian
  -- juga nyata.
  qty_g              numeric(12,3) not null,

  -- Harga yang BENAR-BENAR dibayar, bukan harga pricelist. Keduanya berbeda,
  -- dan selisihnya baru kelihatan kalau yang dibayar ikut dicatat.
  unit_price_idr     numeric(14,2),

  -- Terisi untuk produksi: versi mana yang diracik.
  formula_version_id uuid references formula_versions(id) on delete set null,

  note               text,
  happened_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),

  constraint stock_movements_one_target check (
    (raw_material_id is not null and fragrance_oil_id is null)
    or
    (raw_material_id is null and fragrance_oil_id is not null)
  ),
  constraint stock_movements_qty_nonzero check (qty_g <> 0)
);

create index stock_movements_owner_idx on stock_movements (owner_id, happened_at desc);
create index stock_movements_rm_idx on stock_movements (owner_id, raw_material_id);
create index stock_movements_fo_idx on stock_movements (owner_id, fragrance_oil_id);
create index stock_movements_version_idx on stock_movements (formula_version_id);

alter table stock_movements enable row level security;

create policy "own rows" on stock_movements
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Sisa stok per bahan. View supaya satu-satunya definisi "sisa" hidup di
-- database, bukan diulang di tiap kueri yang kebetulan membutuhkannya.
create or replace view stock_on_hand as
select owner_id,
       raw_material_id,
       fragrance_oil_id,
       sum(qty_g)              as qty_g,
       max(happened_at)        as last_moved_at
  from stock_movements
 group by owner_id, raw_material_id, fragrance_oil_id;
