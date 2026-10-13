"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { assertNoCycle, SubFormulaError } from "@/lib/legacy/calc/cycle";
import { loadSubFormulaGraph } from "@/lib/data/versions";
import { getOwnerId } from "@/lib/owner";
import { getDb } from "@/lib/supabase/db";
import type { FormulaVersionRow } from "@/lib/supabase/database.types";

const lineInput = z
  .object({
    line_type: z.enum(["raw_material", "fo", "sub_formula"]),
    raw_material_id: z.string().uuid().nullable().optional(),
    fo_id: z.string().uuid().nullable().optional(),
    sub_formula_version_id: z.string().uuid().nullable().optional(),
    weight_g: z.number().positive("Berat harus di atas 0"),
    dilution_pct: z
      .number()
      .gt(0, "Dilusi harus di atas 0%")
      .max(100, "Dilusi maksimal 100%"),
    solvent: z.string().trim().nullable().optional(),
    note: z.string().trim().nullable().optional(),
    sort_order: z.number().int().min(0),
  })
  .superRefine((line, ctx) => {
    const refs = {
      raw_material: line.raw_material_id,
      fo: line.fo_id,
      sub_formula: line.sub_formula_version_id,
    };
    if (!refs[line.line_type]) {
      ctx.addIssue({
        code: "custom",
        message:
          line.line_type === "raw_material"
            ? "Ada baris yang belum dipilih bahannya."
            : line.line_type === "fo"
              ? "Ada baris yang belum dipilih FO-nya."
              : "Ada baris yang belum dipilih formulanya.",
      });
    }
    const filled = Object.values(refs).filter(Boolean).length;
    if (filled > 1) {
      ctx.addIssue({
        code: "custom",
        message:
          "Ada baris yang merujuk ke lebih dari satu komponen. Ganti jenis barisnya, lalu pilih ulang.",
      });
    }
  });

export type LineInput = z.input<typeof lineInput>;

const versionMeta = z.object({
  label: z.string().trim().nullable().optional(),
  change_note: z.string().trim().nullable().optional(),
  batch_size_g: z.number().positive().optional(),
  status: z.enum(["draft", "mixed", "evaluated", "locked"]).optional(),
  mixed_at: z.string().nullable().optional(),
  diluted_at: z.string().nullable().optional(),
});

async function loadVersionOwned(
  versionId: string,
): Promise<
  | { version: FormulaVersionRow; formulaId: string }
  | { error: string }
> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("formula_versions")
    .select("*, formula:formulas!inner(id, owner_id)")
    .eq("id", versionId)
    .maybeSingle();

  if (error) return { error: describeDbError(error) };
  if (!data) return { error: "Versi tidak ditemukan." };

  const row = data as unknown as FormulaVersionRow & {
    formula: { id: string; owner_id: string };
  };
  if (row.formula.owner_id !== ownerId) {
    return { error: "Versi tidak ditemukan." };
  }
  const { formula, ...version } = row;
  return { version, formulaId: formula.id };
}

/**
 * Menyimpan SELURUH baris sebuah versi dalam satu transaksi (lewat RPC
 * save_formula_lines), supaya tidak pernah ada versi yang separuh tersimpan.
 *
 * Siklus sub-formula diperiksa DI SINI lebih dulu, bukan dibiarkan jatuh ke
 * jaring pengaman database — karena di sini kita masih punya nama formulanya,
 * dan pesan error yang menyebut UUID tidak berguna buat siapa pun.
 */
export async function saveLines(
  versionId: string,
  lines: LineInput[],
): Promise<ActionResult<{ saved: number }>> {
  const owned = await loadVersionOwned(versionId);
  if ("error" in owned) return fail(owned.error);

  if (owned.version.status === "evaluated" || owned.version.status === "locked") {
    return fail(
      "Versi ini sudah dinilai, jadi barisnya tidak bisa diubah lagi. Duplikat jadi versi baru supaya catatan penciuman yang lama tetap nyambung ke formula yang benar.",
    );
  }

  const parsed = z.array(lineInput).safeParse(lines);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const subIds = parsed.data
    .map((l) => l.sub_formula_version_id)
    .filter((x): x is string => !!x);

  if (subIds.length) {
    try {
      assertNoCycle(await loadSubFormulaGraph(), versionId, subIds);
    } catch (e) {
      if (e instanceof SubFormulaError) return fail(e.message);
      throw e;
    }
  }

  const db = getDb();
  const { data, error } = await db.rpc("save_formula_lines", {
    p_version_id: versionId,
    p_lines: parsed.data.map((l, i) => ({
      line_type: l.line_type,
      raw_material_id: l.raw_material_id ?? null,
      fo_id: l.fo_id ?? null,
      sub_formula_version_id: l.sub_formula_version_id ?? null,
      weight_g: l.weight_g,
      dilution_pct: l.dilution_pct,
      solvent: l.solvent ?? null,
      note: l.note ?? null,
      sort_order: l.sort_order ?? i,
    })),
  });

  if (error) return fail(describeDbError(error));

  revalidatePath(`/formulas/${owned.formulaId}`);
  revalidatePath("/");
  return ok({ saved: Number(data ?? 0) });
}

/**
 * Versi baru di dalam formula yang sama. Nomor versinya dihitung di dalam
 * transaksi RPC, jadi tidak pernah bentrok walau dua tab menyimpan bersamaan.
 */
export async function createVersion(
  formulaId: string,
  input: {
    label?: string | null;
    change_note?: string | null;
    parent_version_id?: string | null;
    batch_size_g?: number;
  } = {},
): Promise<ActionResult<{ versionId: string; versionNo: number }>> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: formula, error: fErr } = await db
    .from("formulas")
    .select("id")
    .eq("id", formulaId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (fErr) return fail(describeDbError(fErr));
  if (!formula) return fail("Formula tidak ditemukan.");

  const { data, error } = await db
    .rpc("create_formula_version", {
      p_formula_id: formulaId,
      p_label: input.label?.trim() || null,
      p_change_note: input.change_note?.trim() || null,
      p_parent_version_id: input.parent_version_id ?? null,
      p_batch_size_g: input.batch_size_g ?? 10,
    });

  if (error || !data) {
    return fail(describeDbError(error ?? { message: "Gagal membuat versi" }));
  }

  revalidatePath(`/formulas/${formulaId}`);
  return ok({ versionId: data.id, versionNo: data.version_no });
}

/**
 * Duplikat versi beserta SEMUA barisnya, termasuk dilusi dan pelarutnya.
 * Kalau dilusi tidak ikut tersalin, hasil duplikatnya tidak bisa direproduksi.
 *
 * Ini jalur untuk subtraction test: duplikat v3 jadi v4, hapus satu bahan,
 * lalu bandingkan.
 */
export async function duplicateVersion(
  versionId: string,
  changeNote: string,
  label?: string | null,
): Promise<ActionResult<{ versionId: string; versionNo: number }>> {
  if (!changeNote?.trim()) {
    return fail(
      "Tulis dulu apa yang kamu ubah dari versi sebelumnya. Catatan ini yang bikin kamu belajar — singkat saja.",
      "change_note",
    );
  }

  const owned = await loadVersionOwned(versionId);
  if ("error" in owned) return fail(owned.error);

  const db = getDb();
  const { data, error } = await db
    .rpc("duplicate_formula_version", {
      p_version_id: versionId,
      p_change_note: changeNote.trim(),
      p_label: label?.trim() || null,
    });

  if (error || !data) {
    return fail(describeDbError(error ?? { message: "Gagal menduplikat versi" }));
  }

  revalidatePath(`/formulas/${owned.formulaId}`);
  return ok({ versionId: data.id, versionNo: data.version_no });
}

export async function updateVersionMeta(
  versionId: string,
  input: z.input<typeof versionMeta>,
): Promise<ActionResult> {
  const parsed = versionMeta.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const owned = await loadVersionOwned(versionId);
  if ("error" in owned) return fail(owned.error);

  const v = parsed.data;
  if (
    owned.version.version_no > 1 &&
    v.change_note !== undefined &&
    !v.change_note?.trim()
  ) {
    return fail(
      "Versi ke-2 ke atas wajib punya catatan perubahan.",
      "change_note",
    );
  }

  const db = getDb();
  const { error } = await db
    .from("formula_versions")
    .update({
      ...(v.label !== undefined ? { label: v.label?.trim() || null } : {}),
      ...(v.change_note !== undefined
        ? { change_note: v.change_note?.trim() || null }
        : {}),
      ...(v.batch_size_g !== undefined ? { batch_size_g: v.batch_size_g } : {}),
      ...(v.status !== undefined ? { status: v.status } : {}),
      ...(v.mixed_at !== undefined ? { mixed_at: v.mixed_at } : {}),
      ...(v.diluted_at !== undefined ? { diluted_at: v.diluted_at } : {}),
    })
    .eq("id", versionId);

  if (error) return fail(describeDbError(error));

  revalidatePath(`/formulas/${owned.formulaId}`);
  revalidatePath("/");
  return ok();
}

/**
 * Menandai FASE MINYAK sudah dicampur. Dari sini mulai oil phase rest 24-48
 * jam — bahan larut sempurna antar sesamanya sebelum ketemu ethanol.
 */
export async function markMixed(
  versionId: string,
  mixedAt?: string,
): Promise<ActionResult> {
  return updateVersionMeta(versionId, {
    status: "mixed",
    mixed_at: mixedAt ?? new Date().toISOString(),
  });
}

/**
 * Menandai ETHANOL sudah ditambahkan. Dari sini mulai maserasi, dan dari
 * tanggal inilah umur maserasi dihitung — bukan dari mixed_at.
 */
export async function markDiluted(
  versionId: string,
  dilutedAt?: string,
): Promise<ActionResult> {
  const owned = await loadVersionOwned(versionId);
  if ("error" in owned) return fail(owned.error);

  const when = dilutedAt ?? new Date().toISOString();

  if (!owned.version.mixed_at) {
    return fail(
      "Catat dulu kapan fase minyaknya dicampur. Umur oil rest tidak bisa dihitung tanpa tanggal itu.",
    );
  }
  if (new Date(when) < new Date(owned.version.mixed_at)) {
    return fail(
      "Tanggal pengenceran lebih awal dari tanggal pencampuran. Ethanol ditambahkan SETELAH fase minyak istirahat.",
      "diluted_at",
    );
  }

  return updateVersionMeta(versionId, {
    status: owned.version.status === "draft" ? "mixed" : undefined,
    diluted_at: when,
  });
}

export async function deleteVersion(versionId: string): Promise<ActionResult> {
  const owned = await loadVersionOwned(versionId);
  if ("error" in owned) return fail(owned.error);

  const db = getDb();

  const { count, error: cErr } = await db
    .from("evaluations")
    .select("id", { count: "exact", head: true })
    .eq("formula_version_id", versionId);
  if (cErr) return fail(describeDbError(cErr));
  if ((count ?? 0) > 0) {
    return fail(
      "Versi ini sudah punya catatan evaluasi, jadi tidak bisa dihapus. Catatan penciuman tidak bisa dibuat ulang.",
    );
  }

  const { error } = await db
    .from("formula_versions")
    .delete()
    .eq("id", versionId);

  if (error) {
    return fail(
      error.code === "23503"
        ? "Versi ini dipakai sebagai komponen di formula lain, jadi tidak bisa dihapus. Lepas dulu pemakaiannya."
        : describeDbError(error),
    );
  }

  revalidatePath(`/formulas/${owned.formulaId}`);
  return ok();
}
