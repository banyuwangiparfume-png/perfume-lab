import type { Settings } from "./calc/types";

/**
 * Nilai bawaan `app_settings.settings`. Semua ambang di aplikasi berasal dari
 * sini, bukan ditulis tersebar — supaya gampang dikalibrasi lewat
 * /admin/settings setelah dipakai beberapa minggu.
 */
export const DEFAULT_SETTINGS: Settings = {
  /**
   * Tier harga dipilih dari ukuran batch: aturan PERTAMA yang cocok menang.
   * 3 g -> 10 · 30 g -> 10 · 60 g -> 50 · 120 g -> 100 · 600 g -> 500
   *
   * Tier 5 g sengaja tidak pernah jadi pilihan default: beli 5 g untuk batch
   * nyata tidak realistis, dan harga per gramnya paling mahal.
   */
  priceTierRules: [
    { maxBatchExclusive: 50, tier: 10 },
    { maxBatchExclusive: 100, tier: 50 },
    { maxBatchExclusive: 500, tier: 100 },
    { maxBatchExclusive: null, tier: 500 },
  ],
  bridgeThresholds: { connected: 0.45, loose: 0.2 },
  solventWarn: { singlePct: 10, totalPct: 25 },
  dominance: { minStrengthPct: 20, ratio: 3 },
  supplierSolventTokens: {
    TEC: null,
    BB: null,
    DPG: null,
    IPM: null,
    ETHA: null,
    ETHANOL: null,
    CASTOR: null,
  },
};

export function mergeSettings(patch: Partial<Settings> | null): Settings {
  if (!patch) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...patch,
    bridgeThresholds: {
      ...DEFAULT_SETTINGS.bridgeThresholds,
      ...patch.bridgeThresholds,
    },
    solventWarn: { ...DEFAULT_SETTINGS.solventWarn, ...patch.solventWarn },
    dominance: { ...DEFAULT_SETTINGS.dominance, ...patch.dominance },
    supplierSolventTokens: {
      ...DEFAULT_SETTINGS.supplierSolventTokens,
      ...patch.supplierSolventTokens,
    },
  };
}
