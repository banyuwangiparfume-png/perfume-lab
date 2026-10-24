import {
  addLine,
  editLinePct,
  removeLine,
  scaleTier,
  tierTarget,
} from "./allocate";
import { expand } from "./expand";
import type {
  ExpandedItem,
  FormulaContext,
  Line,
  LineKind,
  Pyramid,
  Tier,
} from "./types";

/**
 * Simulator aksi editor, untuk pratinjau "kalau saya klik ini, jadinya apa".
 *
 * Tiap fungsi di sini meniru SATU aksi store editor dengan fungsi allocate
 * yang sama persis. Itu bukan detail: menambah atau mengurangi satu baris
 * membuat baris TERBUKA lain di tier itu ikut dibagi ulang, dan pratinjau
 * yang mengabaikannya menjanjikan angka yang tidak pernah terjadi. Satu
 * simulator untuk semua pratinjau (Tingkatkan, Turunkan, Padukan, fase),
 * supaya tidak ada pratinjau yang diam-diam memakai aturan lain.
 */

export const withLines = (
  ctx: FormulaContext,
  lines: Line[],
  pyramid: Pyramid | null = ctx.version.pyramid,
): FormulaContext => ({ ...ctx, version: { ...ctx.version, lines, pyramid } });

const replaceTier = (lines: Line[], tier: Tier, next: Line[]) => [
  ...lines.filter((l) => l.tier !== tier),
  ...next,
];

/** id baris sintetis yang dipakai pratinjau tambah-bahan */
export const SIM_LINE_ID = "__sim";

/**
 * Persis tombol "+ Tier" di editor: baris baru masuk terbuka dan ikut dibagi,
 * lalu dipatok ke dosis awalnya.
 */
export function linesAfterAdd(
  ctx: FormulaContext,
  ref: { kind: LineKind; refId: string },
  tier: Tier,
  dose: number,
): Line[] {
  const lines = ctx.version.lines;
  const target = tierTarget(ctx.version.pyramid, tier);
  const added = addLine(
    lines.filter((l) => l.tier === tier),
    {
      id: SIM_LINE_ID,
      tier,
      kind: ref.kind,
      refId: ref.refId,
      pct: 0,
      locked: false,
      userDilutionPct: 100,
      userSolventId: null,
    },
    target,
  );
  return replaceTier(lines, tier, editLinePct(added, SIM_LINE_ID, dose, target));
}

/** Persis mengetik persen (0 = menghapus barisnya). */
export function linesAfterEdit(
  ctx: FormulaContext,
  lineId: string,
  pct: number,
): Line[] {
  const lines = ctx.version.lines;
  const line = lines.find((l) => l.id === lineId);
  if (!line) return lines;
  const tierLines = lines.filter((l) => l.tier === line.tier);
  const target = tierTarget(ctx.version.pyramid, line.tier);
  return replaceTier(
    lines,
    line.tier,
    pct <= 0
      ? removeLine(tierLines, lineId, target)
      : editLinePct(tierLines, lineId, pct, target),
  );
}

/** Persis mengubah target piramida: tiap tier yang berubah diskalakan. */
export function linesAfterPyramid(ctx: FormulaContext, pyramid: Pyramid): Line[] {
  let lines = ctx.version.lines;
  for (const tier of ["top", "mid", "base"] as Tier[]) {
    const old = tierTarget(ctx.version.pyramid, tier);
    const next = tierTarget(pyramid, tier);
    if (old === next) continue;
    lines = replaceTier(lines, tier, scaleTier(lines.filter((l) => l.tier === tier), old, next));
  }
  return lines;
}

/**
 * Item hasil pembentangan setelah SATU tier diganti — tier lain tidak
 * dibentangkan ulang. Hasilnya sama dengan expand() penuh, cuma jauh lebih
 * murah saat dipanggil puluhan kali untuk tiap kandidat saran.
 */
export function itemsWithTier(
  ctx: FormulaContext,
  baseItems: ExpandedItem[],
  tier: Tier,
  lines: Line[],
): ExpandedItem[] {
  return [
    ...baseItems.filter((i) => i.tier !== tier),
    ...expand(withLines(ctx, lines.filter((l) => l.tier === tier))),
  ];
}
