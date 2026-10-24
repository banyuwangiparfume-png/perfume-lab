import { aromaPie, type AromaPie } from "./aroma";
import {
  crossTierBridges,
  tierCohesionReport,
  type TierBridge,
  type TierCohesion,
} from "./bridge";
import { costBreakdown, type CostBreakdown } from "./cost";
import { expand, ExpandError, mergeByMaterial, type MergedItem } from "./expand";
import { functionMix, type FunctionMix } from "./functions";
import { lineTable, type LineTable } from "./lines";
import { phaseReport, type PhaseReport } from "./phases";
import { splScore, type SplScore } from "./spl";
import { facetBoosts, type FacetBoosts } from "./boost";
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
  /** kekuatan per fase: Opening, Heart, Drydown — pendekatan dari tier */
  phases: PhaseReport;
  /** perkiraan sillage/projection/longevity dari susunan — bukan pengukuran */
  spl: SplScore;
  /**
   * Saran per irisan aroma: modifier / diffuser / fixative yang menaikkannya.
   * Per pie, sama dengan `aroma`: seluruh formula, dan tiap tier kalau
   * piramida aktif.
   */
  boosts: Record<Tier, FacetBoosts>;
  /** komposisi peran bahan: diffuser / modifier / bridger / fixative */
  functions: FunctionMix;
  realPyramid: RealPyramidRow[];
  aroma: Record<Tier, AromaPie>;
  solvents: SolventReport;
  cost: CostBreakdown;
  bridges: { crossTier: TierBridge[]; withinTier: TierCohesion[] };
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
  const functions = functionMix(strength);
  const pyramid = realPyramid(ctx, items);
  const solvents = solventReport(ctx, items);
  const cost = costBreakdown(ctx, items);

  const warnings = runRules({
    ctx,
    strength,
    realPyramid: pyramid,
    solvents,
    cost,
    functionMix: functions,
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
            totalScore: strength.totalScore,
          }),
          withinTier: tierCohesionReport(ctx, items, {
            onlyStock: opts.onlyStockBridges,
            totalScore: strength.totalScore,
          }),
        };

  // Saran "Tingkatkan" mahal, jadi ikut dimatikan saat mengetik.
  const skipRoles = opts.skipBridges || expandError;


  return {
    items,
    merged: mergeByMaterial(items),
    lines,
    strength,
    phases: phaseReport(ctx, items),
    spl: splScore(ctx, items),
    // Dihitung untuk irisan yang tampil di pie seluruh formula saja — itu
    // yang bisa diklik user. Ikut dimatikan saat mengetik, sama dengan saran
    // lain yang mahal.
    boosts: Object.fromEntries(
      (["all", "top", "mid", "base"] as Tier[]).map((t) => [
        t,
        skipRoles || (t !== "all" && !ctx.version.pyramid)
          ? {}
          : facetBoosts(
              ctx,
              items,
              aroma[t].slices.map((x) => x.facet),
              {
                onlyStock: opts.onlyStockBridges,
                totalScore: strength.totalScore,
                scope: t,
              },
            ),
      ]),
    ) as Record<Tier, FacetBoosts>,
    functions,
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
