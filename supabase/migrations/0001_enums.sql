-- 0001_enums.sql
-- Tipe enum dasar. Jalankan paling pertama.

create type function_category  as enum ('diffuser','modifier','bridger','fixative');
create type formula_type       as enum ('accord','base','booster','full_perfume','experiment');
create type formula_source     as enum ('own','ecofragrantica','kurdlab','other');
create type version_status     as enum ('draft','mixed','evaluated','locked');
create type eval_medium        as enum ('blotter','skin','fabric');
-- Dua jenis penilaian yang TIDAK BOLEH dicampur. Lihat catatan di tabel
-- evaluations: membandingkan screening dengan final adalah kesalahan, dan
-- Rule 8 yang mencegahnya.
create type eval_purpose       as enum ('screening','final');
create type transition_verdict as enum ('smooth','broken','muddy');
create type user_role          as enum ('user','admin');
create type line_type          as enum ('raw_material','fo','sub_formula');
