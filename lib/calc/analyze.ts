import { aromaPie, type AromaPie } from "./aroma";
import {
  crossTierBridges,
  tierCohesionReport,
  type TierBridge,
  type TierCohesion,
} from "./bridge";
import { costBreakdown, type CostBreakdown } from "./cost";
import { expand, ExpandError, mergeByMaterial, type MergedItem } from "./expand";
import { roleReport, type RoleReport } from "./roles";
import { functionMix, shareOf, type FunctionMix } from "./functions";
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
  /** komposisi peran bahan: diffuser / modifier / bridger / fixative */
  functions: FunctionMix;
  /**
   * Saran penguat proyeksi, per sasaran: `all` searah formula keseluruhan,
   * `top`/`mid`/`base` searah tier itu saja. Tier diisi hanya kalau mode
   * piramida aktif — bentuknya sama dengan `aroma`.
   */
  diffusers: Record<Tier, RoleReport>;
  /** saran penahan drydown, dengan kriteria yang sama */
  fixatives: RoleReport;
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

const PYRAMID_SCOPES: Tier[] = ["top", "mid", "base"];

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

  // Porsinya murah dihitung dan selalu berguna; yang mahal cuma pencarian
  // sarannya, jadi hanya itu yang ikut dimatikan saat mengetik.
  const quickRole = (
    role: "diffuser" | "fixative",
    scope: Tier = "all",
  ): RoleReport => ({
    role,
    scope,
    sharePct: shareOf(functions, role),
    present: [],
    suggestions: [],
  });

  const skipRoles = opts.skipBridges || expandError;

  const diffuserFor = (scope: Tier) =>
    skipRoles
      ? quickRole("diffuser", scope)
      : roleReport(ctx, items, functions, "diffuser", {
          onlyStock: opts.onlyStockBridges,
          totalScore: strength.totalScore,
          scope,
        });

  const diffusers: Record<Tier, RoleReport> = {
    all: diffuserFor("all"),
    top: quickRole("diffuser", "top"),
    mid: quickRole("diffuser", "mid"),
    base: quickRole("diffuser", "base"),
  };
  if (ctx.version.pyramid) {
    for (const t of PYRAMID_SCOPES) diffusers[t] = diffuserFor(t);
  }

  const fixatives = skipRoles
    ? quickRole("fixative")
    : roleReport(ctx, items, functions, "fixative", {
        onlyStock: opts.onlyStockBridges,
        totalScore: strength.totalScore,
      });

  return {
    items,
    merged: mergeByMaterial(items),
    lines,
    strength,
    functions,
    diffusers,
    fixatives,
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
