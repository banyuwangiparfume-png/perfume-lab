import type {
  EvalMediumEnum,
  EvalPurposeEnum,
  FormulaSourceEnum,
  FormulaTypeEnum,
  FunctionCategoryEnum,
  TransitionVerdictEnum,
  VersionStatusEnum,
} from "./supabase/database.types";

/**
 * Antarmuka berbahasa Indonesia kasual, tapi istilah teknis perfumery tetap
 * bahasa Inggris (Fixative, Bridger, Diffuser, Modifier, accord, drydown,
 * sillage) karena itu yang dipakai di literatur dan katalog supplier.
 */

export const FORMULA_TYPES: { value: FormulaTypeEnum; label: string }[] = [
  { value: "accord", label: "Accord" },
  { value: "base", label: "Base" },
  { value: "booster", label: "Booster" },
  { value: "full_perfume", label: "Parfum utuh" },
  { value: "experiment", label: "Eksperimen" },
];

export const FORMULA_SOURCES: { value: FormulaSourceEnum; label: string }[] = [
  { value: "own", label: "Buatan sendiri" },
  { value: "ecofragrantica", label: "Ecofragrantica" },
  { value: "kurdlab", label: "Kurdlab" },
  { value: "other", label: "Lainnya" },
];

export const TARGET_CATEGORIES = [
  "Floral",
  "Woody",
  "Oriental",
  "Fresh",
  "Gourmand",
  "Spicy",
] as const;

export const FO_FAMILIES = [
  "Woody",
  "Oriental",
  "Floral",
  "Fresh",
  "Gourmand",
  "Tobacco",
] as const;

export const VERSION_STATUSES: {
  value: VersionStatusEnum;
  label: string;
  hint: string;
}[] = [
  { value: "draft", label: "Draft", hint: "Masih disusun, belum diracik." },
  { value: "mixed", label: "Sudah dicampur", hint: "Sudah diracik, menunggu dinilai." },
  { value: "evaluated", label: "Sudah dinilai", hint: "Sudah ada catatan penciuman. Barisnya tidak bisa diubah lagi." },
  { value: "locked", label: "Dikunci", hint: "Dibekukan sengaja. Duplikat kalau mau diubah." },
];


/** Label status versi. Ditaruh di sini, bukan di lib/data/, supaya client
 *  component bisa memakainya tanpa menarik koneksi database ke bundle. */
export const STATUS_LABELS: Record<VersionStatusEnum, string> = Object.fromEntries(
  VERSION_STATUSES.map((s) => [s.value, s.label]),
) as Record<VersionStatusEnum, string>;

export const FUNCTION_CATEGORIES: {
  value: FunctionCategoryEnum;
  label: string;
  /** rentang impact khas di sistem Ecofragrantica / Perfumers World ABC's */
  range: string;
  meaning: string;
}[] = [
  {
    value: "diffuser",
    label: "Diffuser",
    range: "110–500",
    meaning: "kuat, mendorong keluar",
  },
  {
    value: "modifier",
    label: "Modifier",
    range: "36–4000",
    meaning: "rentang sangat lebar, pembentuk karakter",
  },
  {
    value: "bridger",
    label: "Bridger",
    range: "selalu 100",
    meaning: "titik acuan — penyambung antar bagian",
  },
  {
    value: "fixative",
    label: "Fixative",
    range: "3–98",
    meaning: "lemah per gram, tapi bertahan lama",
  },
];

/** Warna kategori fungsi — harus konsisten di seluruh aplikasi. */
export const FUNCTION_COLORS: Record<FunctionCategoryEnum, string> = {
  diffuser: "var(--fn-diffuser)",
  modifier: "var(--fn-modifier)",
  bridger: "var(--fn-bridger)",
  fixative: "var(--fn-fixative)",
};

export const FUNCTION_LABELS: Record<FunctionCategoryEnum, string> = {
  diffuser: "Diffuser",
  modifier: "Modifier",
  bridger: "Bridger",
  fixative: "Fixative",
};

export const EVAL_MEDIA: { value: EvalMediumEnum; label: string }[] = [
  { value: "blotter", label: "Blotter" },
  { value: "skin", label: "Kulit" },
  { value: "fabric", label: "Kain" },
];

export const EVAL_PURPOSES: {
  value: EvalPurposeEnum;
  label: string;
  hint: string;
}[] = [
  {
    value: "screening",
    label: "Screening",
    hint: "Menyaring kandidat. Oil rest 24 jam, encerkan, cium setelah ~48 jam. Syarat sahnya: semua sampel diperlakukan identik.",
  },
  {
    value: "final",
    label: "Final",
    hint: "Memutuskan produk siap dijual. Setelah maserasi penuh 2-4 minggu, kondisinya sama dengan yang diterima pembeli.",
  },
];

export const TRANSITION_VERDICTS: {
  value: TransitionVerdictEnum;
  label: string;
}[] = [
  { value: "smooth", label: "Transisi terasa mulus" },
  { value: "broken", label: "Terasa patah" },
  { value: "muddy", label: "Terasa bubur" },
];

/** Titik waktu bawaan form evaluasi. */
export const TIMELINE_PRESETS = [
  { minutes: 5, label: "5 menit" },
  { minutes: 30, label: "30 menit" },
  { minutes: 60, label: "1 jam" },
  { minutes: 180, label: "3 jam" },
  { minutes: 360, label: "6 jam" },
] as const;

export function minutesLabel(minutes: number): string {
  const preset = TIMELINE_PRESETS.find((p) => p.minutes === minutes);
  if (preset) return preset.label;
  if (minutes < 60) return `${minutes} menit`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} jam` : `${minutes} menit`;
}

/** Pilihan dilusi di editor. */
export const DILUTION_PRESETS = [100, 50, 25, 10, 5, 1] as const;

export const SOLVENTS = ["DPG", "TEC", "IPM", "Ethanol", "Jojoba"] as const;

export const PRICING = {
  /**
   * Tier yang dipakai menghitung harga per gram: tier terbesar yang realistis
   * dibeli. Ini SETTING, bukan kebenaran — nanti pindahkan ke preferensi user
   * kalau kebiasaan belanjanya berubah.
   */
  preferredTierG: 500,
} as const;
