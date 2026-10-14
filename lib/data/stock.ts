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
export async function listStock(): Promise<Set<string>> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const rows = await fetchAllPages<{ raw_material_id: string }>(
    (from, to) =>
      db
        .from("user_stock")
        .select("raw_material_id")
        .eq("owner_id", ownerId)
        .order("raw_material_id")
        .range(from, to),
    "stok",
  );

  return new Set(rows.map((r) => r.raw_material_id));
}
