"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/action-result";
import {
  parseMaterialRows,
  type MaterialColumn,
  type ParseFailure,
} from "@/lib/csv/parseMaterials";
import { getOwnerId } from "@/lib/owner";
import { getDb } from "@/lib/supabase/db";

const CHUNK = 200;

const chunk = <T>(xs: T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
};

/**
 * Koreksi nilai impact dari hasil penciuman sendiri.
 *
 * Disimpan di kolom terpisah dari nilai supplier, dan import ulang tidak boleh
 * menimpanya. Lama-lama kolom inilah yang jadi aset asli aplikasi ini —
 * angka supplier bucketed (94 bahan bernilai persis 100), bagus untuk
 * mendeteksi kelebihan dosis tapi tidak untuk presisi.
 */
export async function setImpactOverride(
  id: string,
  value: number | null,
  note: string | null,
): Promise<ActionResult> {
  if (value != null && (!Number.isFinite(value) || value < 0)) {
    return fail("Nilai impact harus angka 0 atau lebih.", "value");
  }
  if (value != null && !note?.trim()) {
    return fail(
      "Tulis alasan koreksinya. Tiga bulan lagi kamu tidak akan ingat kenapa angkanya diubah.",
      "note",
    );
  }

  const db = getDb();
  const { error } = await db
    .from("raw_materials")
    .update({
      odor_impact_override: value,
      odor_impact_note: value == null ? null : note!.trim(),
    })
    .eq("id", id);

  if (error) return fail(describeDbError(error));

  revalidatePath(`/materials/${id}`);
  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  return ok();
}

const materialInput = z.object({
  name: z.string().trim().min(1, "Nama bahan wajib diisi"),
  synonym: z.string().trim().nullable().optional(),
  cas_number: z.string().trim().nullable().optional(),
  family: z.string().trim().nullable().optional(),
  category: z.string().trim().nullable().optional(),
  odour_profile: z.string().trim().nullable().optional(),
  function_category: z
    .enum(["diffuser", "modifier", "bridger", "fixative"])
    .nullable()
    .optional(),
  odor_impact: z.number().min(0).nullable().optional(),
  default_dilution_pct: z.number().gt(0).max(100).optional(),
  default_solvent: z.string().trim().nullable().optional(),
  tgsc_url: z.string().trim().nullable().optional(),
  supplier: z.string().trim().nullable().optional(),
  personal_note: z.string().trim().nullable().optional(),
});

const nullable = (v: string | null | undefined) =>
  v && v.trim() ? v.trim() : null;

export async function createMaterial(
  input: z.input<typeof materialInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = materialInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path[0] ?? ""));
  }
  const v = parsed.data;

  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("raw_materials")
    .insert({
      owner_id: ownerId,
      name: v.name,
      synonym: nullable(v.synonym),
      cas_number: nullable(v.cas_number),
      family: nullable(v.family),
      category: nullable(v.category),
      odour_profile: nullable(v.odour_profile),
      function_category: v.function_category ?? null,
      odor_impact: v.odor_impact ?? null,
      default_dilution_pct: v.default_dilution_pct ?? 100,
      default_solvent: nullable(v.default_solvent),
      tgsc_url: nullable(v.tgsc_url),
      supplier: nullable(v.supplier),
      personal_note: nullable(v.personal_note),
    })
    .select("id")
    .single();

  if (error || !data) {
    return fail(describeDbError(error ?? { message: "Gagal menyimpan bahan" }));
  }

  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  return ok({ id: data.id });
}

export async function updateMaterial(
  id: string,
  input: z.input<typeof materialInput>,
): Promise<ActionResult> {
  const parsed = materialInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path[0] ?? ""));
  }
  const v = parsed.data;

  const db = getDb();
  const { error } = await db
    .from("raw_materials")
    .update({
      name: v.name,
      synonym: nullable(v.synonym),
      cas_number: nullable(v.cas_number),
      family: nullable(v.family),
      category: nullable(v.category),
      odour_profile: nullable(v.odour_profile),
      function_category: v.function_category ?? null,
      odor_impact: v.odor_impact ?? null,
      ...(v.default_dilution_pct !== undefined
        ? { default_dilution_pct: v.default_dilution_pct }
        : {}),
      default_solvent: nullable(v.default_solvent),
      tgsc_url: nullable(v.tgsc_url),
      supplier: nullable(v.supplier),
      ...(v.personal_note !== undefined
        ? { personal_note: nullable(v.personal_note) }
        : {}),
    })
    .eq("id", id);

  if (error) return fail(describeDbError(error));

  revalidatePath(`/materials/${id}`);
  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  return ok();
}

export async function setMaterialActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const db = getDb();
  const { error } = await db
    .from("raw_materials")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return fail(describeDbError(error));
  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  return ok();
}

export async function upsertPrices(
  materialId: string,
  tiers: { tier_size: number; price_idr: number }[],
  effectiveDate?: string,
): Promise<ActionResult> {
  const db = getDb();
  const date = effectiveDate ?? new Date().toISOString().slice(0, 10);

  const rows = tiers
    .filter((t) => t.tier_size > 0 && t.price_idr >= 0)
    .map((t) => ({
      raw_material_id: materialId,
      tier_size: t.tier_size,
      price_idr: t.price_idr,
      effective_date: date,
    }));

  if (!rows.length) return ok();

  // Membuat baris BARU dengan effective_date hari ini. Harga lama tidak
  // dihapus — riwayat harga berguna untuk melihat pergerakan biaya.
  const { error } = await db
    .from("rm_prices")
    .upsert(rows, { onConflict: "raw_material_id,tier_size,effective_date" });

  if (error) return fail(describeDbError(error));

  revalidatePath(`/materials/${materialId}`);
  return ok();
}

export type ImportSummary = {
  read: number;
  created: number;
  updated: number;
  priceRows: number;
  failures: ParseFailure[];
};

/**
 * Validasi tanpa menulis apa pun. Dipakai untuk layar ringkasan sebelum
 * konfirmasi, supaya user melihat berapa yang baru, berapa yang di-update, dan
 * baris mana yang gagal beserta alasannya.
 */
export async function validateMaterialsCsv(
  rawRows: Record<string, unknown>[],
  columnMap: Partial<Record<MaterialColumn, string>>,
): Promise<ActionResult<ImportSummary>> {
  const { rows, failures } = parseMaterialRows(rawRows, columnMap);
  const existing = await loadGlobalIndex();

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const match = matchExisting(existing, r.cas_number, r.name);
    if (match) updated++;
    else created++;
  }

  return ok({
    read: rawRows.length,
    created,
    updated,
    priceRows: rows.reduce((a, r) => a + r.prices.length, 0),
    failures,
  });
}

type GlobalIndex = {
  byCas: Map<string, string>;
  byName: Map<string, string>;
};

async function loadGlobalIndex(): Promise<GlobalIndex> {
  const db = getDb();
  const byCas = new Map<string, string>();
  const byName = new Map<string, string>();

  // Pricelist bisa 400+ baris dan master bisa tumbuh; ambil berhalaman supaya
  // tidak kena batas baris PostgREST.
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("raw_materials")
      .select("id, name, cas_number")
      .is("owner_id", null)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(describeDbError(error));
    for (const row of data ?? []) {
      if (row.cas_number) byCas.set(row.cas_number, row.id);
      byName.set(row.name.toLowerCase(), row.id);
    }
    if (!data || data.length < PAGE) break;
  }

  return { byCas, byName };
}

/** Kunci pencocokan utama adalah CAS number, nama hanya cadangan. */
function matchExisting(
  index: GlobalIndex,
  cas: string | null,
  name: string,
): string | null {
  if (cas) {
    const byCas = index.byCas.get(cas);
    if (byCas) return byCas;
  }
  return index.byName.get(name.toLowerCase()) ?? null;
}

/**
 * Import pricelist ke master bahan GLOBAL (owner_id null).
 *
 * Aturan yang tidak boleh dilanggar:
 *  - Kunci pencocokan utama CAS number, nama cadangan
 *  - JANGAN pernah menimpa odor_impact_override, odor_impact_note, dan
 *    personal_note — itu hasil belajar user, bukan data supplier. Caranya:
 *    kolom-kolom itu tidak pernah masuk payload, jadi tidak mungkin tersentuh.
 *  - Kolom impact kosong tetap null, jangan diisi 0 atau 100
 *  - Idempoten: file yang sama dijalankan dua kali tidak membuat duplikat
 */
export async function importMaterialsCsv(
  rawRows: Record<string, unknown>[],
  columnMap: Partial<Record<MaterialColumn, string>>,
): Promise<ActionResult<ImportSummary>> {
  const { rows, failures } = parseMaterialRows(rawRows, columnMap);
  if (!rows.length) {
    return fail(
      failures.length
        ? `Tidak ada baris yang valid dari ${rawRows.length} baris terbaca. Perbaiki dulu baris yang gagal.`
        : "File tidak berisi baris data.",
    );
  }

  const db = getDb();
  const existing = await loadGlobalIndex();

  const payload = rows.map((r) => {
    const id = matchExisting(existing, r.cas_number, r.name);
    return {
      ...(id ? { id } : {}),
      owner_id: null,
      name: r.name,
      synonym: r.synonym,
      cas_number: r.cas_number,
      family: r.family,
      category: r.category,
      odour_profile: r.odour_profile,
      function_category: r.function_category,
      odor_impact: r.odor_impact,
      tgsc_url: r.tgsc_url,
      _line: r.line,
      _isNew: !id,
    };
  });

  const created = payload.filter((p) => p._isNew).length;
  const updated = payload.length - created;

  // Baris lama dan baris baru dikirim terpisah karena bentuk payload-nya beda
  // (yang lama membawa id untuk ON CONFLICT, yang baru tidak).
  const toInsert = payload.filter((p) => p._isNew);
  const toUpdate = payload.filter((p) => !p._isNew);

  const lineToId = new Map<number, string>();

  for (const batch of chunk(toUpdate)) {
    const { data, error } = await db
      .from("raw_materials")
      .upsert(
        batch.map(({ _line, _isNew, ...r }) => r),
        { onConflict: "id" },
      )
      .select("id, name, cas_number");
    if (error) return fail(`Gagal memperbarui bahan: ${describeDbError(error)}`);
    mapBackIds(batch, data ?? [], lineToId);
  }

  for (const batch of chunk(toInsert)) {
    const { data, error } = await db
      .from("raw_materials")
      .insert(batch.map(({ _line, _isNew, id: _id, ...r }) => r))
      .select("id, name, cas_number");
    if (error) return fail(`Gagal menambah bahan: ${describeDbError(error)}`);
    mapBackIds(batch, data ?? [], lineToId);
  }

  // Harga masuk sebagai baris baru di rm_prices dengan effective_date hari ini.
  const today = new Date().toISOString().slice(0, 10);
  const priceRows = rows.flatMap((r) => {
    const id = lineToId.get(r.line);
    if (!id) return [];
    return r.prices.map((p) => ({
      raw_material_id: id,
      tier_size: p.tier_size,
      price_idr: p.price_idr,
      effective_date: today,
    }));
  });

  for (const batch of chunk(priceRows)) {
    const { error } = await db
      .from("rm_prices")
      .upsert(batch, {
        onConflict: "raw_material_id,tier_size,effective_date",
      });
    if (error) return fail(`Gagal menyimpan harga: ${describeDbError(error)}`);
  }

  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  revalidatePath("/");

  return ok({
    read: rawRows.length,
    created,
    updated,
    priceRows: priceRows.length,
    failures,
  });
}

function mapBackIds(
  batch: { _line: number; name: string; cas_number: string | null }[],
  returned: { id: string; name: string; cas_number: string | null }[],
  into: Map<number, string>,
) {
  const byCas = new Map(
    returned.filter((r) => r.cas_number).map((r) => [r.cas_number!, r.id]),
  );
  const byName = new Map(returned.map((r) => [r.name.toLowerCase(), r.id]));
  for (const row of batch) {
    const id =
      (row.cas_number ? byCas.get(row.cas_number) : undefined) ??
      byName.get(row.name.toLowerCase());
    if (id) into.set(row._line, id);
  }
}
