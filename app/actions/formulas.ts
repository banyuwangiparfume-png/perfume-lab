"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  describeDbError,
  fail,
  ok,
  type ActionResult,
} from "@/lib/action-result";
import { getOwnerId } from "@/lib/owner";
import { getDb } from "@/lib/supabase/db";

const pyramidSchema = z.object({
  top: z.number().min(0).max(100),
  mid: z.number().min(0).max(100),
  base: z.number().min(0).max(100),
});

const formulaInput = z.object({
  name: z.string().trim().min(1, "Nama formula wajib diisi"),
  category: z.enum(["fragrance", "accord"]),
  pyramid_mode: z.boolean(),
  batch_g: z.number().positive("Ukuran batch harus di atas 0").default(10),
  pyramid: pyramidSchema.nullable().optional(),
  target_family: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

const blank = (v: string | null | undefined) =>
  v && v.trim() ? v.trim() : null;

/**
 * Membuat formula beserta DRAF KERJA-nya (version_no = 0).
 *
 * Draf itu yang diedit dan di-autosave; "Simpan versi" membekukannya jadi versi
 * bernomor. Dibuat sekaligus di sini supaya editor tidak pernah menghadapi
 * formula tanpa draf — keadaan yang cuma bikin penanganan khusus di mana-mana.
 */
export async function createFormula(
  input: z.input<typeof formulaInput>,
): Promise<ActionResult<{ formulaId: string; versionId: string }>> {
  const parsed = formulaInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path[0] ?? ""));
  }
  const v = parsed.data;

  if (v.pyramid_mode) {
    if (!v.pyramid) return fail("Isi dulu persentase piramidanya.", "pyramid");
    const total = v.pyramid.top + v.pyramid.mid + v.pyramid.base;
    if (Math.abs(total - 100) > 0.001) {
      return fail(
        `Piramida totalnya ${total.toFixed(1)}%, harus tepat 100%.`,
        "pyramid",
      );
    }
  }

  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: formula, error } = await db
    .from("formulas")
    .insert({
      owner_id: ownerId,
      name: v.name,
      category: v.category,
      pyramid_mode: v.pyramid_mode,
      target_family: blank(v.target_family),
      description: blank(v.description),
    })
    .select("id")
    .single();

  if (error || !formula) {
    return fail(describeDbError(error ?? { message: "Gagal membuat formula" }));
  }

  const { data: draft, error: dErr } = await db
    .from("formula_versions")
    .insert({
      formula_id: formula.id,
      version_no: 0,
      status: "draft",
      batch_g: v.batch_g,
      top_pct: v.pyramid_mode ? (v.pyramid?.top ?? null) : null,
      mid_pct: v.pyramid_mode ? (v.pyramid?.mid ?? null) : null,
      base_pct: v.pyramid_mode ? (v.pyramid?.base ?? null) : null,
    })
    .select("id")
    .single();

  if (dErr || !draft) {
    return fail(describeDbError(dErr ?? { message: "Gagal membuat draf" }));
  }

  revalidatePath("/formulas");
  revalidatePath("/");
  return ok({ formulaId: formula.id, versionId: draft.id });
}

const formulaMeta = z.object({
  name: z.string().trim().min(1, "Nama formula wajib diisi").optional(),
  category: z.enum(["fragrance", "accord"]).optional(),
  target_family: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

export async function updateFormula(
  id: string,
  input: z.input<typeof formulaMeta>,
): Promise<ActionResult> {
  const parsed = formulaMeta.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path[0] ?? ""));
  }
  const v = parsed.data;

  const db = getDb();
  const ownerId = await getOwnerId();

  const { error } = await db
    .from("formulas")
    .update({
      ...(v.name !== undefined ? { name: v.name } : {}),
      ...(v.category !== undefined ? { category: v.category } : {}),
      ...(v.target_family !== undefined
        ? { target_family: blank(v.target_family) }
        : {}),
      ...(v.description !== undefined
        ? { description: blank(v.description) }
        : {}),
    })
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) return fail(describeDbError(error));

  revalidatePath(`/formulas/${id}`);
  revalidatePath("/formulas");
  return ok();
}

export async function setFormulaArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const db = getDb();
  const ownerId = await getOwnerId();
  const { error } = await db
    .from("formulas")
    .update({ is_archived: archived })
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) return fail(describeDbError(error));
  revalidatePath("/formulas");
  return ok();
}

/**
 * Menyalin formula beserta isi drafnya ke formula baru.
 *
 * Riwayat versi sengaja TIDAK ikut: catatan perubahan tiap versi menceritakan
 * perjalanan formula aslinya, dan menyalinnya akan membuat dua pohon versi
 * yang isinya cerita yang sama.
 */
export async function duplicateFormula(
  id: string,
): Promise<ActionResult<{ formulaId: string; versionId: string }>> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: src, error } = await db
    .from("formulas")
    .select("*, versions:formula_versions(*)")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) return fail(describeDbError(error));
  if (!src) return fail("Formula tidak ditemukan.");

  type Src = typeof src & {
    versions: { id: string; version_no: number; batch_g: number;
      top_pct: number | null; mid_pct: number | null; base_pct: number | null;
      price_tier_override: number | null }[];
  };
  const s = src as unknown as Src;

  // Yang disalin adalah versi TERBARU yang punya isi: draf kalau ada,
  // kalau tidak versi tersimpan tertinggi.
  const source =
    s.versions.find((x) => x.version_no === 0) ??
    s.versions.slice().sort((a, b) => b.version_no - a.version_no)[0];

  const { data: copy, error: cErr } = await db
    .from("formulas")
    .insert({
      owner_id: ownerId,
      name: `${s.name} (salinan)`,
      category: s.category,
      pyramid_mode: s.pyramid_mode,
      target_family: s.target_family,
      description: s.description,
    })
    .select("id")
    .single();

  if (cErr || !copy) {
    return fail(describeDbError(cErr ?? { message: "Gagal menyalin formula" }));
  }

  const { data: draft, error: dErr } = await db
    .from("formula_versions")
    .insert({
      formula_id: copy.id,
      version_no: 0,
      status: "draft",
      batch_g: source?.batch_g ?? 10,
      top_pct: source?.top_pct ?? null,
      mid_pct: source?.mid_pct ?? null,
      base_pct: source?.base_pct ?? null,
      price_tier_override: source?.price_tier_override ?? null,
    })
    .select("id")
    .single();

  if (dErr || !draft) {
    return fail(describeDbError(dErr ?? { message: "Gagal membuat draf" }));
  }

  if (source) {
    const { data: lines, error: lErr } = await db
      .from("formula_lines")
      .select("*")
      .eq("formula_version_id", source.id)
      .order("sort_order");
    if (lErr) return fail(describeDbError(lErr));

    if (lines?.length) {
      const { error: insErr } = await db.from("formula_lines").insert(
        lines.map((l) => ({
          formula_version_id: draft.id,
          tier: l.tier,
          line_type: l.line_type,
          raw_material_id: l.raw_material_id,
          accord_version_id: l.accord_version_id,
          fo_id: l.fo_id,
          pct: l.pct,
          is_locked: l.is_locked,
          user_dilution_pct: l.user_dilution_pct,
          user_solvent_id: l.user_solvent_id,
          note: l.note,
          sort_order: l.sort_order,
        })),
      );
      if (insErr) return fail(describeDbError(insErr));
    }
  }

  revalidatePath("/formulas");
  return ok({ formulaId: copy.id, versionId: draft.id });
}

/**
 * Hapus permanen. Ditolak kalau formulanya sudah punya catatan evaluasi atau
 * dipakai sebagai accord di formula lain — dua hal yang tidak bisa dibuat
 * ulang dari mana pun.
 */
export async function deleteFormula(id: string): Promise<ActionResult> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: versions, error } = await db
    .from("formula_versions")
    .select("id, formula:formulas!inner(owner_id)")
    .eq("formula_id", id)
    .eq("formula.owner_id", ownerId);
  if (error) return fail(describeDbError(error));

  const versionIds = (versions ?? []).map((v) => v.id);
  if (versionIds.length) {
    const { count } = await db
      .from("evaluations")
      .select("id", { count: "exact", head: true })
      .in("formula_version_id", versionIds);
    if ((count ?? 0) > 0) {
      return fail(
        "Formula ini sudah punya catatan evaluasi, jadi tidak bisa dihapus. Arsipkan saja — catatan penciuman tidak bisa dibuat ulang.",
      );
    }
  }

  const { error: dErr } = await db
    .from("formulas")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (dErr) {
    return fail(
      dErr.code === "23503"
        ? "Formula ini dipakai sebagai accord di formula lain, jadi tidak bisa dihapus. Lepas dulu pemakaiannya, atau arsipkan saja."
        : describeDbError(dErr),
    );
  }

  revalidatePath("/formulas");
  revalidatePath("/");
  return ok();
}
