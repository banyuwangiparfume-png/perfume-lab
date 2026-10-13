/**
 * Satu tempat untuk SEMUA angka ambang rules checker.
 *
 * Angka-angka ini tebakan awal, bukan kebenaran. Setelah ada 20–30 formula
 * dengan catatan penciuman, cek korelasinya: apakah formula yang dinilai
 * "bubur" di evaluasi memang yang melanggar Rule 3? Kalau tidak, ambangnya
 * yang salah — bukan usernya. Kalibrasi di sini, jangan tersebar di kode.
 */
export const T = {
  maxMaterials: 12,
  minFixativeShare: 15,
  maxPushShare: 85, // diffuser + modifier
  minLeadShare: 20,
  maxLeadShare: 60,
  swallowRatio: 3,
  swallowMinShare: 25,
  negligibleShare: 1,
  minFamiliesForBridgeCheck: 3,

  // FO
  minFoShare: 85, // Rule 6 — di bawah ini karakter FO mulai tertutup
  foLeadShare: 70, // Rule 7 — kalau ada 2 FO, salah satu harus sebesar ini
  foHiddenMaterials: 40, // perkiraan jumlah bahan di dalam 1 FO, untuk Rule 1

  /**
   * Kedalaman maksimal sarang formula, ROOT IKUT DIHITUNG.
   * 1 = formula datar · 2 = formula memakai accord · 3 = accord yang memakai accord.
   * Lebih dalam dari ini formula jadi tidak bisa dibaca manusia.
   */
  maxSubFormulaDepth: 3,

  // --- protokol lab ---
  /** oil phase rest sebelum boleh diencerkan dengan ethanol */
  minOilRestHours: 24,
  /** jeda setelah diencerkan sebelum screening masuk akal dilakukan */
  minScreeningHours: 48,
  /** maserasi penuh sebelum sebuah penilaian pantas disebut final */
  minMacerationDays: 14,
  /** Rule 8 — selisih umur maserasi yang membuat compare tidak sah */
  macerationGapDays: 7,
} as const;
