"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { getOwnerId } from "@/lib/owner";
import { macerationDays } from "@/lib/lab";
import { getDb } from "@/lib/supabase/db";

const pointInput = z.object({
  minutes_elapsed: z.number().int().min(0),
  dominant_note: z.string().trim().nullable().optional(),
  descriptors: z.array(z.string().trim().min(1)).default([]),
  intensity: z.number().int().min(1).max(10).nullable().optional(),
  note: z.string().trim().nullable().optional(),
});

export type PointInput = z.input<typeof pointInput>;

const evaluationInput = z.object({
  formula_version_id: z.string().uuid(),
  evaluator_name: z.string().trim().min(1, "Nama penilai wajib diisi"),
  purpose: z.enum(["screening", "final"]).default("screening"),
  medium: z.enum(["blotter", "skin", "fabric"]).default("blotter"),
  diluted_in: z.string().trim().nullable().optional(),
  maceration_days: z.number().int().min(0).nullable().optional(),
  blind_code: z.string().trim().nullable().optional(),
  evaluated_at: z.string().optional(),
  overall_note: z.string().trim().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  transition_verdict: z.enum(["smooth", "broken", "muddy"]).nullable().optional(),
  points: z.array(pointInput).default([]),
});

/** Titik waktu yang semua isinya kosong tidak disimpan — itu belum dinilai. */
function isBlank(p: z.output<typeof pointInput>): boolean {
  return (
    !p.dominant_note?.trim() &&
    !p.note?.trim() &&
    p.intensity == null &&
    (p.descriptors ?? []).length === 0
  );
}

const nullable = (v: string | null | undefined) =>
  v && v.trim() ? v.trim() : null;

/**
 * Menyimpan evaluasi beserta titik waktu yang sudah terisi.
 *
 * SIMPAN PARSIAL harus bisa: pengisian menit 5 sampai menit 360 memang
 * terpisah berjam-jam, jadi tombol simpan tidak pernah menunggu semua titik
 * terisi. Titik yang masih kosong dilewati, dan bisa ditambahkan nanti lewat
 * upsertPoint tanpa menghapus yang sudah ada.
 */
export async function createEvaluation(
  input: z.input<typeof evaluationInput>,
): Promise<ActionResult<{ evaluationId: string }>> {
  const parsed = evaluationInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path[0] ?? ""));
  }
  const v = parsed.data;

  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: version, error: vErr } = await db
    .from("formula_versions")
    .select("id, diluted_at, formula:formulas!inner(id, owner_id)")
    .eq("id", v.formula_version_id)
    .maybeSingle();

  if (vErr) return fail(describeDbError(vErr));
  const versionRow = version as unknown as
    | {
        id: string;
        diluted_at: string | null;
        formula: { id: string; owner_id: string };
      }
    | null;
  if (!versionRow || versionRow.formula.owner_id !== ownerId) {
    return fail("Versi yang mau dinilai tidak ditemukan.");
  }

  const { data: evaluation, error } = await db
    .from("evaluations")
    .insert({
      formula_version_id: v.formula_version_id,
      owner_id: ownerId,
      evaluator_name: v.evaluator_name,
      purpose: v.purpose,
      medium: v.medium,
      diluted_in: nullable(v.diluted_in),
      // Umur maserasi SELALU dari diluted_at, tidak pernah dari mixed_at.
      // Angka dari form dipakai kalau user menimpanya secara sadar.
      maceration_days:
        v.maceration_days ?? macerationDays(versionRow.diluted_at),
      blind_code: nullable(v.blind_code),
      evaluated_at: v.evaluated_at ?? new Date().toISOString(),
      overall_note: nullable(v.overall_note),
      rating: v.rating ?? null,
      transition_verdict: v.transition_verdict ?? null,
    })
    .select("id")
    .single();

  if (error || !evaluation) {
    return fail(describeDbError(error ?? { message: "Gagal menyimpan evaluasi" }));
  }

  const filled = v.points.filter((p) => !isBlank(p));
  if (filled.length) {
    const { error: pErr } = await db.from("evaluation_points").insert(
      filled.map((p) => ({
        evaluation_id: evaluation.id,
        minutes_elapsed: p.minutes_elapsed,
        dominant_note: nullable(p.dominant_note),
        descriptors: p.descriptors ?? [],
        intensity: p.intensity ?? null,
        note: nullable(p.note),
      })),
    );
    if (pErr) return fail(describeDbError(pErr));
  }

  // Status versi naik ke `evaluated`: barisnya tidak boleh diubah lagi, supaya
  // catatan penciuman ini tidak menggantung ke formula yang sudah berbeda.
  const { error: sErr } = await db
    .from("formula_versions")
    .update({ status: "evaluated" })
    .eq("id", v.formula_version_id)
    .in("status", ["draft", "mixed"]);
  if (sErr) return fail(describeDbError(sErr));

  revalidatePath(`/formulas/${versionRow.formula.id}`);
  revalidatePath("/");
  return ok({ evaluationId: evaluation.id });
}

/**
 * Menambah atau mengubah SATU titik waktu. Dipakai saat user kembali lagi
 * berjam-jam kemudian — titik yang sudah ada tidak boleh ikut terhapus.
 */
export async function upsertPoint(
  evaluationId: string,
  point: PointInput,
): Promise<ActionResult> {
  const parsed = pointInput.safeParse(point);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const p = parsed.data;

  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: evaluation, error: eErr } = await db
    .from("evaluations")
    .select("id, formula_version_id, formula_version:formula_versions!inner(formula_id)")
    .eq("id", evaluationId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (eErr) return fail(describeDbError(eErr));
  if (!evaluation) return fail("Evaluasi tidak ditemukan.");

  // Mengosongkan semua isi sebuah titik berarti menghapus penilaian titik itu.
  if (isBlank(p)) {
    const { error } = await db
      .from("evaluation_points")
      .delete()
      .eq("evaluation_id", evaluationId)
      .eq("minutes_elapsed", p.minutes_elapsed);
    if (error) return fail(describeDbError(error));
  } else {
    const { error } = await db.from("evaluation_points").upsert(
      {
        evaluation_id: evaluationId,
        minutes_elapsed: p.minutes_elapsed,
        dominant_note: nullable(p.dominant_note),
        descriptors: p.descriptors ?? [],
        intensity: p.intensity ?? null,
        note: nullable(p.note),
      },
      { onConflict: "evaluation_id,minutes_elapsed" },
    );
    if (error) return fail(describeDbError(error));
  }

  const formulaId = (
    evaluation as unknown as { formula_version: { formula_id: string } }
  ).formula_version.formula_id;

  revalidatePath(`/formulas/${formulaId}`);
  revalidatePath(`/evaluations/${evaluationId}`);
  return ok();
}

export async function updateEvaluation(
  evaluationId: string,
  input: {
    evaluator_name?: string;
    purpose?: "screening" | "final";
    medium?: "blotter" | "skin" | "fabric";
    diluted_in?: string | null;
    maceration_days?: number | null;
    overall_note?: string | null;
    rating?: number | null;
    transition_verdict?: "smooth" | "broken" | "muddy" | null;
  },
): Promise<ActionResult> {
  const db = getDb();
  const ownerId = await getOwnerId();

  if (input.evaluator_name !== undefined && !input.evaluator_name.trim()) {
    return fail("Nama penilai wajib diisi.", "evaluator_name");
  }

  const { error } = await db
    .from("evaluations")
    .update({
      ...(input.evaluator_name !== undefined
        ? { evaluator_name: input.evaluator_name.trim() }
        : {}),
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
      ...(input.medium !== undefined ? { medium: input.medium } : {}),
      ...(input.diluted_in !== undefined
        ? { diluted_in: nullable(input.diluted_in) }
        : {}),
      ...(input.maceration_days !== undefined
        ? { maceration_days: input.maceration_days }
        : {}),
      ...(input.overall_note !== undefined
        ? { overall_note: nullable(input.overall_note) }
        : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.transition_verdict !== undefined
        ? { transition_verdict: input.transition_verdict }
        : {}),
    })
    .eq("id", evaluationId)
    .eq("owner_id", ownerId);

  if (error) return fail(describeDbError(error));
  revalidatePath(`/evaluations/${evaluationId}`);
  return ok();
}

export async function deleteEvaluation(
  evaluationId: string,
): Promise<ActionResult> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: evaluation, error: eErr } = await db
    .from("evaluations")
    .select("formula_version_id, formula_version:formula_versions!inner(formula_id)")
    .eq("id", evaluationId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (eErr) return fail(describeDbError(eErr));
  if (!evaluation) return fail("Evaluasi tidak ditemukan.");

  const { error } = await db
    .from("evaluations")
    .delete()
    .eq("id", evaluationId)
    .eq("owner_id", ownerId);
  if (error) return fail(describeDbError(error));

  const row = evaluation as unknown as {
    formula_version_id: string;
    formula_version: { formula_id: string };
  };

  // Kalau tidak ada evaluasi lain, versinya kembali ke "sudah dicampur" supaya
  // muncul lagi di antrean dashboard dan barisnya bisa diperbaiki.
  const { count } = await db
    .from("evaluations")
    .select("id", { count: "exact", head: true })
    .eq("formula_version_id", row.formula_version_id);

  if ((count ?? 0) === 0) {
    await db
      .from("formula_versions")
      .update({ status: "mixed" })
      .eq("id", row.formula_version_id)
      .eq("status", "evaluated");
  }

  revalidatePath(`/formulas/${row.formula_version.formula_id}`);
  revalidatePath("/");
  return ok();
}
