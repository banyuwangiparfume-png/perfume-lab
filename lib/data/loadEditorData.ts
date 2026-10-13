import "server-only";

import type { BridgeRule, Material, Settings } from "../calc/types";
import { getOwnerId } from "../owner";
import { mergeSettings } from "../settings";
import { getDb } from "../supabase/db";
import type { FacetRow } from "../supabase/database.types";
import { loadFormulaContext } from "./loadFormulaContext";
import { listAccordsForPicker, type AccordOption } from "./versions";

export type EditorData = {
  materials: Material[];
  /** bahan yang bisa dipilih sebagai pelarut dilusi */
  solvents: { id: string; name: string }[];
  accords: AccordOption[];
  fos: { id: string; name: string; pricePerGram: number | null }[];
  facets: FacetRow[];
  bridgeRules: BridgeRule[];
  stock: string[];
  settings: Settings;
};

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Semua yang dibutuhkan editor untuk menghitung TANPA bolak-balik ke server.
 *
 * Seluruh master bahan ikut dikirim — terdengar banyak, tapi memang itu yang
 * dibutuhkan: picker mencarinya, panel kekuatan memakainya, dan mesin bridger
 * harus menimbang setiap kandidat terhadap formula yang sedang dibuka. Memuat
 * ulang per ketikan justru akan membuat panel analisa tersendat.
 */
export async function loadEditorData(formulaId: string): Promise<EditorData> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const [materialsRes, facetsRes, rulesRes, stockRes, settingsRes, fosRes, accords] =
    await Promise.all([
      db
        .from("raw_materials")
        .select(
          "id, name, synonym, cas_number, category, family, odour_profile, odor_impact, odor_impact_override, impact_basis, supplier_dilution_pct, supplier_solvent_id, function_category, note_tier_hint, is_bridge_candidate, is_solvent, facets:raw_material_facets(facet_key, weight)",
        )
        .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
        .eq("is_active", true)
        .order("name"),
      db.from("facets").select("*").order("sort_order"),
      db
        .from("bridge_rules")
        .select("id, raw_material_id, facet_a, facet_b, note, source")
        .or(`owner_id.is.null,owner_id.eq.${ownerId}`),
      db.from("user_stock").select("raw_material_id").eq("owner_id", ownerId),
      db
        .from("app_settings")
        .select("settings")
        .eq("owner_id", ownerId)
        .maybeSingle(),
      db
        .from("fragrance_oils")
        .select("id, name, price_per_gram")
        .eq("owner_id", ownerId)
        .eq("is_active", true)
        .order("name"),
      listAccordsForPicker(formulaId),
    ]);

  for (const r of [materialsRes, facetsRes, rulesRes, stockRes, fosRes]) {
    if (r.error) throw new Error(`Gagal memuat data editor: ${r.error.message}`);
  }

  type MaterialRow = {
    id: string;
    name: string;
    synonym: string | null;
    cas_number: string | null;
    category: string | null;
    family: string | null;
    odour_profile: string | null;
    odor_impact: number | null;
    odor_impact_override: number | null;
    impact_basis: "as_sold" | "active";
    supplier_dilution_pct: number;
    supplier_solvent_id: string | null;
    function_category: string | null;
    note_tier_hint: "top" | "mid" | "base" | "all" | null;
    is_bridge_candidate: boolean;
    is_solvent: boolean;
    facets: { facet_key: string; weight: number }[] | null;
  };

  const rows = (materialsRes.data ?? []) as unknown as MaterialRow[];

  // Harga diambil sekaligus untuk semua bahan — satu kueri, bukan satu per baris.
  const { data: priceRows, error: priceErr } = await db
    .from("rm_current_prices")
    .select("raw_material_id, tier_size, price_idr");
  if (priceErr) throw new Error(`Gagal memuat harga: ${priceErr.message}`);

  const prices = new Map<string, Record<number, number>>();
  for (const p of priceRows ?? []) {
    if (!p.raw_material_id || p.tier_size == null) continue;
    const bucket = prices.get(p.raw_material_id) ?? {};
    bucket[num(p.tier_size)] = num(p.price_idr);
    prices.set(p.raw_material_id, bucket);
  }

  const materials: Material[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    impact:
      m.odor_impact_override != null
        ? num(m.odor_impact_override)
        : m.odor_impact != null
          ? num(m.odor_impact)
          : null,
    impactBasis: m.impact_basis,
    supplierDilutionPct: num(m.supplier_dilution_pct, 100),
    supplierSolventId: m.supplier_solvent_id,
    facets: Object.fromEntries(
      (m.facets ?? []).map((f) => [f.facet_key, num(f.weight)]),
    ),
    functionCategory: m.function_category,
    noteTierHint:
      m.note_tier_hint === "all" ? null : m.note_tier_hint,
    isBridgeCandidate: m.is_bridge_candidate,
    isSolvent: m.is_solvent,
    prices: prices.get(m.id) ?? {},
  }));

  return {
    materials,
    solvents: rows
      .filter((m) => m.is_solvent)
      .map((m) => ({ id: m.id, name: m.name })),
    accords,
    fos: (fosRes.data ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      pricePerGram: f.price_per_gram == null ? null : num(f.price_per_gram),
    })),
    facets: facetsRes.data ?? [],
    bridgeRules: (rulesRes.data ?? []).map((r) => ({
      id: r.id,
      materialId: r.raw_material_id,
      facetA: r.facet_a,
      facetB: r.facet_b,
      note: r.note,
      source: r.source,
    })),
    stock: (stockRes.data ?? []).map((s) => s.raw_material_id),
    settings: mergeSettings(
      (settingsRes.data?.settings ?? null) as Parameters<
        typeof mergeSettings
      >[0],
    ),
  };
}

/** Metadata bahan untuk ditampilkan di picker dan tabel — bukan untuk hitung. */
export type MaterialMeta = {
  id: string;
  synonym: string | null;
  casNumber: string | null;
  family: string | null;
  odourProfile: string | null;
};

export async function loadMaterialMeta(): Promise<Map<string, MaterialMeta>> {
  const db = getDb();
  const ownerId = await getOwnerId();
  const { data, error } = await db
    .from("raw_materials")
    .select("id, synonym, cas_number, family, odour_profile")
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
    .eq("is_active", true);
  if (error) throw new Error(`Gagal memuat info bahan: ${error.message}`);
  return new Map(
    (data ?? []).map((m) => [
      m.id,
      {
        id: m.id,
        synonym: m.synonym,
        casNumber: m.cas_number,
        family: m.family,
        odourProfile: m.odour_profile,
      },
    ]),
  );
}

export { loadFormulaContext };
