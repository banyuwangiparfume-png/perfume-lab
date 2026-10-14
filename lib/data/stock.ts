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
