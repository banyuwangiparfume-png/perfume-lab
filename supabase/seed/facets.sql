-- facets.sql
-- 20 facet beserta warnanya. Dibangkitkan dari seed/facet-keywords.json dan
-- tabel warna di PRD file 04 §1.6 — jangan diketik ulang manual, jalankan
-- ulang generatornya kalau daftar facet berubah.
--
-- Warna sengaja disimpan di database, bukan di kode: pie, bar facet, dan chip
-- harus memakai warna yang sama persis supaya user lama-lama hafal
-- "ungu = floral" tanpa membaca legenda.

insert into facets (key, label, color, sort_order) values
  ('citrus', 'Citrus', '#e5b100', 1),
  ('green', 'Green', '#4f9d3a', 2),
  ('aromatic', 'Aromatik/Herbal', '#2f9c8f', 3),
  ('fruity', 'Fruity', '#e8668a', 4),
  ('floral', 'Floral', '#b04fa0', 5),
  ('rose', 'Rose', '#d94a64', 6),
  ('white', 'White floral', '#9b7fd1', 7),
  ('powdery', 'Powdery/Iris', '#a99cc9', 8),
  ('clean', 'Clean/Aldehydic', '#6fb0e0', 9),
  ('aquatic', 'Marine/Ozonic', '#1f7fc4', 10),
  ('spicy', 'Spicy', '#d2691e', 11),
  ('woody', 'Woody', '#8b5a2b', 12),
  ('earthy', 'Earthy/Mossy', '#6b7b3a', 13),
  ('amber', 'Amber', '#c98a1b', 14),
  ('resin', 'Balsamic/Resin', '#9c4a2f', 15),
  ('gourmand', 'Sweet/Gourmand', '#a8743f', 16),
  ('creamy', 'Creamy/Lactonic', '#d9b98c', 17),
  ('musk', 'Musk', '#7d8ba8', 18),
  ('animalic', 'Animalic/Leather', '#5a3e36', 19),
  ('smoky', 'Smoky/Tobacco', '#4a4f57', 20)
on conflict (key) do update set
  label = excluded.label,
  color = excluded.color,
  sort_order = excluded.sort_order;
