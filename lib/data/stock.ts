import "server-only";

import { getOwnerId } from "../owner";
import { getDb } from "../supabase/db";
import { fetchAllPages } from "./paginate";

/**
 * Bahan yang benar-benar ada di rak sendiri.
 *
 * Dipakai dua tempat: tanda bintang di picker, dan filter "hanya stok saya"
 * saat mencari bridger. Saran yang bahannya harus dibeli dulu tidak bisa
 * dicoba malam itu juga — dan saran yang tidak bisa dicoba tidak membantu.
 */
export type Stock = {
  /** id raw material yang ada di rak */
  materials: Set<string>;
  /** id FO yang ada di rak */
  fos: Set<string>;
};

export async function listStock(): Promise<Stock> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const rows = await fetchAllPages<{
    raw_material_id: string | null;
    fragrance_oil_id: string | null;
  }>(
    (from, to) =>
      db
        .from("user_stock")
        .select("raw_material_id, fragrance_oil_id")
        .eq("owner_id", ownerId)
        .order("id")
        .range(from, to),
    "stok",
  );

  return {
    materials: new Set(
      rows.map((r) => r.raw_material_id).filter((v): v is string => !!v),
    ),
    fos: new Set(
      rows.map((r) => r.fragrance_oil_id).filter((v): v is string => !!v),
    ),
  };
}

export type OnHand = {
  /** sisa gram per raw material */
  materials: Map<string, number>;
  /** sisa gram per FO */
  fos: Map<string, number>;
};

/**
 * Sisa stok, dijumlahkan dari buku besar.
 *
 * Bahan yang tidak pernah bergerak tidak muncul di sini sama sekali — berbeda
 * dari bahan yang pernah dibeli lalu habis, yang muncul dengan nilai 0. Dua
 * keadaan itu memang berbeda, dan menyamakannya akan menyembunyikan bahan yang
 * perlu dibeli ulang.
 */
export async function stockOnHand(): Promise<OnHand> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const rows = await fetchAllPages<{
    raw_material_id: string | null;
    fragrance_oil_id: string | null;
    qty_g: number | null;
  }>(
    (from, to) =>
      db
        .from("stock_on_hand")
        .select("raw_material_id, fragrance_oil_id, qty_g")
        .eq("owner_id", ownerId)
        .range(from, to),
    "sisa stok",
  );

  const materials = new Map<string, number>();
  const fos = new Map<string, number>();

  for (const row of rows) {
    const qty = Number(row.qty_g ?? 0);
    if (row.raw_material_id) {
      materials.set(row.raw_material_id, qty);
    } else if (row.fragrance_oil_id) {
      fos.set(row.fragrance_oil_id, qty);
    }
  }

  return { materials, fos };
}

export type Movement = {
  id: string;
  kind: "pembelian" | "produksi" | "penyesuaian";
  qtyG: number;
  unitPriceIdr: number | null;
  note: string | null;
  happenedAt: string;
  targetId: string;
  targetKind: "rm" | "fo";
};

/** Riwayat pergerakan, terbaru dulu. */
export async function listMovements(limit = 100): Promise<Movement[]> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("stock_movements")
    .select(
      "id, kind, qty_g, unit_price_idr, note, happened_at, raw_material_id, fragrance_oil_id",
    )
    .eq("owner_id", ownerId)
    .order("happened_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Gagal memuat riwayat stok: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    qtyG: Number(r.qty_g),
    unitPriceIdr: r.unit_price_idr == null ? null : Number(r.unit_price_idr),
    note: r.note,
    happenedAt: r.happened_at,
    targetId: (r.raw_material_id ?? r.fragrance_oil_id)!,
    targetKind: r.raw_material_id ? "rm" : "fo",
  }));
}
