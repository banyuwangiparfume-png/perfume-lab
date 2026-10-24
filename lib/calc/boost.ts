import { starterDose } from "./bridge";
import { previewFacetShift } from "./roles";
import type { ExpandedItem, FormulaContext, Material, Tier } from "./types";

/**
 * "Saya mau Woody-nya naik — pakai apa?"
 *
 * Saran dipetakan ke IRISAN AROMA, bukan ke masalah struktural. Tab
 * Bridger/Diffuser/Fixative menjawab "formula ini kurang apa"; ini menjawab
 * pertanyaan yang lebih sering muncul saat meracik: satu arah terasa kurang,
 * dan ingin dinaikkan — dengan peran yang berbeda-beda:
 *
 *  - Modifier: menambah karakter itu sendiri
 *  - Diffuser: membawa karakter itu keluar lebih jauh
 *  - Fixative: menahan karakter itu lebih lama
 *
 * Urutannya dari KENAIKAN NYATA irisan itu pada dosis awal, bukan dari
 * kemiripan facet saja: bahan yang 90% woody tapi impact-nya 20 menggeser
 * pie lebih sedikit daripada bahan 60% woody ber-impact 300.
 */

export const BOOST_ROLES = ["modifier", "diffuser", "fixative"] as const;
export type BoostRole = (typeof BOOST_ROLES)[number];

export type BoostSuggestion = {
  materialId: string;
  name: string;
  role: BoostRole;
  tier: Tier;
  starterDose: number;
  impact: number | null;
  inStock: boolean;
  /** porsi facet ini di pie seluruh formula: sekarang → setelah ditambah */
  beforePct: number;
  afterPct: number;
  /** bobot facet ini di vektor bahannya, 0..1 */
  facetWeight: number;
  /** peran hanya ditebak dari family — ditampilkan berbeda */
  guessedRole: boolean;
};

export type FacetBoosts = Record<string, Record<BoostRole, BoostSuggestion[]>>;

/** Tier tempat sebuah bahan menguap — fixative selalu Base. */
const naturalTier = (m: Material, role: BoostRole): Tier =>
  role === "fixative" ? "base" : (m.noteTierHint ?? "mid");

/** Bahan baru dianggap membawa facet ini kalau bobotnya minimal segini. */
const MIN_FACET_WEIGHT = 0.35;
/** Kenaikan minimal (poin persen) supaya layak disebut menaikkan. */
const MIN_GAIN = 0.1;

export function facetBoosts(
  ctx: FormulaContext,
  items: ExpandedItem[],
  facets: string[],
  opts: {
    onlyStock?: boolean;
    totalScore?: number;
    limit?: number;
    /**
     * Pie yang mau dinaikkan: seluruh formula, atau satu tier. Untuk satu
     * tier, yang disarankan hanya bahan yang memang menguap di tier itu —
     * bahan Top tidak akan menaikkan Woody di Mid, karena dia sudah habis
     * sebelum Mid tercium.
     */
    scope?: Tier;
  } = {},
): FacetBoosts {
  const { onlyStock = false, limit = 5, scope = "all" } = opts;
  const used = new Set(
    items.filter((i) => i.kind === "material").map((i) => i.refId),
  );

  const pool: Material[] = [];
  for (const m of ctx.materials.values()) {
    if (used.has(m.id) || m.isSolvent) continue;
    if (onlyStock && !ctx.stock.has(m.id)) continue;
    const role = (m.functionCategory ?? "").toLowerCase();
    if (!(BOOST_ROLES as readonly string[]).includes(role)) continue;
    pool.push(m);
  }

  const out: FacetBoosts = {};
  for (const facet of facets) {
    const byRole = {} as Record<BoostRole, BoostSuggestion[]>;
    for (const role of BOOST_ROLES) {
      // Pra-saring murah dulu (bobot facet × impact), baru hitung pratinjau
      // yang mahal untuk segelintir teratas.
      const candidates = pool
        .filter(
          (m) =>
            (m.functionCategory ?? "").toLowerCase() === role &&
            (m.facets[facet] ?? 0) >= MIN_FACET_WEIGHT &&
            (scope === "all" || naturalTier(m, role) === scope),
        )
        .sort(
          (a, b) =>
            (b.facets[facet] ?? 0) * (b.impact ?? 100) -
            (a.facets[facet] ?? 0) * (a.impact ?? 100),
        )
        .slice(0, limit * 4);

      const list: BoostSuggestion[] = [];
      for (const m of candidates) {
        const dose = starterDose(m, {
          totalScore: opts.totalScore,
          settings: ctx.settings,
        });
        // Penahan ke Base. Yang lain ke kebiasaan bahannya — tier itu
        // kecepatan menguap, bukan pilihan.
        const tier = naturalTier(m, role);
        const p = previewFacetShift(ctx, items, m, dose, tier, facet, scope);
        if (p.afterPct - p.beforePct < MIN_GAIN) continue;
        list.push({
          materialId: m.id,
          name: m.name,
          role,
          tier,
          starterDose: dose,
          impact: m.impact,
          inStock: ctx.stock.has(m.id),
          beforePct: p.beforePct,
          afterPct: p.afterPct,
          facetWeight: m.facets[facet] ?? 0,
          guessedRole: m.functionSource === "derived",
        });
      }
      byRole[role] = list
        .sort(
          (a, b) =>
            b.afterPct - b.beforePct - (a.afterPct - a.beforePct) ||
            a.name.localeCompare(b.name, "id"),
        )
        .slice(0, limit);
    }
    out[facet] = byRole;
  }
  return out;
}
