-- Koreksi user untuk kategori fungsi dan tier hint.
--
-- Mengikuti pola odor_impact_override: data supplier dan penilaian user hidup
-- di kolom BERBEDA, supaya import pricelist berikutnya tidak pernah menghapus
-- apa yang sudah dipelajari user sendiri.
--
-- Dua kolom ini perlu karena nilainya memang sering keliru untuk pemakainya:
-- Ecofragrantica memasukkan Linalool ke family Citrus sehingga tier hint-nya
-- jadi "top", padahal banyak perfumer memperlakukannya sebagai mid. Tanpa
-- kolom ini, satu-satunya cara memperbaikinya adalah mengubah data supplier,
-- yang akan tertimpa saat import berikutnya.

alter table raw_materials
  add column if not exists function_category_override function_category,
  add column if not exists note_tier_hint_override     tier_key,
  add column if not exists function_category_note      text;

comment on column raw_materials.function_category_override is
  'Koreksi user atas kategori fungsi supplier. Import tidak pernah menimpanya.';
comment on column raw_materials.note_tier_hint_override is
  'Koreksi user atas tier hint. Import tidak pernah menimpanya.';
comment on column raw_materials.function_category_note is
  'Alasan koreksi, supaya keputusannya masih bisa dibaca berbulan-bulan lagi.';
