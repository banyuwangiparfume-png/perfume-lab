import { strengthOf } from "./strength";
import type { ExpandedItem, FormulaContext, Tier } from "./types";

/**
 * Perkiraan SPL — Sillage, Projection, Longevity — dari susunan formula.
 *
 * INI BUKAN PENGUKURAN. SPL sebenarnya ditentukan konsentrasi di botol (EDT
 * vs EDP), kulit, suhu, dan tekanan uap tiap molekul — tidak satu pun dari
 * itu ada di data aplikasi ini. Yang bisa dibaca dari formula hanyalah
 * KECENDERUNGAN susunannya: seberapa banyak kekuatan dibawa penguat
 * proyeksi, seberapa banyak ditahan fixative, seberapa tebal dasar yang
 * menguap paling lambat.
 *
 * Karena itu skornya hanya bermakna untuk MEMBANDINGKAN formula satu sama
 * lain pada konsentrasi yang sama — "v3 kemungkinan lebih tahan lama dari
 * v2" — bukan "parfum ini tahan 8 jam". Setiap faktor dilaporkan terpisah
 * supaya kelihatan dari mana angkanya, dan bisa dibantah.
 */

export type SplKey = "sillage" | "projection" | "longevity";

export type SplFactor = {
  key: "intensity" | "diffuser" | "lateDiffuser" | "fixative" | "baseActive";
  label: string;
  /** nilai mentahnya, untuk ditampilkan */
  value: number;
  unit: "%" | "impact";
  /** 0..1 setelah dibandingkan dengan patokannya */
  score: number;
  /** patokan yang dianggap "penuh" */
  fullAt: number;
  feeds: SplKey[];
  meaning: string;
};

export type SplScore = Record<SplKey, number> & {
  factors: SplFactor[];
  /** % kekuatan dari bahan yang perannya cuma ditebak dari family */
  derivedRolePct: number;
  /** % kekuatan dari bahan tanpa data impact (dihitung 100) */
  missingImpactPct: number;
  notes: string[];
};

/**
 * Patokan dan bobot. Dikumpulkan di satu tempat karena inilah bagian yang
 * paling bisa diperdebatkan — dan yang paling mungkin perlu disetel ulang
 * setelah skornya dibandingkan dengan hidung.
 */
export const SPL_CONFIG = {
  full: {
    /** rata-rata impact per 1% konsentrat */
    intensity: 250,
    /** % kekuatan dari diffuser */
    diffuser: 15,
    /** % kekuatan dari diffuser yang menguap lambat (mid/base) */
    lateDiffuser: 10,
    /** % kekuatan dari fixative */
    fixative: 25,
    /** % formula yang jadi bahan aktif di Base */
    baseActive: 45,
  },
  weights: {
    projection: { diffuser: 0.55, intensity: 0.45 },
    sillage: { lateDiffuser: 0.4, fixative: 0.3, intensity: 0.3 },
    longevity: { fixative: 0.45, baseActive: 0.4, intensity: 0.15 },
  },
  /** di atas ini, catatan soal data yang masih tebakan ditampilkan */
  derivedWarnPct: 30,
  missingImpactWarnPct: 20,
} as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function splScore(ctx: FormulaContext, items: ExpandedItem[]): SplScore {
  const tierOf = (item: ExpandedItem): Tier => {
    if (item.tier !== "all") return item.tier;
    const hint = ctx.materials.get(item.refId)?.noteTierHint;
    return hint && hint !== "all" ? hint : "mid";
  };

  let totalPct = 0;
  let totalStrength = 0;
  let diffuser = 0;
  let lateDiffuser = 0;
  let fixative = 0;
  let derived = 0;
  let missingImpact = 0;
  let baseActive = 0;

  for (const item of items) {
    totalPct += item.productPct;
    if (item.kind !== "material") continue;
    const m = ctx.materials.get(item.refId);
    if (!m) continue;

    if (!m.isSolvent && tierOf(item) === "base") baseActive += item.activePct;

    const s = strengthOf(item, m);
    if (s <= 0) continue;
    totalStrength += s;
    if (m.impact == null) missingImpact += s;

    const role = (m.functionCategory ?? "").toLowerCase();
    if (m.functionSource === "derived" && role) derived += s;
    if (role === "diffuser") {
      diffuser += s;
      if (tierOf(item) !== "top") lateDiffuser += s;
    } else if (role === "fixative") {
      fixative += s;
    }
  }

  const share = (v: number) => (totalStrength ? (v / totalStrength) * 100 : 0);
  // Pelarut ikut di penyebut: formula yang setengahnya TEC memang lebih
  // lemah per tetes, dan itu yang ingin terlihat di sini.
  const intensity = totalPct ? totalStrength / totalPct : 0;

  const F = SPL_CONFIG.full;
  const factors: SplFactor[] = [
    {
      key: "intensity",
      label: "Intensitas",
      value: intensity,
      unit: "impact",
      score: clamp01(intensity / F.intensity),
      fullAt: F.intensity,
      feeds: ["projection", "sillage", "longevity"],
      meaning: "Rata-rata daya pukul per 1% konsentrat. Pelarut menariknya turun.",
    },
    {
      key: "diffuser",
      label: "Diffuser",
      value: share(diffuser),
      unit: "%",
      score: clamp01(share(diffuser) / F.diffuser),
      fullAt: F.diffuser,
      feeds: ["projection"],
      meaning: "Porsi kekuatan dari penguat proyeksi.",
    },
    {
      key: "lateDiffuser",
      label: "Diffuser Mid/Base",
      value: share(lateDiffuser),
      unit: "%",
      score: clamp01(share(lateDiffuser) / F.lateDiffuser),
      fullAt: F.lateDiffuser,
      feeds: ["sillage"],
      meaning: "Penguat yang masih ada di udara setelah Top habis — yang meninggalkan jejak.",
    },
    {
      key: "fixative",
      label: "Fixative",
      value: share(fixative),
      unit: "%",
      score: clamp01(share(fixative) / F.fixative),
      fullAt: F.fixative,
      feeds: ["sillage", "longevity"],
      meaning: "Porsi kekuatan dari penahan.",
    },
    {
      key: "baseActive",
      label: "Base aktif",
      value: baseActive,
      unit: "%",
      score: clamp01(baseActive / F.baseActive),
      fullAt: F.baseActive,
      feeds: ["longevity"],
      meaning: "Bahan aktif di lapisan yang paling lambat menguap, setelah pelarut dikeluarkan.",
    },
  ];

  const scoreOf = (key: SplKey) => {
    const w = SPL_CONFIG.weights[key] as Record<string, number>;
    let s = 0;
    for (const f of factors) s += (w[f.key] ?? 0) * f.score;
    return round1(s * 10);
  };

  const derivedRolePct = share(derived);
  const missingImpactPct = share(missingImpact);
  const notes: string[] = [];
  if (derivedRolePct >= SPL_CONFIG.derivedWarnPct) {
    notes.push(
      `${Math.round(derivedRolePct)}% kekuatan datang dari bahan yang perannya cuma ditebak dari family — koreksi perannya di detail bahan supaya skornya lebih bisa dipegang.`,
    );
  }
  if (missingImpactPct >= SPL_CONFIG.missingImpactWarnPct) {
    notes.push(
      `${Math.round(missingImpactPct)}% kekuatan datang dari bahan tanpa data impact, yang dihitung 100.`,
    );
  }

  return {
    sillage: scoreOf("sillage"),
    projection: scoreOf("projection"),
    longevity: scoreOf("longevity"),
    factors,
    derivedRolePct,
    missingImpactPct,
    notes,
  };
}
