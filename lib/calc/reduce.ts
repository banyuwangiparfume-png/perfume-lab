import { editLinePct, removeLine, tierTarget } from "./allocate";
import { aromaShares } from "./aroma";
import { expand } from "./expand";
import type { FormulaContext, Line, Tier } from "./types";

/**
 * "Woody-nya kebanyakan — kurangi yang mana?"
 *
 * Kebalikan dari Tingkatkan, dan bedanya penting: Tingkatkan mencari bahan
 * BARU dari master; Turunkan membaca bahan yang SUDAH ADA di draf. Jawabannya
 * bukan "tambah apa", tapi "baris mana yang paling bertanggung jawab, dan apa
 * yang terjadi kalau dikurangi".
 *
 * Pratinjaunya menjalankan pembagian ulang yang sama persis dengan editor
 * (editLinePct / removeLine dari allocate). Ini bukan detail: mengurangi satu
 * baris membuat baris terbuka lain di tier itu NAIK mengisi sisanya, dan
 * kalau baris itu juga woody, irisannya hampir tidak turun. Pratinjau yang
 * mengabaikan itu akan menjanjikan penurunan yang tidak pernah terjadi.
 */

export type ReduceOption = {
  action: "half" | "remove";
  /** persen baris setelah aksi; 0 untuk hapus */
  newPct: number;
  /** porsi facet ini di pie yang sama, setelah aksi */
  afterPct: number;
};

export type FacetReducer = {
  lineId: string;
  name: string;
  tier: Tier;
  pct: number;
  /** seberapa banyak irisan ini turun kalau baris ini dihapus — dasar urutan */
  responsibility: number;
  options: ReduceOption[];
};

export type FacetReduction = {
  facet: string;
  scope: Tier;
  beforePct: number;
  lines: FacetReducer[];
};

/** Penurunan minimal (poin persen) supaya sebuah baris layak disebut. */
const MIN_DROP = 0.1;

export function facetReducers(
  ctx: FormulaContext,
  facet: string,
  scope: Tier = "all",
  limit = 6,
): FacetReduction {
  const tierFilter = scope === "all" ? undefined : scope;
  const shareOf = (lines: Line[]) => {
    try {
      const items = expand({ ...ctx, version: { ...ctx.version, lines } });
      return (
        aromaShares(items, ctx.materials, tierFilter).find((s) => s.facet === facet)
          ?.pct ?? 0
      );
    } catch {
      return Number.NaN; // accord bersiklus: tidak bisa dipratinjau
    }
  };

  const lines = ctx.version.lines;
  const beforePct = shareOf(lines);

  // Pra-saring murah: baris yang tidak membawa facet ini sama sekali (secara
  // langsung atau lewat isi accord) tidak perlu dipratinjau.
  let items: ReturnType<typeof expand> = [];
  try {
    items = expand(ctx);
  } catch {
    return { facet, scope, beforePct, lines: [] };
  }
  const carries = new Set<string>();
  for (const it of items) {
    if (it.kind !== "material") continue;
    if ((ctx.materials.get(it.refId)?.facets[facet] ?? 0) > 0) {
      carries.add(it.sourceLineId);
    }
  }

  const nameOf = (l: Line) =>
    l.kind === "raw_material"
      ? (ctx.materials.get(l.refId)?.name ?? "bahan")
      : l.kind === "accord"
        ? (ctx.accords.get(l.refId)?.name ?? "accord")
        : (ctx.fos.get(l.refId)?.name ?? "FO");

  const withTier = (tier: Tier, next: Line[]) => [
    ...lines.filter((l) => l.tier !== tier),
    ...next,
  ];

  const out: FacetReducer[] = [];
  for (const line of lines) {
    if (!carries.has(line.id)) continue;
    if (tierFilter && line.tier !== tierFilter) continue;

    const tierLines = lines.filter((l) => l.tier === line.tier);
    const target = tierTarget(ctx.version.pyramid, line.tier);

    const removed = shareOf(withTier(line.tier, removeLine(tierLines, line.id, target)));
    const halfPct = line.pct / 2;
    const halved = shareOf(
      withTier(line.tier, editLinePct(tierLines, line.id, halfPct, target)),
    );

    const responsibility = beforePct - removed;
    if (!(responsibility >= MIN_DROP)) continue;

    out.push({
      lineId: line.id,
      name: nameOf(line),
      tier: line.tier,
      pct: line.pct,
      responsibility,
      options: [
        { action: "half", newPct: halfPct, afterPct: halved },
        { action: "remove", newPct: 0, afterPct: removed },
      ],
    });
  }

  out.sort((a, b) => b.responsibility - a.responsibility);
  return { facet, scope, beforePct, lines: out.slice(0, limit) };
}
