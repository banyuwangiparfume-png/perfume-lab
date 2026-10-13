import "server-only";

import { getOwnerId } from "../owner";
import { getDb } from "../supabase/db";
import type { FragranceOilRow } from "../supabase/database.types";

export type FoFilter = {
  search?: string;
  family?: string;
  supplier?: string;
  includeInactive?: boolean;
};

export async function listFragranceOils(
  filter: FoFilter = {},
): Promise<FragranceOilRow[]> {
  const db = getDb();
  const ownerId = await getOwnerId();

  let q = db
    .from("fragrance_oils")
    .select("*")
    .eq("owner_id", ownerId)
    .order("name");

  if (!filter.includeInactive) q = q.eq("is_active", true);
  if (filter.family) q = q.eq("family", filter.family);
  if (filter.supplier) q = q.eq("supplier", filter.supplier);
  if (filter.search) {
    const s = filter.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`name.ilike.%${s}%,inspired_by.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Gagal memuat daftar FO: ${error.message}`);
  return data ?? [];
}

export async function getFragranceOil(
  id: string,
): Promise<FragranceOilRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from("fragrance_oils")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat FO: ${error.message}`);
  return data ?? null;
}

export async function getFragranceOilsByIds(
  ids: string[],
): Promise<Map<string, FragranceOilRow>> {
  if (!ids.length) return new Map();
  const db = getDb();
  const { data, error } = await db
    .from("fragrance_oils")
    .select("*")
    .in("id", ids);
  if (error) throw new Error(`Gagal memuat FO: ${error.message}`);
  return new Map((data ?? []).map((f) => [f.id, f]));
}

export async function listFoSuppliers(): Promise<string[]> {
  const db = getDb();
  const ownerId = await getOwnerId();
  const { data, error } = await db
    .from("fragrance_oils")
    .select("supplier")
    .eq("owner_id", ownerId)
    .not("supplier", "is", null);
  if (error) throw new Error(`Gagal memuat supplier: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.supplier as string))].sort();
}
