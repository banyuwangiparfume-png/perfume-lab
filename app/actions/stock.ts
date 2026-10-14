"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { mergeByMaterial } from "@/lib/calc/expand";
import { analyze } from "@/lib/calc/analyze";
import { loadFormulaContext } from "@/lib/data/loadFormulaContext";
import { getOwnerId } from "@/lib/owner";
import { getDb } from "@/lib/supabase/db";
import { stockOnHand } from "@/lib/data/stock";

const target = z.object({
  id: z.string().uuid(),
  kind: z.enum(["rm", "fo"]),
});

const entryInput = z.object({
  target,
  qtyG: z.number().finite().refine((v) => v !== 0, "Jumlahnya tidak boleh nol."),
  unitPriceIdr: z.number().min(0).nullable().optional(),
  note: z.string().trim().nullable().optional(),
});

const columnFor = (kind: "rm" | "fo") =>
  kind === "fo" ? "fragrance_oil_id" : "raw_material_id";

function revalidateStock() {
  revalidatePath("/stock");
  revalidatePath("/materials");
  revalidatePath("/");
}

/**
 * Pembelian: stok bertambah.
 *
 * Harga satuan yang dicatat adalah yang BENAR-BENAR dibayar, bukan harga
 * pricelist. Keduanya sering berbeda — diskon, ongkir, kurs — dan selisihnya
 * baru bisa dilihat kalau yang dibayar ikut tersimpan.
 */
export async function recordPurchase(
  input: z.input<typeof entryInput>,
): Promise<ActionResult> {
  const parsed = entryInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path.at(-1) ?? ""));
  }
  const v = parsed.data;
  if (v.qtyG < 0) return fail("Pembelian menambah stok, jadi jumlahnya positif.", "qtyG");

  return insertMovement({
    kind: "pembelian",
    targetKind: v.target.kind,
    targetId: v.target.id,
    qtyG: v.qtyG,
    unitPriceIdr: v.unitPriceIdr ?? null,
    note: v.note ?? null,
  });
}

/**
 * Penyesuaian: hasil menghitung ulang isi rak.
 *
 * Boleh ke dua arah. Tumpah, menguap, dan salah timbang semuanya nyata — dan
 * memaksa semuanya masuk sebagai "pembelian negatif" akan membuat riwayatnya
 * berbohong.
 */
export async function recordAdjustment(
  input: z.input<typeof entryInput>,
): Promise<ActionResult> {
  const parsed = entryInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path.at(-1) ?? ""));
  }
  const v = parsed.data;

  return insertMovement({
    kind: "penyesuaian",
    targetKind: v.target.kind,
    targetId: v.target.id,
    qtyG: v.qtyG,
    unitPriceIdr: null,
    note: v.note ?? null,
  });
}

/**
 * Produksi: meracik satu versi, stok berkurang sesuai komposisi NYATA.
 *
 * Yang dikurangi adalah komposisi setelah dibentangkan — bukan baris seperti
 * yang tertulis. Baris "Ambroxan 3% @10% in BB" tidak menghabiskan 3 g
 * Ambroxan; dia menghabiskan 0,3 g Ambroxan dan 2,7 g Benzyl Benzoate dari rak.
 * Accord juga dibentangkan, karena accord itu dibuat sendiri dari bahan yang
 * sama.
 */
export async function recordProduction(input: {
  versionId: string;
  batchG: number;
  note?: string | null;
}): Promise<ActionResult<{ consumed: number; outputFoId: string }>> {
  if (!Number.isFinite(input.batchG) || input.batchG <= 0) {
    return fail("Ukuran batch harus lebih dari nol.", "batchG");
  }

  const plan = await productionPlan(input.versionId, input.batchG);
  if (!plan.ok) return fail(plan.error);
  if (!plan.data.rows.length) return fail("Versi ini belum ada bahannya.");

  const outputFoId = await ensureOutputFo(plan.data.label, plan.data.family);
  if (!outputFoId) return fail("Gagal menyiapkan FO hasil produksi.");

  const movements: MovementRow[] = plan.data.rows.map((r) => ({
    kind: "produksi" as const,
    targetKind: r.kind,
    targetId: r.id,
    qtyG: -r.needG,
    unitPriceIdr: null,
    note: input.note ?? null,
    formulaVersionId: input.versionId,
  }));

  // Hasilnya masuk kembali sebagai stok: yang keluar dari rak jadi botol juice
  // yang sekarang dimiliki. Tanpa baris ini, produksi cuma terlihat seperti
  // bahan yang hilang.
  movements.push({
    kind: "produksi",
    targetKind: "fo",
    targetId: outputFoId,
    qtyG: input.batchG,
    unitPriceIdr: null,
    note: input.note ?? null,
    formulaVersionId: input.versionId,
  });

  const result = await insertMovements(movements);
  if (!result.ok) return result;

  return ok({ consumed: plan.data.rows.length, outputFoId });
}

/**
 * FO penampung hasil produksi sebuah versi.
 *
 * Satu FO per versi, dipakai ulang tiap kali versi itu diracik lagi — supaya
 * sepuluh kali produksi menambah isi botol yang sama, bukan membuat sepuluh
 * entri yang namanya mirip.
 */
async function ensureOutputFo(
  label: string,
  family: string | null,
): Promise<string | null> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data: existing } = await db
    .from("fragrance_oils")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("name", label)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await db
    .from("fragrance_oils")
    .insert({
      owner_id: ownerId,
      name: label,
      family: family ?? "Hasil produksi",
      supplier: "Produksi sendiri",
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

type MovementRow = {
  kind: "pembelian" | "produksi" | "penyesuaian";
  targetKind: "rm" | "fo";
  targetId: string;
  qtyG: number;
  unitPriceIdr: number | null;
  note: string | null;
  formulaVersionId?: string;
};

async function insertMovement(row: MovementRow): Promise<ActionResult> {
  return insertMovements([row]);
}

async function insertMovements(rows: MovementRow[]): Promise<ActionResult> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const payload = rows.map((r) => ({
    owner_id: ownerId,
    [columnFor(r.targetKind)]: r.targetId,
    kind: r.kind,
    qty_g: Number(r.qtyG.toFixed(3)),
    unit_price_idr: r.unitPriceIdr,
    note: r.note,
    formula_version_id: r.formulaVersionId ?? null,
  }));

  const { error } = await db
    .from("stock_movements")
    .insert(payload as never);

  if (error) return fail(describeDbError(error));

  revalidateStock();
  return ok();
}

export type PlanRow = {
  id: string;
  kind: "rm" | "fo";
  name: string;
  /** gram yang dibutuhkan untuk batch ini */
  needG: number;
  /** sisa di rak; null = belum pernah dicatat sama sekali */
  onHandG: number | null;
  /** kekurangan, 0 kalau cukup */
  shortG: number;
};

export type Plan = {
  label: string;
  family: string | null;
  batchG: number;
  rows: PlanRow[];
};

/**
 * Rincian kebutuhan satu produksi, lengkap dengan sisa rak dan kekurangannya.
 *
 * Dihitung dari komposisi NYATA — setelah dilusi dipecah dan accord
 * dibentangkan — karena itulah yang benar-benar diambil dari botol. Baris
 * "Ambroxan 3% @10% in BB" mengambil 0,3 g Ambroxan dan 2,7 g Benzyl Benzoate,
 * bukan 3 g Ambroxan.
 *
 * Bahan yang belum pernah dicatat dibedakan dari yang pernah ada lalu habis:
 * yang pertama berarti catatannya belum dibuat, yang kedua berarti memang perlu
 * dibeli lagi.
 */
export async function productionPlan(
  versionId: string,
  batchG: number,
): Promise<ActionResult<Plan>> {
  const ctx = await loadFormulaContext(versionId);
  if (!ctx) return fail("Versi formula tidak ditemukan.");

  const analysis = analyze(ctx, { skipBridges: true });
  if (analysis.error) return fail(analysis.error);

  const onHand = await stockOnHand();
  const merged = mergeByMaterial(analysis.items);
  const rows: PlanRow[] = [];

  for (const [refId, item] of merged) {
    const needG = (item.productPct / 100) * batchG;
    if (needG <= 0) continue;

    const kind: "rm" | "fo" = item.kind === "fo" ? "fo" : "rm";
    const stock =
      kind === "fo" ? onHand.fos.get(refId) : onHand.materials.get(refId);

    rows.push({
      id: refId,
      kind,
      name:
        ctx.materials.get(refId)?.name ??
        ctx.fos.get(refId)?.name ??
        "(tidak ditemukan)",
      needG,
      onHandG: stock ?? null,
      shortG: Math.max(0, needG - (stock ?? 0)),
    });
  }

  rows.sort((a, b) => b.needG - a.needG);

  return ok({
    label: ctx.version.name ?? "Formula",
    family: null,
    batchG,
    rows,
  });
}
