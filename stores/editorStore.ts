"use client";

import { create } from "zustand";
import {
  addLine as allocAdd,
  allocateTier,
  applyRatio as allocRatio,
  editLinePct,
  moveLine as allocMove,
  normalizeTier as allocNormalize,
  removeLine as allocRemove,
  scaleTier,
  setLocked as allocSetLocked,
  spreadEven,
} from "@/lib/calc/allocate";
import { round5, type Line, type Pyramid, type Tier } from "@/lib/calc/types";

/**
 * State draf formula di client.
 *
 * SEMUA pembagian persen lewat lib/calc/allocate.ts — tidak ada satu pun rumus
 * yang ditulis di sini atau di komponen React. Store ini cuma mengurus tiga
 * hal: baris mana yang sedang ada, tumpukan undo, dan penanda bahwa ada
 * perubahan yang belum tersimpan.
 */

export type EditorSnapshot = {
  lines: Line[];
  pyramid: Pyramid | null;
  batchG: number;
  priceTierOverride: number | null;
};

export type EditorState = EditorSnapshot & {
  versionId: string;
  formulaId: string;
  pyramidMode: boolean;

  dirty: boolean;
  savedAt: number | null;
  /** 20 langkah terakhir — pembagian otomatis bisa mengubah banyak angka sekaligus */
  past: EditorSnapshot[];
  /** baris yang angkanya baru saja berubah otomatis, untuk disorot sebentar */
  highlighted: string[];

  init: (input: {
    versionId: string;
    formulaId: string;
    pyramidMode: boolean;
    lines: Line[];
    pyramid: Pyramid | null;
    batchG: number;
    priceTierOverride: number | null;
  }) => void;

  addLine: (tier: Tier, line: Omit<Line, "tier" | "pct" | "locked">) => void;
  editPct: (lineId: string, pct: number) => void;
  toggleLock: (lineId: string) => void;
  removeLine: (lineId: string) => void;
  setDilution: (
    lineId: string,
    userDilutionPct: number,
    userSolventId: string | null,
  ) => void;
  moveLine: (lineId: string, toTier: Tier) => void;

  normalizeTier: (tier: Tier) => void;
  spreadTier: (tier: Tier) => void;
  applyRatio: (tier: Tier, ratios: Record<string, number>) => void;
  retargetTier: (tier: Tier, target: number) => void;
  setPyramid: (pyramid: Pyramid) => void;
  setBatchG: (batchG: number) => void;
  setPriceTierOverride: (tier: number | null) => void;

  undo: () => void;
  markSaved: () => void;
  clearHighlight: () => void;
};

const MAX_UNDO = 20;

const snapshot = (s: EditorState): EditorSnapshot => ({
  lines: s.lines,
  pyramid: s.pyramid,
  batchG: s.batchG,
  priceTierOverride: s.priceTierOverride,
});

/** Target tier: dari piramida, atau 100 kalau mode piramida mati. */
export function targetOf(pyramid: Pyramid | null, tier: Tier): number {
  if (!pyramid) return 100;
  if (tier === "top") return pyramid.top;
  if (tier === "mid") return pyramid.mid;
  if (tier === "base") return pyramid.base;
  return 100;
}

const linesOf = (lines: Line[], tier: Tier) =>
  lines.filter((l) => l.tier === tier);

/** Menyusun ulang daftar lengkap setelah satu tier dihitung ulang. */
const replaceTier = (lines: Line[], tier: Tier, next: Line[]): Line[] => [
  ...lines.filter((l) => l.tier !== tier),
  ...next,
];

/** Baris mana yang angkanya berubah — dipakai untuk sorotan kuning sesaat. */
function changedIds(before: Line[], after: Line[]): string[] {
  const prev = new Map(before.map((l) => [l.id, l.pct]));
  return after
    .filter((l) => prev.has(l.id) && prev.get(l.id) !== l.pct)
    .map((l) => l.id);
}

export const useEditorStore = create<EditorState>((set, get) => {
  /** Satu pintu untuk tiap perubahan: catat undo, tandai dirty, sorot yang berubah. */
  const commit = (
    producer: (state: EditorState) => Partial<EditorSnapshot>,
    opts: { highlight?: boolean } = {},
  ) =>
    set((state) => {
      const before = state.lines;
      const patch = producer(state);
      const after = patch.lines ?? state.lines;
      return {
        ...patch,
        dirty: true,
        past: [...state.past, snapshot(state)].slice(-MAX_UNDO),
        highlighted: opts.highlight === false ? [] : changedIds(before, after),
      };
    });

  return {
    versionId: "",
    formulaId: "",
    pyramidMode: true,
    lines: [],
    pyramid: null,
    batchG: 10,
    priceTierOverride: null,
    dirty: false,
    savedAt: null,
    past: [],
    highlighted: [],

    init: (input) =>
      set({
        ...input,
        dirty: false,
        savedAt: Date.now(),
        past: [],
        highlighted: [],
      }),

    addLine: (tier, line) =>
      commit((s) => {
        const next = allocAdd(
          linesOf(s.lines, tier),
          { ...line, tier, pct: 0, locked: false } as Line,
          targetOf(s.pyramid, tier),
        );
        return { lines: replaceTier(s.lines, tier, next) };
      }),

    editPct: (lineId, pct) =>
      commit((s) => {
        const line = s.lines.find((l) => l.id === lineId);
        if (!line) return {};
        const next = editLinePct(
          linesOf(s.lines, line.tier),
          lineId,
          pct,
          targetOf(s.pyramid, line.tier),
        );
        return { lines: replaceTier(s.lines, line.tier, next) };
      }),

    toggleLock: (lineId) =>
      commit((s) => {
        const line = s.lines.find((l) => l.id === lineId);
        if (!line) return {};
        const next = allocSetLocked(
          linesOf(s.lines, line.tier),
          lineId,
          !line.locked,
          targetOf(s.pyramid, line.tier),
        );
        return { lines: replaceTier(s.lines, line.tier, next) };
      }),

    removeLine: (lineId) =>
      commit((s) => {
        const line = s.lines.find((l) => l.id === lineId);
        if (!line) return {};
        const next = allocRemove(
          linesOf(s.lines, line.tier),
          lineId,
          targetOf(s.pyramid, line.tier),
        );
        return { lines: replaceTier(s.lines, line.tier, next) };
      }),

    // Dilusi tidak mengubah persen timbang sama sekali — dia cuma mengubah
    // berapa bagian baris itu yang benar-benar bahan aktif.
    setDilution: (lineId, userDilutionPct, userSolventId) =>
      commit(
        (s) => ({
          lines: s.lines.map((l) =>
            l.id === lineId
              ? {
                  ...l,
                  userDilutionPct,
                  userSolventId: userDilutionPct >= 100 ? null : userSolventId,
                }
              : l,
          ),
        }),
        { highlight: false },
      ),

    moveLine: (lineId, toTier) =>
      commit((s) => {
        const line = s.lines.find((l) => l.id === lineId);
        if (!line || line.tier === toTier) return {};
        const moved = allocMove(
          linesOf(s.lines, line.tier),
          linesOf(s.lines, toTier),
          lineId,
          targetOf(s.pyramid, line.tier),
          targetOf(s.pyramid, toTier),
          toTier,
        );
        return {
          lines: replaceTier(
            replaceTier(s.lines, line.tier, moved.from),
            toTier,
            moved.to,
          ),
        };
      }),

    normalizeTier: (tier) =>
      commit((s) => ({
        lines: replaceTier(
          s.lines,
          tier,
          allocNormalize(linesOf(s.lines, tier), targetOf(s.pyramid, tier)),
        ),
      })),

    spreadTier: (tier) =>
      commit((s) => ({
        lines: replaceTier(
          s.lines,
          tier,
          spreadEven(linesOf(s.lines, tier), targetOf(s.pyramid, tier)),
        ),
      })),

    applyRatio: (tier, ratios) =>
      commit((s) => ({
        lines: replaceTier(
          s.lines,
          tier,
          allocRatio(linesOf(s.lines, tier), ratios, targetOf(s.pyramid, tier)),
        ),
      })),

    /**
     * Mengubah target satu tier menskalakan seluruh barisnya. Total piramida
     * jadi tidak 100% — itu disengaja: banner merah di header yang memberi
     * tahu, bukan store yang diam-diam membetulkan tier lain.
     */
    retargetTier: (tier, target) =>
      commit((s) => {
        if (!s.pyramid) return {};
        const old = targetOf(s.pyramid, tier);
        const next = scaleTier(linesOf(s.lines, tier), old, target);
        return {
          pyramid: { ...s.pyramid, [tier]: round5(target) } as Pyramid,
          lines: replaceTier(s.lines, tier, next),
        };
      }),

    setPyramid: (pyramid) =>
      commit((s) => {
        let lines = s.lines;
        for (const tier of ["top", "mid", "base"] as Tier[]) {
          const old = targetOf(s.pyramid, tier);
          const next = targetOf(pyramid, tier);
          if (old === next) continue;
          lines = replaceTier(
            lines,
            tier,
            scaleTier(linesOf(lines, tier), old, next),
          );
        }
        return { pyramid, lines };
      }),

    // Ukuran batch tidak menyentuh persen — cuma gram dan harga yang berubah.
    setBatchG: (batchG) =>
      commit(() => ({ batchG }), { highlight: false }),

    setPriceTierOverride: (priceTierOverride) =>
      commit(() => ({ priceTierOverride }), { highlight: false }),

    undo: () =>
      set((s) => {
        const prev = s.past.at(-1);
        if (!prev) return s;
        return {
          ...prev,
          past: s.past.slice(0, -1),
          dirty: true,
          highlighted: [],
        };
      }),

    markSaved: () => set({ dirty: false, savedAt: Date.now() }),
    clearHighlight: () => set({ highlighted: [] }),
  };
});

/** Status satu tier, untuk badge di header kartu. */
export function tierSummary(lines: Line[], pyramid: Pyramid | null, tier: Tier) {
  const target = targetOf(pyramid, tier);
  const rows = linesOf(lines, tier);
  const filled = round5(rows.reduce((a, l) => a + l.pct, 0));
  const diff = round5(filled - target);
  return { target, filled, diff, ok: Math.abs(diff) <= 0.01, count: rows.length };
}

/** Semua baris dalam satu tier, urut sesuai urutan masuk. */
export const tierLines = (lines: Line[], tier: Tier) =>
  lines.filter((l) => l.tier === tier);

export { allocateTier };
