-- 0013_save_version_rpc.sql
--
-- "Simpan versi" = membekukan draf kerja jadi versi bernomor.
--
-- Harus satu transaksi, karena tiga hal terjadi sekaligus: menghitung nomor
-- versi berikutnya, membuat barisnya, dan menyalin seluruh baris draf. Kalau
-- terputus di tengah, yang tersisa adalah versi kosong yang terlihat sah —
-- dan itu baru ketahuan berbulan-bulan kemudian saat formula mau dibuat ulang.
--
-- Advisory lock per formula membuat dua tab yang menyimpan bersamaan tidak
-- pernah menghasilkan nomor versi yang sama.

create or replace function public.save_formula_version(
  p_formula_id  uuid,
  p_change_note text default null,
  p_label       text default null
)
returns formula_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_draft formula_versions;
  v_next  integer;
  v_new   formula_versions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_formula_id::text, 0));

  select * into v_draft
    from formula_versions
   where formula_id = p_formula_id and version_no = 0;

  if v_draft.id is null then
    raise exception 'Draf kerja tidak ditemukan untuk formula ini';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_next
    from formula_versions
   where formula_id = p_formula_id and version_no > 0;

  insert into formula_versions (
    formula_id, version_no, label, change_note, parent_version_id, status,
    batch_g, top_pct, mid_pct, base_pct, price_tier_override
  )
  values (
    p_formula_id, v_next, p_label, p_change_note, v_draft.id, 'saved',
    v_draft.batch_g, v_draft.top_pct, v_draft.mid_pct, v_draft.base_pct,
    v_draft.price_tier_override
  )
  returning * into v_new;

  insert into formula_lines (
    formula_version_id, tier, line_type, raw_material_id, accord_version_id,
    fo_id, pct, is_locked, user_dilution_pct, user_solvent_id, note, sort_order
  )
  select
    v_new.id, tier, line_type, raw_material_id, accord_version_id,
    fo_id, pct, is_locked, user_dilution_pct, user_solvent_id, note, sort_order
  from formula_lines
  where formula_version_id = v_draft.id
  order by tier, sort_order;

  return v_new;
end $$;

-- Mengganti SELURUH baris draf dalam satu transaksi.
-- Draf boleh berubah bebas, tapi tidak boleh pernah separuh tersimpan — panel
-- analisa membaca baris yang sama, dan separuh data menghasilkan angka yang
-- terlihat masuk akal tapi salah.
create or replace function public.save_draft_lines(
  p_version_id uuid,
  p_lines      jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version_no integer;
  v_count      integer;
begin
  select version_no into v_version_no
    from formula_versions where id = p_version_id for update;

  if v_version_no is null then
    raise exception 'Versi tidak ditemukan';
  end if;
  if v_version_no <> 0 then
    raise exception 'Hanya draf kerja yang bisa diubah barisnya. Versi tersimpan dibekukan supaya catatan penciuman tetap merujuk ke formula yang benar.'
      using errcode = 'check_violation';
  end if;

  delete from formula_lines where formula_version_id = p_version_id;

  insert into formula_lines (
    formula_version_id, tier, line_type, raw_material_id, accord_version_id,
    fo_id, pct, is_locked, user_dilution_pct, user_solvent_id, note, sort_order
  )
  select
    p_version_id,
    (l->>'tier')::tier_key,
    (l->>'line_type')::line_type,
    nullif(l->>'raw_material_id', '')::uuid,
    nullif(l->>'accord_version_id', '')::uuid,
    nullif(l->>'fo_id', '')::uuid,
    (l->>'pct')::numeric,
    coalesce((l->>'is_locked')::boolean, false),
    coalesce((l->>'user_dilution_pct')::numeric, 100),
    nullif(l->>'user_solvent_id', '')::uuid,
    nullif(l->>'note', ''),
    (t.ord - 1)::integer
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as t(l, ord);

  get diagnostics v_count = row_count;
  return v_count;
end $$;
