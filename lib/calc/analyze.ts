import { aromaPie, type AromaPie } from "./aroma";
import {
  crossTierBridges,
  withinTierBridges,
  type TierBridge,
  type WithinTierPair,
} from "./bridge";
import { costBreakdown, type CostBreakdown } from "./cost";
import { expand, ExpandError, mergeByMaterial, type MergedItem } from "./expand";
import { lineTable, type LineTable } from "./lines";
import { runRules, type Warning } from "./rules";
import { solventReport, type SolventReport } from "./solvents";
import {
  realPyramid,
  strengthTable,
  type RealPyramidRow,
  type StrengthResult,
} from "./strength";
import type { ExpandedItem, FormulaContext, Tier } from "./types";

export type Analysis = {
  items: ExpandedItem[];
  merged: Map<string, MergedItem>;
  /** komposisi per baris yang diketik user — untuk dibaca, bukan dihitung ulang */
  lines: LineTable;
  strength: StrengthResult;
  realPyramid: RealPyramidRow[];
  aroma: Record<Tier, AromaPie>;
  solvents: SolventReport;
  cost: CostBreakdown;
  bridges: { crossTier: TierBridge[]; withinTier: WithinTierPair[] };
  warnings: Warning[];
  /** % formula yang ikut dinilai kekuatannya */
  coverage: number;
  /** terisi kalau accord bersiklus / terlalu dalam — sisa analisa kosong */
  error: string | null;
};

export type AnalyzeOptions = {
  onlyStockBridges?: boolean;
  /** bridge engine paling mahal; editor bisa mematikannya saat mengetik */
  skipBridges?: boolean;
};

const emptyPie = (): AromaPie => ({
  slices: [],
  other: 0,
  missingFacets: [],
  excludedPct: 0,
});

/**
 * Satu pintu masuk untuk seluruh analisa formula.
 *
 * Editor memanggil ini tiap state berubah (debounce 150 ms). Untuk formula
 * ≤ 40 baris plus accord, biayanya jauh di bawah 10 ms — tidak perlu web
 * worker.
 *
 * Pakai fungsi ini, jangan merangkai expand + strength + rules sendiri:
 * pasangan yang keliru menghasilkan angka yang kelihatan benar tapi salah,
 * dan itu jenis bug yang tidak ada yang sadar sampai parfumnya sudah diracik.
 */
export function analyze(
  ctx: FormulaContext,
  opts: AnalyzeOptions = {},
): Analysis {
  let items: ExpandedItem[] = [];
  let expandError: { message: string } | null = null;

  try {
    items = expand(ctx);
  } catch (e) {
    if (e instanceof ExpandError) {
      expandError = { message: e.message };
    } else {
      throw e;
    }
  }

  const strength = strengthTable(ctx, items);
  const lines = lineTable(ctx, items);
  const pyramid = realPyramid(ctx, items);
  const solvents = solventReport(ctx, items);
  const cost = costBreakdown(ctx, items);

  const warnings = runRules({
    ctx,
    strength,
    realPyramid: pyramid,
    solvents,
    cost,
    expandError,
  });

  const tiers: Tier[] = ctx.version.pyramid ? ["top", "mid", "base"] : ["all"];
  const aroma: Record<Tier, AromaPie> = {
    all: aromaPie(items, ctx.materials),
    top: emptyPie(),
    mid: emptyPie(),
    base: emptyPie(),
  };
  for (const t of tiers) {
    aroma[t] = aromaPie(items, ctx.materials, t);
  }

  const bridges =
    opts.skipBridges || expandError
      ? { crossTier: [], withinTier: [] }
      : {
          crossTier: crossTierBridges(ctx, items, {
            onlyStock: opts.onlyStockBridges,
          }),
          withinTier: withinTierBridges(ctx, items, {
            onlyStock: opts.onlyStockBridges,
          }),
        };

  return {
    items,
    merged: mergeByMaterial(items),
    lines,
    strength,
    realPyramid: pyramid,
    aroma,
    solvents,
    cost,
    bridges,
    warnings,
    coverage: strength.coverage,
    error: expandError?.message ?? null,
  };
}
