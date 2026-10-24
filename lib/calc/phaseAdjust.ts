import { starterDose } from "./bridge";
import { expand } from "./expand";
import { strengthOf } from "./strength";
import { PHASE_PRESENCE, phaseReport, type PhaseKey } from "./phases";
import {
  itemsWithTier,
  linesAfterAdd,
  linesAfterEdit,
  linesAfterPyramid,
  withLines,
} from "./simulate";
import type { ExpandedItem, FormulaContext, Line, Pyramid, Tier } from "./types";

/**
 * "Base-nya kekencengan di opening — atur pakai apa?"
 *
 * Porsi tiap tier di satu fase cuma punya dua tuas yang bisa disentuh dari
 * formula: BERAT tiap tier (target piramida) dan KEKUATAN isinya (bahan apa,
 * berapa persen). Faktor kehadiran per fase (PHASE_PRESENCE) adalah sifat
 * penguapan — tidak bisa diatur dari resep. Fungsi ini menawarkan kedua tuas
 * itu, masing-masing dengan pratinjau dari simulator aksi editor yang sama
 * (simulate.ts), jadi angka yang dijanjikan sama dengan yang terjadi.
 */

type PyramidTier = Exclude<Tier, "all">;
export type PhaseDirection = "up" | "down";

export type PyramidShift = {
  pyramid: Pyramid;
  /** tier yang dikorbankan (turun) atau diberi (naik) */
  other: PyramidTier;
  delta: number;
  afterPct: number;
};

export type PhaseLineOption = { action: "half" | "remove"; newPct: number; afterPct: number };

export type PhaseLine = {
  lineId: string;
  name: string;
  pct: number;
  /** seberapa banyak porsi tier ini turun di fase ini kalau barisnya dihapus */
  responsibility: number;
  options: PhaseLineOption[];
};

export type PhaseCandidate = {
  materialId: string;
  name: string;
  impact: number | null;
  inStock: boolean;
  dose: number;
  afterPct: number;
};

export type PhaseLever = {
  phase: PhaseKey;
  tier: PyramidTier;
  direction: PhaseDirection;
  beforePct: number;
  /** null kalau mode piramida mati — tuas ini tidak ada */
  pyramidShifts: PyramidShift[] | null;
  /** turunkan: baris di tier itu yang paling bertanggung jawab */
  lines: PhaseLine[];
  /** naikkan: bahan master yang menguap di tier itu, paling efektif dulu */
  candidates: PhaseCandidate[];
};

const DELTAS = [5, 10];
/** Pergeseran minimal (poin persen) supaya sebuah opsi layak disebut. */
const MIN_MOVE = 0.5;

export function phaseLever(
  ctx: FormulaContext,
  phase: PhaseKey,
  tier: PyramidTier,
  direction: PhaseDirection,
  opts: { onlyStock?: boolean; limit?: number } = {},
): PhaseLever {
  const { onlyStock = false, limit = 5 } = opts;
  const sign = direction === "up" ? 1 : -1;

  const pctFromItems = (c: FormulaContext, items: ExpandedItem[]) =>
    phaseReport(c, items).phases.find((p) => p.key === phase)!.tiers[tier];
  const pctFromLines = (lines: Line[], pyramid = ctx.version.pyramid) => {
    const c = withLines(ctx, lines, pyramid);
    return pctFromItems(c, expand(c));
  };

  const baseItems = expand(ctx);
  const beforePct = pctFromItems(ctx, baseItems);
  const moved = (after: number) => sign * (after - beforePct) >= MIN_MOVE;

  // ---------------------------------------------------- tuas 1: piramida
  let pyramidShifts: PyramidShift[] | null = null;
  const pyr = ctx.version.pyramid;
  if (pyr) {
    pyramidShifts = [];
    for (const other of (["top", "mid", "base"] as const).filter((t) => t !== tier)) {
      for (const delta of DELTAS) {
        const next = { ...pyr, [tier]: pyr[tier] + sign * delta, [other]: pyr[other] - sign * delta };
        if (next[tier] < 0 || next[other] < 0) continue;
        const afterPct = pctFromLines(linesAfterPyramid(ctx, next), next);
        if (moved(afterPct)) pyramidShifts.push({ pyramid: next, other, delta, afterPct });
      }
    }
    pyramidShifts.sort((a, b) => sign * (b.afterPct - a.afterPct));
    pyramidShifts = pyramidShifts.slice(0, 4);
  }

  // ------------------------------------------- tuas 2a: kurangi isi tier
  const lines: PhaseLine[] = [];
  if (direction === "down") {
    for (const line of ctx.version.lines) {
      if (line.tier !== tier || line.kind === "fo") continue;
      const removed = pctFromItems(
        ctx,
        itemsWithTier(ctx, baseItems, tier, linesAfterEdit(ctx, line.id, 0)),
      );
      const responsibility = beforePct - removed;
      if (responsibility < MIN_MOVE) continue;
      const half = line.pct / 2;
      const halved = pctFromItems(
        ctx,
        itemsWithTier(ctx, baseItems, tier, linesAfterEdit(ctx, line.id, half)),
      );
      lines.push({
        lineId: line.id,
        name:
          line.kind === "raw_material"
            ? (ctx.materials.get(line.refId)?.name ?? "bahan")
            : (ctx.accords.get(line.refId)?.name ?? "accord"),
        pct: line.pct,
        responsibility,
        options: [
          { action: "half", newPct: half, afterPct: halved },
          { action: "remove", newPct: 0, afterPct: removed },
        ],
      });
    }
    lines.sort((a, b) => b.responsibility - a.responsibility);
  }

  // ------------------------------------------ tuas 2b: tambah bahan kuat
  // Bahan di tier yang tidak hadir di fase ini (Top di Drydown) tidak akan
  // menggeser apa pun — tidak perlu dicari.
  const candidates: PhaseCandidate[] = [];
  if (direction === "up" && PHASE_PRESENCE[phase][tier] > 0) {
    const used = new Set(ctx.version.lines.map((l) => l.refId));
    const pool = [...ctx.materials.values()]
      .filter(
        (m) =>
          !used.has(m.id) &&
          !m.isSolvent &&
          m.impact != null &&
          (m.noteTierHint ?? "mid") === tier &&
          (!onlyStock || ctx.stock.has(m.id)),
      )
      // Pra-saring murah: yang menggeser porsi kekuatan adalah impact.
      .sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0))
      .slice(0, limit * 4);

    // Sama dengan strengthTable().totalScore — dosis awal di sini harus sama
    // dengan dosis awal saran di tempat lain.
    const totalScore = baseItems.reduce(
      (s, it) => s + strengthOf(it, ctx.materials.get(it.refId)),
      0,
    );

    for (const m of pool) {
      const dose = starterDose(m, { totalScore, settings: ctx.settings });
      const afterPct = pctFromItems(
        ctx,
        itemsWithTier(
          ctx,
          baseItems,
          tier,
          linesAfterAdd(ctx, { kind: "raw_material", refId: m.id }, tier, dose),
        ),
      );
      if (!moved(afterPct)) continue;
      candidates.push({
        materialId: m.id,
        name: m.name,
        impact: m.impact,
        inStock: ctx.stock.has(m.id),
        dose,
        afterPct,
      });
    }
    candidates.sort((a, b) => b.afterPct - a.afterPct);
  }

  return {
    phase,
    tier,
    direction,
    beforePct,
    pyramidShifts,
    lines: lines.slice(0, limit),
    candidates: candidates.slice(0, limit),
  };
}
