import { PCT_EPSILON } from "./allocate";
import type { CostBreakdown } from "./cost";
import type { SolventReport } from "./solvents";
import type { RealPyramidRow, StrengthResult } from "./strength";
import { sum, type FormulaContext, type Tier } from "./types";
import { shareOf, type FunctionMix } from "./functions";

export type WarningLevel = "info" | "warning" | "critical";

export type WarningAction =
  | { kind: "normalize_tier"; tier: Tier; target: number }
  | { kind: "retarget_tier"; tier: Tier; target: number }
  | { kind: "adjust_solvent"; solventId: string; newDirectPct: number }
  | { kind: "move_line"; lineId: string; tier: Tier };

export type Warning = {
  code: string;
  level: WarningLevel;
  message: string;
  lineIds?: string[];
  action?: WarningAction;
};

const TIER_LABEL: Record<Tier, string> = {
  top: "Top",
  mid: "Mid",
  base: "Base",
  all: "Bahan",
};

const pct = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(n);

export type RulesInput = {
  ctx: FormulaContext;
  strength: StrengthResult;
  realPyramid: RealPyramidRow[];
  solvents: SolventReport;
  cost: CostBreakdown;
  functionMix: FunctionMix;
  /** terisi kalau expand() melempar — accord bersiklus atau terlalu dalam */
  expandError?: { message: string } | null;
};

/**
 * Rule engine v2 (R1–R13).
 *
 * Nadanya memberi tahu, bukan menghakimi: "Indole kemungkinan akan
 * mendominasi", bukan "formula kamu salah". Hanya R2 dan R12 yang benar-benar
 * memblokir penyimpanan versi — sisanya informasi yang boleh diabaikan user
 * kalau memang itu niatnya.
 */
export function runRules(input: RulesInput): Warning[] {
  const { ctx, strength, realPyramid, solvents, cost } = input;
  const out: Warning[] = [];
  const { version, settings } = ctx;

  // R12 — accord bersiklus / terlalu dalam. Paling atas karena memblokir.
  if (input.expandError) {
    out.push({
      code: "R12",
      level: "critical",
      message: input.expandError.message,
    });
    // Angka lain tidak bisa dipercaya saat pembentangan gagal.
    return out;
  }

  // R2 — total target piramida harus 100
  if (version.pyramid) {
    const total =
      version.pyramid.top + version.pyramid.mid + version.pyramid.base;
    if (Math.abs(total - 100) > 0.001) {
      out.push({
        code: "R2",
        level: "critical",
        message: `Piramida ${pct(total)}%. Kurangi atau tambah salah satu tier sampai totalnya 100%.`,
      });
    }
  }

  // R1 — isi tier tidak sama dengan targetnya
  for (const row of realPyramid) {
    const diff = row.filled - row.target;
    if (Math.abs(diff) > PCT_EPSILON) {
      out.push({
        code: "R1",
        level: "warning",
        message: `${TIER_LABEL[row.tier]} terisi ${pct(row.filled)}% dari target ${pct(row.target)}% (${diff > 0 ? "+" : "−"}${pct(Math.abs(diff))}).`,
        lineIds: version.lines
          .filter((l) => l.tier === row.tier)
          .map((l) => l.id),
        action: { kind: "normalize_tier", tier: row.tier, target: row.target },
      });
    }
  }

  // R3 — satu pelarut datang dari banyak sumber sekaligus
  for (const row of solvents.rows) {
    const sources =
      (row.directPct > 0 ? 1 : 0) +
      row.fromDilution.length +
      row.fromAccords.length +
      row.hiddenFromSupplier.length;
    if (sources >= 2) {
      out.push({
        code: "R3",
        level: "warning",
        message: `${row.name} datang dari ${sources} sumber, total efektif ${pct(row.effectiveTotal)}%. Yang kelihatan di resep cuma ${pct(row.directPct)}%.`,
      });
    }
  }

  // R4 — pelarut terlalu banyak
  for (const row of solvents.rows) {
    if (row.effectiveTotal > settings.solventWarn.singlePct) {
      const excess = row.effectiveTotal - settings.solventWarn.singlePct;
      out.push({
        code: "R4",
        level: "warning",
        message: `${row.name} ${pct(row.effectiveTotal)}% — di atas ambang ${pct(settings.solventWarn.singlePct)}%. Performa dan karakter bisa ikut berubah.`,
        action:
          row.directPct > 0
            ? {
                kind: "adjust_solvent",
                solventId: row.solventId,
                newDirectPct: Math.max(0, row.directPct - excess),
              }
            : undefined,
      });
    }
  }
  if (solvents.totalEffectivePct > settings.solventWarn.totalPct) {
    out.push({
      code: "R4",
      level: "warning",
      message: `Pelarut total ${pct(solvents.totalEffectivePct)}% — performa bisa turun.`,
    });
  }

  // R5 — bahan yang kekuatannya jauh melebihi porsinya
  for (const row of strength.rows) {
    if (row.strengthPct == null || row.isSolvent) continue;
    if (
      row.strengthPct >= settings.dominance.minStrengthPct &&
      row.strengthPct >= settings.dominance.ratio * row.productPct
    ) {
      out.push({
        code: "R5",
        level: "info",
        message: `${row.name} cuma ${pct(row.productPct)}% berat tapi ${pct(row.strengthPct)}% kekuatan — kemungkinan paling mendominasi.`,
      });
    }
  }

  // R6 — bahan tanpa nilai impact
  if (strength.missingImpact.length) {
    out.push({
      code: "R6",
      level: "info",
      message: `${strength.missingImpact.length} bahan belum punya impact (${strength.missingImpact.join(", ")}), dihitung sebagai 100.`,
    });
  }

  // R7 — bahan ditaruh di tier yang bukan kebiasaannya
  if (version.pyramid) {
    for (const line of version.lines) {
      if (line.kind !== "raw_material") continue;
      const m = ctx.materials.get(line.refId);
      if (!m?.noteTierHint || m.noteTierHint === line.tier) continue;
      out.push({
        code: "R7",
        level: "info",
        message: `${m.name} biasanya ${TIER_LABEL[m.noteTierHint].toLowerCase()}, sekarang di ${TIER_LABEL[line.tier]}. Bukan larangan — tier itu label penempatan, bukan fakta kimia.`,
        lineIds: [line.id],
        // Satu klik untuk memindahkannya — persennya ikut pindah, sama
        // dengan "Pindah ke" di menu baris.
        action: { kind: "move_line", lineId: line.id, tier: m.noteTierHint },
      });
    }
  }

  // R8 — bahan aktif jauh di bawah target tier
  for (const row of realPyramid) {
    const gap = row.target - row.active;
    if (gap > 10) {
      out.push({
        code: "R8",
        level: "warning",
        message: `${TIER_LABEL[row.tier]} aktif cuma ${pct(row.active)}% dari target ${pct(row.target)}% — sisanya pelarut.`,
      });
    }
  }

  // R9 — FO tidak ikut dinilai
  if (strength.excludedFoPct > 0) {
    out.push({
      code: "R9",
      level: "info",
      message: `FO ${pct(strength.excludedFoPct)}% tidak ikut dihitung di kekuatan dan aroma — isinya tidak diketahui.`,
    });
  }

  // R10 — harga diambil dari tier lain
  if (cost.fallbackCount > 0) {
    out.push({
      code: "R10",
      level: "info",
      message: `${cost.fallbackCount} bahan tidak punya harga di tier ${cost.tier} g, dipakai tier terdekat. Angkanya konservatif.`,
    });
  }
  if (cost.missing.length) {
    out.push({
      code: "R10",
      level: "info",
      message: `${cost.missing.length} bahan belum punya harga sama sekali (${cost.missing.join(", ")}). HPP di bawah belum lengkap.`,
    });
  }

  // R11 — bahan yang sama datang langsung DAN lewat accord.
  // Sengaja dihitung dari porsi yang benar-benar melewati accord, bukan dari
  // selisih productPct - weighPct: selisih itu juga terisi oleh pelarut yang
  // masuk dari dilusi, dan itu urusan R3, bukan R11.
  for (const row of strength.rows) {
    if (row.weighPct <= 0 || row.viaAccordPct <= PCT_EPSILON) continue;
    out.push({
      code: "R11",
      level: "info",
      message: `${row.name} ada langsung (${pct(row.weighPct)}%) dan ikut masuk dari accord (+${pct(row.viaAccordPct)}%) — totalnya ${pct(row.productPct)}%.`,
    });
  }

  // R13 — peran fixative di dalam formula.
  //
  // Bridger menjawab "dua sisi ini tidak nyambung". Ini menjawab pertanyaan
  // lain yang sebelumnya tidak dijawab panel mana pun: apakah ada yang menahan
  // formula ini supaya tidak hilang duluan.
  //
  // Sengaja TIDAK memaksakan satu mazhab komposisi. Formula kecil dilewati,
  // dan kalau kategori fungsinya sendiri belum terisi, yang dilaporkan adalah
  // datanya yang kurang — bukan formulanya yang salah.
  const fx = settings.functionMix;
  if (input.functionMix.materialCount >= fx.minMaterials) {
    const mix = input.functionMix;
    const fixative = shareOf(mix, "fixative");

    if (mix.coverage < fx.minCoveragePct) {
      out.push({
        code: "R13",
        level: "info",
        message: `Cuma ${pct(mix.coverage)}% bahan yang punya kategori fungsi, jadi porsi fixative belum bisa dinilai. Lengkapi kategorinya di halaman bahan.`,
      });
    } else if (fixative <= PCT_EPSILON) {
      out.push({
        code: "R13",
        level: "warning",
        message:
          "Belum ada bahan berkategori Fixative. Tidak ada yang menahan bahan ringan, jadi drydown-nya akan sependek bahan paling cepat menguap.",
      });
    } else if (fixative < fx.fixativeWarnPct) {
      out.push({
        code: "R13",
        level: "info",
        message: `Fixative cuma ${pct(fixative)}% dari bahan pewangi, di bawah ambang ${pct(fx.fixativeWarnPct)}%. Drydown-nya bisa pendek — naikkan kalau memang mau bertahan lama.`,
      });
    }
  }

  return out;
}

export const RULES_FOOTER =
  "Ini perkiraan struktural dari data supplier, bukan prediksi bau. Cium dan nilai sendiri.";

export const RULES_HEALTHY =
  "Strukturnya sehat. Sekarang racik dan cium sendiri — pemeriksaan ini tidak bisa menilai aroma.";

/** Hanya R2 dan R12 yang menghalangi "Simpan versi". */
export function blocksSave(warnings: Warning[]): boolean {
  return warnings.some((w) => w.code === "R2" || w.code === "R12");
}

export function countByLevel(warnings: Warning[]) {
  return {
    critical: warnings.filter((w) => w.level === "critical").length,
    warning: warnings.filter((w) => w.level === "warning").length,
    info: warnings.filter((w) => w.level === "info").length,
  };
}

/** Dipakai R1 saat user menekan "Normalisasi": total tier sekarang. */
export function tierFilled(ctx: FormulaContext, tier: Tier): number {
  return sum(ctx.version.lines.filter((l) => l.tier === tier).map((l) => l.pct));
}
