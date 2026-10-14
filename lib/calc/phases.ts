import { aromaShares } from "./aroma";
import { strengthOf } from "./strength";
import type { ExpandedItem, FormulaContext, Tier } from "./types";

export type PhaseKey = "opening" | "heart" | "drydown";
type PyramidTier = Exclude<Tier, "all">;

/**
 * Seberapa hadir tiap tier di tiap fase, relatif terhadap kekuatannya sendiri.
 *
 * INI PENDEKATAN, bukan pengukuran. Yang sebenarnya menentukan adalah tekanan
 * uap tiap molekul, dan pricelist tidak membawa data itu. Yang dipakai di sini
 * adalah pengetahuan umum perfumery yang sudah tersirat di tier:
 *
 *  - Semua bahan ada di udara sejak semprotan pertama. Base tidak "muncul
 *    belakangan" — dia sudah ada, cuma tertutup. Karena itu Base di Opening
 *    tidak nol.
 *  - Top menipis cepat (15–30 menit) dan nyaris habis di Heart.
 *  - Mid menipis dalam hitungan jam; masih tersisa sedikit di Drydown.
 *
 * Angka absolutnya tidak penting — yang dibaca adalah porsi relatif di dalam
 * satu fase, dan urutan antar fase.
 */
export const PHASE_PRESENCE: Record<PhaseKey, Record<PyramidTier, number>> = {
  opening: { top: 1, mid: 0.6, base: 0.3 },
  heart: { top: 0.15, mid: 1, base: 0.6 },
  drydown: { top: 0, mid: 0.2, base: 1 },
};

export const PHASE_META: Record<PhaseKey, { label: string; when: string }> = {
  opening: { label: "Opening", when: "0–30 menit" },
  heart: { label: "Heart", when: "30 menit – 3 jam" },
  drydown: { label: "Drydown", when: "3 jam ke atas" },
};

export const PHASES: PhaseKey[] = ["opening", "heart", "drydown"];

export type PhaseRow = {
  refId: string;
  name: string;
  tier: PyramidTier;
  /** porsi kekuatan bahan ini DI DALAM fase ini */
  pct: number;
};

export type Phase = {
  key: PhaseKey;
  /** porsi tiap tier di fase ini, jumlahnya 100 */
  tiers: Record<PyramidTier, number>;
  rows: PhaseRow[];
  /** facet terbesar di fase ini — profil yang kemungkinan tercium */
  facets: { facet: string; pct: number }[];
  notes: string[];
};

export type PhaseReport = {
  phases: Phase[];
  /** false = mode piramida mati; tier diambil dari kebiasaan bahannya */
  fromPyramid: boolean;
};

/**
 * Batas yang memicu catatan. Diambil longgar sengaja: ini pendekatan, dan
 * catatan yang terlalu sering muncul berhenti dibaca.
 */
const BASE_LOUD_IN_OPENING = 25;
const TOP_QUIET_IN_OPENING = 30;
const MID_LOUD_IN_DRYDOWN = 40;

/**
 * Tier yang dipakai untuk menghitung penguapan satu item.
 *
 * Saat piramida aktif, tier baris dipakai: itu klasifikasi yang user pilih dan
 * bisa dia koreksi, sama dengan yang dipakai pie aroma per tier. Tanpa
 * piramida, kebiasaan bahannya yang dipakai, dan Mid kalau itu pun kosong.
 */
function tierOf(item: ExpandedItem, ctx: FormulaContext): PyramidTier {
  if (item.tier !== "all") return item.tier;
  const hint = ctx.materials.get(item.refId)?.noteTierHint;
  return hint && hint !== "all" ? hint : "mid";
}

/**
 * Kekuatan per fase: siapa yang paling keras di Opening, Heart, dan Drydown.
 *
 * Tab Kekuatan biasa memberi satu angka per bahan untuk seluruh umur parfum.
 * Pertanyaan yang sering muncul justru per fase — "mangganya kecium duluan
 * nggak?", "kayunya udah kecium dari awal?" — dan satu angka tidak bisa
 * menjawabnya.
 */
export function phaseReport(
  ctx: FormulaContext,
  items: ExpandedItem[],
): PhaseReport {
  const phases = PHASES.map((key): Phase => {
    const presence = PHASE_PRESENCE[key];
    const byRef = new Map<string, PhaseRow>();
    const tiers: Record<PyramidTier, number> = { top: 0, mid: 0, base: 0 };
    // Item yang kekuatannya sudah diskalakan ke fase ini, untuk profil facet.
    const scaled: ExpandedItem[] = [];
    let total = 0;

    for (const item of items) {
      if (item.kind !== "material") continue;
      const material = ctx.materials.get(item.refId);
      if (!material || material.isSolvent) continue;

      const tier = tierOf(item, ctx);
      const w = presence[tier];
      const s = strengthOf(item, material) * w;
      if (s <= 0) continue;

      total += s;
      tiers[tier] += s;
      scaled.push({ ...item, strengthBasisPct: item.strengthBasisPct * w });

      const row = byRef.get(item.refId);
      if (row) row.pct += s;
      else byRef.set(item.refId, { refId: item.refId, name: material.name, tier, pct: s });
    }

    const pct = (v: number) => (total ? (v / total) * 100 : 0);
    const tierPct = {
      top: pct(tiers.top),
      mid: pct(tiers.mid),
      base: pct(tiers.base),
    };

    const notes: string[] = [];
    if (total > 0 && key === "opening") {
      if (tierPct.base >= BASE_LOUD_IN_OPENING) {
        notes.push(
          `Base sudah ${Math.round(tierPct.base)}% di pembukaan — kemungkinan sudah tercium dari semprotan pertama.`,
        );
      }
      if (tiers.top > 0 && tierPct.top < TOP_QUIET_IN_OPENING) {
        notes.push(
          `Top cuma ${Math.round(tierPct.top)}% di pembukaan — kesan pertamanya kemungkinan dibawa Mid, bukan Top.`,
        );
      }
    }
    if (total > 0 && key === "drydown" && tierPct.mid >= MID_LOUD_IN_DRYDOWN) {
      notes.push(
        `Mid masih ${Math.round(tierPct.mid)}% di drydown — jantungnya kemungkinan bertahan lebih lama dari yang dibayangkan.`,
      );
    }

    return {
      key,
      tiers: tierPct,
      rows: [...byRef.values()]
        .map((r) => ({ ...r, pct: pct(r.pct) }))
        .sort((a, b) => b.pct - a.pct),
      facets: aromaShares(scaled, ctx.materials)
        .slice(0, 3)
        .map((s) => ({ facet: s.facet, pct: s.pct })),
      notes,
    };
  });

  return { phases, fromPyramid: ctx.version.pyramid != null };
}
