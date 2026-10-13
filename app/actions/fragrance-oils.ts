"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { getOwnerId } from "@/lib/owner";
import { getDb } from "@/lib/supabase/db";

/**
 * Perhatikan apa yang TIDAK ada di skema ini: odor_impact dan
 * function_category. FO adalah parfum lengkap berisi puluhan bahan yang
 * komposisinya tidak kita ketahui — memberinya satu nilai kekuatan itu
 * mengarang data, dan itu akan merusak seluruh analisa formula.
 */
const foInput = z.object({
  name: z.string().trim().min(1, "Nama FO wajib diisi"),
  inspired_by: z.string().trim().nullable().optional(),
  supplier: z.string().trim().nullable().optional(),
  // Wajib: dipakai Rule 7 untuk memeriksa jarak antar FO saat ada lebih dari
  // satu FO dalam satu formula.
  family: z.string().trim().min(1, "Family wajib diisi"),
  sub_family: z.string().trim().nullable().optional(),
  note_pyramid: z.string().trim().nullable().optional(),
  price_per_gram: z.number().min(0).nullable().optional(),
  dep_pct: z.number().min(0).max(100).optional(),
  personal_note: z.string().trim().nullable().optional(),
});

const nullable = (v: string | null | undefined) =>
  v && v.trim() ? v.trim() : null;

export async function createFragranceOil(
  input: z.input<typeof foInput>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = foInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path[0] ?? ""));
  }
  const v = parsed.data;

  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("fragrance_oils")
    .insert({
      owner_id: ownerId,
      name: v.name,
      inspired_by: nullable(v.inspired_by),
      supplier: nullable(v.supplier),
      family: v.family,
      sub_family: nullable(v.sub_family),
      note_pyramid: nullable(v.note_pyramid),
      price_per_gram: v.price_per_gram ?? null,
      dep_pct: v.dep_pct ?? 0,
      personal_note: nullable(v.personal_note),
    })
    .select("id")
    .single();

  if (error || !data) {
    return fail(describeDbError(error ?? { message: "Gagal menyimpan FO" }));
  }

  revalidatePath("/fo");
  return ok({ id: data.id });
}

export async function updateFragranceOil(
  id: string,
  input: z.input<typeof foInput>,
): Promise<ActionResult> {
  const parsed = foInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path[0] ?? ""));
  }
  const v = parsed.data;

  const db = getDb();
  const ownerId = await getOwnerId();

  const { error } = await db
    .from("fragrance_oils")
    .update({
      name: v.name,
      inspired_by: nullable(v.inspired_by),
      supplier: nullable(v.supplier),
      family: v.family,
      sub_family: nullable(v.sub_family),
      note_pyramid: nullable(v.note_pyramid),
      price_per_gram: v.price_per_gram ?? null,
      ...(v.dep_pct !== undefined ? { dep_pct: v.dep_pct } : {}),
      personal_note: nullable(v.personal_note),
    })
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) return fail(describeDbError(error));

  revalidatePath("/fo");
  revalidatePath(`/fo/${id}`);
  return ok();
}

export async function setFragranceOilActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const db = getDb();
  const ownerId = await getOwnerId();
  const { error } = await db
    .from("fragrance_oils")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) return fail(describeDbError(error));
  revalidatePath("/fo");
  return ok();
}

export async function deleteFragranceOil(id: string): Promise<ActionResult> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { error } = await db
    .from("fragrance_oils")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);

  if (error) {
    return fail(
      error.code === "23503"
        ? "FO ini dipakai di formula, jadi tidak bisa dihapus. Nonaktifkan saja supaya tidak muncul lagi di picker."
        : describeDbError(error),
    );
  }

  revalidatePath("/fo");
  return ok();
}
