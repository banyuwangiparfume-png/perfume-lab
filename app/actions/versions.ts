"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sameContent, type VersionContent } from "@/lib/versionDiff";
import {
  describeDbError,
  fail,
  ok,
  type ActionResult,
} from "@/lib/action-result";
import { getOwnerId } from "@/lib/owner";
import { getDb } from "@/lib/supabase/db";
import type { FormulaVersionRow } from "@/lib/supabase/database.types";

const lineInput = z
  .object({
    tier: z.enum(["top", "mid", "base", "all"]),
    line_type: z.enum(["raw_material", "accord", "fo"]),
    raw_material_id: z.string().uuid().nullable().optional(),
    accord_version_id: z.string().uuid().nullable().optional(),
    fo_id: z.string().uuid().nullable().optional(),
    pct: z.number().min(0, "Persen tidak boleh negatif"),
    is_locked: z.boolean().default(false),
    user_dilution_pct: z
      .number()
      .gt(0, "Dilusi harus di atas 0%")
      .max(100, "Dilusi maksimal 100%")
      .default(100),
    user_solvent_id: z.string().uuid().nullable().optional(),
    note: z.string().trim().nullable().optional(),
  })
  .superRefine((line, ctx) => {
    const refs = {
      raw_material: line.raw_material_id,
      accord: line.accord_version_id,
      fo: line.fo_id,
    };
    if (!refs[line.line_type]) {
      ctx.addIssue({
        code: "custom",
        message: "Ada baris yang belum dipilih bahannya.",
      });
    }
    if (Object.values(refs).filter(Boolean).length > 1) {
      ctx.addIssue({
        code: "custom",
        message:
          "Ada baris yang merujuk ke lebih dari satu komponen. Ganti jenis barisnya, lalu pilih ulang.",
      });
    }
    // Pelarut wajib kalau diencerkan — tanpa itu formulanya tidak bisa
    // direproduksi, dan pelarutnya tidak bisa ikut dijumlahkan di panel.
    if (line.user_dilution_pct < 100 && !line.user_solvent_id) {
      ctx.addIssue({
        code: "custom",
        message:
          "Baris yang diencerkan harus dipilih pelarutnya. Tanpa itu formulanya tidak bisa dibuat ulang persis.",
      });
    }
  });

export type LineInput = z.input<typeof lineInput>;

const draftPatch = z.object({
  batch_g: z.number().positive().optional(),
  top_pct: z.number().min(0).max(100).nullable().optional(),
  mid_pct: z.number().min(0).max(100).nullable().optional(),
  base_pct: z.number().min(0).max(100).nullable().optional(),
  price_tier_override: z.number().positive().nullable().optional(),
  lines: z.array(lineInput).optional(),
});

async function loadOwnedVersion(
  versionId: string,
): Promise<
  { version: FormulaVersionRow; formulaId: string } | { error: string }
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
 * Autosave draf kerja.
 *
 * Draf boleh berada dalam keadaan yang belum sah — piramida 105%, tier yang
 * belum penuh — karena user memang sedang menggeser angka. Yang menolak
 * keadaan tidak sah adalah saveVersion(), bukan ini. Memblokir di sini akan
 * membuat autosave gagal diam-diam di tengah pengetikan dan pekerjaan user
 * hilang tanpa dia sadari.
 */
export async function saveDraft(
  versionId: string,
  patch: z.input<typeof draftPatch>,
): Promise<ActionResult<{ savedLines: number }>> {
  const parsed = draftPatch.safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;

  const owned = await loadOwnedVersion(versionId);
  if ("error" in owned) return fail(owned.error);
  if (owned.version.version_no !== 0) {
    return fail(
      "Versi tersimpan tidak bisa diubah. Buka drafnya, atau simpan sebagai versi baru.",
    );
  }

  const db = getDb();

  const meta = {
    ...(v.batch_g !== undefined ? { batch_g: v.batch_g } : {}),
    ...(v.top_pct !== undefined ? { top_pct: v.top_pct } : {}),
    ...(v.mid_pct !== undefined ? { mid_pct: v.mid_pct } : {}),
    ...(v.base_pct !== undefined ? { base_pct: v.base_pct } : {}),
    ...(v.price_tier_override !== undefined
      ? { price_tier_override: v.price_tier_override }
      : {}),
  };

  if (Object.keys(meta).length) {
    const { error } = await db
      .from("formula_versions")
      .update(meta)
      .eq("id", versionId);
    if (error) return fail(describeDbError(error));
  }

  let savedLines = 0;
  if (v.lines) {
    // Accord tidak boleh menunjuk ke versi yang sedang diedit. Siklus yang
    // lebih dalam ditangkap expand() dan dilaporkan sebagai R12, yang
    // memblokir "Simpan versi".
    if (v.lines.some((l) => l.accord_version_id === versionId)) {
      return fail("Formula tidak bisa memakai dirinya sendiri sebagai accord.");
    }

    const { data, error } = await db.rpc("save_draft_lines", {
      p_version_id: versionId,
      p_lines: v.lines.map((l) => ({
        tier: l.tier,
        line_type: l.line_type,
        raw_material_id: l.raw_material_id ?? null,
        accord_version_id: l.accord_version_id ?? null,
        fo_id: l.fo_id ?? null,
        pct: l.pct,
        is_locked: l.is_locked ?? false,
        user_dilution_pct: l.user_dilution_pct ?? 100,
        user_solvent_id: l.user_solvent_id ?? null,
        note: l.note ?? null,
      })),
    });
    if (error) return fail(describeDbError(error));
    savedLines = Number(data ?? 0);
  }

  revalidatePath(`/formulas/${owned.formulaId}`);
  return ok({ savedLines });
}

/**
 * Membekukan draf jadi versi bernomor.
 *
 * Versi tersimpan adalah yang nanti dirujuk catatan penciuman, lembar timbang,
 * dan formula lain yang memakainya sebagai accord — jadi dia tidak boleh
 * berisi angka yang belum selesai.
 */
export async function saveVersion(
  formulaId: string,
  changeNote?: string | null,
  label?: string | null,
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

  const { count } = await db
    .from("formula_versions")
    .select("id", { count: "exact", head: true })
    .eq("formula_id", formulaId)
    .gt("version_no", 0);

  // Versi ke-2 ke atas wajib punya catatan perubahan — di situ letak
  // pelajarannya, bukan di angkanya.
  if ((count ?? 0) >= 1 && !changeNote?.trim()) {
    return fail(
      "Tulis dulu apa yang berubah dari versi sebelumnya. Singkat saja — catatan ini yang bikin kamu belajar.",
      "change_note",
    );
  }

  // Versi baru hanya kalau isinya memang berubah dari versi terakhir —
  // versi identik membuat riwayat dan halaman banding menyesatkan.
  if ((count ?? 0) >= 1) {
    const same = await draftMatchesLatest(formulaId);
    if (same) {
      return fail(
        `Isi draf masih sama persis dengan v${same.versionNo} — belum ada yang perlu disimpan sebagai versi baru. Ubah persen, bahan, dilusi, atau target piramida dulu.`,
      );
    }
  }

  const { data, error } = await db.rpc("save_formula_version", {
    p_formula_id: formulaId,
    p_change_note: changeNote?.trim() || undefined,
    p_label: label?.trim() || undefined,
  });

  if (error || !data) {
    return fail(describeDbError(error ?? { message: "Gagal menyimpan versi" }));
  }

  const row = data as unknown as FormulaVersionRow;
  revalidatePath(`/formulas/${formulaId}`);
  revalidatePath("/formulas");
  return ok({ versionId: row.id, versionNo: row.version_no });
}

const CONTENT_SELECT =
  "version_no, top_pct, mid_pct, base_pct, lines:formula_lines!formula_lines_formula_version_id_fkey(tier, line_type, raw_material_id, accord_version_id, fo_id, pct, user_dilution_pct, user_solvent_id)";

/** Versi tersimpan terakhir kalau isinya sama dengan draf; null kalau beda. */
async function draftMatchesLatest(
  formulaId: string,
): Promise<{ versionNo: number } | null> {
  const db = getDb();
  const [draft, latest] = await Promise.all([
    db
      .from("formula_versions")
      .select(CONTENT_SELECT)
      .eq("formula_id", formulaId)
      .eq("version_no", 0)
      .maybeSingle(),
    db
      .from("formula_versions")
      .select(CONTENT_SELECT)
      .eq("formula_id", formulaId)
      .gt("version_no", 0)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  // Kalau gagal dibaca, jangan menghalangi penyimpanan — lebih baik satu
  // versi kembar daripada tidak bisa menyimpan sama sekali.
  if (draft.error || latest.error || !draft.data || !latest.data) return null;
  const d = draft.data as unknown as VersionContent & { version_no: number };
  const l = latest.data as unknown as VersionContent & { version_no: number };
  return sameContent(d, l) ? { versionNo: l.version_no } : null;
}

// --------------------------------------------------------------------------
// Protokol lab — modul evaluasi v1 yang tetap berlaku di v2.
// --------------------------------------------------------------------------

const versionMeta = z.object({
  label: z.string().trim().nullable().optional(),
  change_note: z.string().trim().nullable().optional(),
  status: z.enum(["draft", "saved", "mixed", "evaluated", "locked"]).optional(),
  mixed_at: z.string().nullable().optional(),
  diluted_at: z.string().nullable().optional(),
});

export async function updateVersionMeta(
  versionId: string,
  input: z.input<typeof versionMeta>,
): Promise<ActionResult> {
  const parsed = versionMeta.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;

  const owned = await loadOwnedVersion(versionId);
  if ("error" in owned) return fail(owned.error);

  const db = getDb();
  const { error } = await db
    .from("formula_versions")
    .update({
      ...(v.label !== undefined ? { label: v.label?.trim() || null } : {}),
      ...(v.change_note !== undefined
        ? { change_note: v.change_note?.trim() || null }
        : {}),
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
 * Fase minyak dicampur. Dari sini oil rest 24–48 jam mulai berjalan.
 *
 * Dipanggil lagi untuk mengoreksi tanggal, jadi statusnya hanya dinaikkan ke
 * "mixed" dari draft/saved — versi yang sudah dinilai tidak boleh turun status
 * hanya karena tanggal campurnya dibetulkan.
 */
export async function markMixed(
  versionId: string,
  mixedAt?: string,
): Promise<ActionResult> {
  const owned = await loadOwnedVersion(versionId);
  if ("error" in owned) return fail(owned.error);

  // Draf terus berubah; racikan harus menunjuk ke isi yang dibekukan, kalau
  // tidak catatan penciumannya nanti merujuk ke formula yang sudah lain.
  if (owned.version.version_no === 0) {
    return fail(
      "Simpan dulu drafnya sebagai versi. Yang diracik harus versi yang dibekukan, supaya catatan penciumannya nanti merujuk ke isi yang pasti.",
    );
  }

  const when = mixedAt ?? new Date().toISOString();
  if (new Date(when).getTime() > Date.now() + 60 * 60 * 1000) {
    return fail("Tanggal pencampuran tidak bisa di masa depan.", "mixed_at");
  }
  if (
    owned.version.diluted_at &&
    new Date(when) > new Date(owned.version.diluted_at)
  ) {
    return fail(
      "Tanggal pencampuran jatuh setelah tanggal pengenceran. Fase minyak dicampur DULU, baru ketemu ethanol.",
      "mixed_at",
    );
  }

  const raise =
    owned.version.status === "draft" || owned.version.status === "saved";
  return updateVersionMeta(versionId, {
    ...(raise ? { status: "mixed" as const } : {}),
    mixed_at: when,
  });
}

/**
 * Ethanol ditambahkan. Dari tanggal INI umur maserasi dihitung — bukan dari
 * tanggal pencampuran fase minyak.
 */
export async function markDiluted(
  versionId: string,
  dilutedAt?: string,
): Promise<ActionResult> {
  const owned = await loadOwnedVersion(versionId);
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

  return updateVersionMeta(versionId, { diluted_at: when });
}

export async function deleteVersion(versionId: string): Promise<ActionResult> {
  const owned = await loadOwnedVersion(versionId);
  if ("error" in owned) return fail(owned.error);

  if (owned.version.version_no === 0) {
    return fail("Draf kerja tidak bisa dihapus — dia yang kamu edit.");
  }

  const db = getDb();
  const { count } = await db
    .from("evaluations")
    .select("id", { count: "exact", head: true })
    .eq("formula_version_id", versionId);
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
        ? "Versi ini dipakai sebagai accord di formula lain, jadi tidak bisa dihapus."
        : describeDbError(error),
    );
  }

  revalidatePath(`/formulas/${owned.formulaId}`);
  return ok();
}

/**
 * Tandai bahan atau FO ada di stok sendiri.
 *
 * Dipakai tanda bintang di picker dan filter "hanya stok saya" saat mencari
 * bridger. Keduanya menjawab pertanyaan yang sama — apakah botolnya ada di rak
 * — jadi FO tidak boleh diperlakukan berbeda.
 */
export async function toggleStock(
  id: string,
  inStock: boolean,
  kind: "rm" | "fo" = "rm",
): Promise<ActionResult> {
  const db = getDb();
  const ownerId = await getOwnerId();
  // Dua cabang ditulis terpisah, bukan satu objek berkunci dinamis: tipe
  // tabelnya menolak kunci yang baru diketahui saat runtime.
  const error = inStock
    ? kind === "fo"
      ? (
          await db
            .from("user_stock")
            .upsert(
              { owner_id: ownerId, fragrance_oil_id: id },
              { onConflict: "owner_id,fragrance_oil_id" },
            )
        ).error
      : (
          await db
            .from("user_stock")
            .upsert(
              { owner_id: ownerId, raw_material_id: id },
              { onConflict: "owner_id,raw_material_id" },
            )
        ).error
    : (
        await db
          .from("user_stock")
          .delete()
          .eq("owner_id", ownerId)
          .eq(kind === "fo" ? "fragrance_oil_id" : "raw_material_id", id)
      ).error;

  if (error) return fail(describeDbError(error));
  revalidatePath("/materials");
  revalidatePath("/stock");
  return ok();
}
