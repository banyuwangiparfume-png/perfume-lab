"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { getOwnerId } from "@/lib/owner";
import { getDb } from "@/lib/supabase/db";

const formulaInput = z.object({
  name: z.string().trim().min(1, "Nama formula wajib diisi"),
  type: z.enum(["accord", "base", "booster", "full_perfume", "experiment"]),
  target_category: z.string().trim().optional().nullable(),
  source: z.enum(["own", "ecofragrantica", "kurdlab", "other"]).default("own"),
  source_note: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

const blankToNull = (v: string | null | undefined) =>
  v && v.trim() ? v.trim() : null;

/**
 * Membuat formula baru SEKALIGUS versi v1 yang masih kosong, lalu
 * mengembalikan id keduanya supaya pemanggil bisa langsung masuk ke editor.
 * Tidak ada halaman perantara.
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

  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: formula, error } = await db
    .from("formulas")
    .insert({
      owner_id: ownerId,
      name: v.name,
      type: v.type,
      source: v.source,
      target_category: blankToNull(v.target_category),
      source_note: blankToNull(v.source_note),
      description: blankToNull(v.description),
    })
    .select("id")
    .single();

  if (error || !formula) {
    return fail(describeDbError(error ?? { message: "Gagal membuat formula" }));
  }

  const { data: version, error: vErr } = await db
    .rpc("create_formula_version", {
      p_formula_id: formula.id,
      p_batch_size_g: 10,
    });

  if (vErr || !version) {
    return fail(describeDbError(vErr ?? { message: "Gagal membuat versi v1" }));
  }

  revalidatePath("/formulas");
  revalidatePath("/");
  return ok({ formulaId: formula.id, versionId: version.id });
}

export async function updateFormula(
  id: string,
  input: z.input<typeof formulaInput>,
): Promise<ActionResult> {
  const parsed = formulaInput.safeParse(input);
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
      name: v.name,
      type: v.type,
      source: v.source,
      target_category: blankToNull(v.target_category),
      source_note: blankToNull(v.source_note),
      description: blankToNull(v.description),
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
 * Duplikat formula beserta versi terakhirnya saja.
 *
 * Versi lama sengaja tidak ikut: riwayat revisi milik formula aslinya, dan
 * menyalinnya akan membuat dua pohon versi yang catatan perubahannya
 * menceritakan hal yang sama.
 */
export async function duplicateFormula(
  id: string,
): Promise<ActionResult<{ formulaId: string; versionId: string }>> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: src, error } = await db
    .from("formulas")
    .select("*, versions:formula_versions(id, version_no, batch_size_g)")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) return fail(describeDbError(error));
  if (!src) return fail("Formula tidak ditemukan.");

  type Src = {
    name: string;
    description: string | null;
    type: "accord" | "base" | "booster" | "full_perfume" | "experiment";
    target_category: string | null;
    source: "own" | "ecofragrantica" | "kurdlab" | "other";
    source_note: string | null;
    versions: { id: string; version_no: number; batch_size_g: number }[];
  };
  const s = src as unknown as Src;

  const { data: copy, error: cErr } = await db
    .from("formulas")
    .insert({
      owner_id: ownerId,
      name: `${s.name} (salinan)`,
      description: s.description,
      type: s.type,
      target_category: s.target_category,
      source: s.source,
      source_note: s.source_note,
      parent_formula_id: id,
    })
    .select("id")
    .single();

  if (cErr || !copy) {
    return fail(describeDbError(cErr ?? { message: "Gagal menyalin formula" }));
  }

  const latest = s.versions
    .slice()
    .sort((a, b) => b.version_no - a.version_no)[0];

  const { data: version, error: vErr } = await db
    .rpc("create_formula_version", {
      p_formula_id: copy.id,
      p_batch_size_g: latest?.batch_size_g ?? 10,
    });

  if (vErr || !version) {
    return fail(describeDbError(vErr ?? { message: "Gagal membuat versi v1" }));
  }

  if (latest) {
    const { data: lines, error: lErr } = await db
      .from("formula_lines")
      .select("*")
      .eq("formula_version_id", latest.id)
      .order("sort_order");

    if (lErr) return fail(describeDbError(lErr));

    if (lines?.length) {
      const { error: insErr } = await db.from("formula_lines").insert(
        lines.map((l) => ({
          formula_version_id: version.id,
          line_type: l.line_type,
          raw_material_id: l.raw_material_id,
          fo_id: l.fo_id,
          sub_formula_version_id: l.sub_formula_version_id,
          weight_g: l.weight_g,
          dilution_pct: l.dilution_pct,
          solvent: l.solvent,
          note: l.note,
          sort_order: l.sort_order,
        })),
      );
      if (insErr) return fail(describeDbError(insErr));
    }
  }

  revalidatePath("/formulas");
  return ok({ formulaId: copy.id, versionId: version.id });
}

/**
 * Hapus permanen. Hanya diizinkan kalau formula belum punya evaluasi —
 * catatan penciuman tidak bisa dibuat ulang, jadi tidak boleh hilang gara-gara
 * satu klik. Formula yang sudah dinilai diarsipkan, bukan dihapus.
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
    const { count, error: eErr } = await db
      .from("evaluations")
      .select("id", { count: "exact", head: true })
      .in("formula_version_id", versionIds);
    if (eErr) return fail(describeDbError(eErr));
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
        ? "Formula ini dipakai sebagai komponen di formula lain, jadi tidak bisa dihapus. Lepas dulu pemakaiannya, atau arsipkan saja."
        : describeDbError(dErr),
    );
  }

  revalidatePath("/formulas");
  revalidatePath("/");
  return ok();
}
