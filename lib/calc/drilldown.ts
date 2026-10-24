import { aromaShares } from "./aroma";
import { OTHER_SUBNOTE, classifySubnote, hasSubnotes } from "./subnotes";
import type { ExpandedItem, Material, Tier } from "./types";

/**
 * Isi satu irisan aroma: dari bahan mana, dan sub-aroma apa.
 *
 * Angka tiap bahan diambil dari penyumbang yang sama dengan pie utama
 * (aromaShares) — tidak dihitung ulang — lalu dinyatakan sebagai porsi DARI
 * IRISAN ITU, supaya donat drill-down berjumlah 100%: "Woody-nya 40%
 * sandalwood", bukan "6,8% formula".
 */

export type DrillMaterial = { refId: string; name: string; pct: number };

export type DrillGroup = {
  /** kunci sub-aroma, atau refId bahan kalau facet ini belum punya kamus */
  key: string;
  /** porsi dari irisan, 0..100 */
  pct: number;
  materials: DrillMaterial[];
};

export type FacetDrilldown = {
  facet: string;
  /** porsi irisan ini di pie asalnya */
  slicePct: number;
  /** true = dikelompokkan per sub-aroma; false = per bahan */
  bySubnote: boolean;
  groups: DrillGroup[];
};

export function facetDrilldown(
  items: ExpandedItem[],
  materials: Map<string, Material>,
  facet: string,
  /** "nama | sinonim | odour profile" per bahan */
  textOf: (refId: string) => string,
  scope: Tier = "all",
): FacetDrilldown {
  const slice = aromaShares(items, materials, scope === "all" ? undefined : scope).find(
    (s) => s.facet === facet,
  );
  if (!slice || slice.pct <= 0) {
    return { facet, slicePct: 0, bySubnote: hasSubnotes(facet), groups: [] };
  }

  const ofSlice = (pct: number) => (pct / slice.pct) * 100;
  const bySubnote = hasSubnotes(facet);
  const groups = new Map<string, DrillGroup>();

  for (const c of slice.contributors) {
    const key = bySubnote ? classifySubnote(facet, textOf(c.refId)) : c.refId;
    const g = groups.get(key) ?? { key, pct: 0, materials: [] };
    g.pct += ofSlice(c.pct);
    g.materials.push({ refId: c.refId, name: c.name, pct: ofSlice(c.pct) });
    groups.set(key, g);
  }

  const sorted = [...groups.values()]
    .map((g) => ({ ...g, materials: g.materials.sort((a, b) => b.pct - a.pct) }))
    // Kelompok "lain" selalu di akhir: dia sisa, bukan sub-aroma.
    .sort(
      (a, b) =>
        Number(a.key === OTHER_SUBNOTE) - Number(b.key === OTHER_SUBNOTE) ||
        b.pct - a.pct,
    );

  return { facet, slicePct: slice.pct, bySubnote, groups: sorted };
}
