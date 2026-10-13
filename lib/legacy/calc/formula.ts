import type {
  CalcLine,
  CalcRow,
  FormulaResult,
  FunctionCategory,
} from "./types";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** berat_murni = berat_timbang × dilution_pct / 100 */
export function neatWeight(line: CalcLine): number {
  return line.weightG * (line.dilutionPct / 100);
}

/**
 * Impact agregat sebuah sub-formula: rata-rata impact penyusunnya,
 * ditimbang oleh berat MURNI masing-masing.
 *
 *   impact_agregat(S) = Σ(berat_murni_i × impact_i) / Σ(berat_murni_i)
 *
 * Rumus ini yang membuat sebuah formula berisi sub-formula menghasilkan
 * % kekuatan yang identik dengan formula sama yang ditulis datar.
 * Nilainya tidak berubah kalau seluruh berat diskalakan — jadi subLines
 * boleh disimpan pada berat resepnya sendiri.
 *
 * Mengembalikan null kalau ada penyusun yang impact-nya belum ada, atau
 * kalau sub-formula itu sendiri mengandung FO. Jangan pernah mengembalikan 0
 * untuk data yang kosong.
 */
export function aggregateImpact(sub: CalcLine[]): number | null {
  if (!sub.length) return null;
  // Sub-formula yang di dalamnya ada FO tidak bisa diberi satu nilai impact,
  // dengan alasan yang sama seperti FO itu sendiri.
  if (sub.some((l) => l.lineType === "fo")) return null;

  const parts = sub.map((l) => ({
    neat: neatWeight(l),
    impact:
      l.lineType === "sub_formula"
        ? aggregateImpact(l.subLines ?? [])
        : (l.impact ?? null),
  }));

  if (parts.some((p) => p.impact == null)) return null;
  const totalNeat = sum(parts.map((p) => p.neat));
  if (totalNeat <= 0) return null;

  return sum(parts.map((p) => p.neat * p.impact!)) / totalNeat;
}

/** impact yang dipakai untuk menilai sebuah baris. null = tidak bisa dinilai. */
export function impactOf(line: CalcLine): number | null {
  if (line.lineType === "fo") return null; // FO tidak punya nilai impact tunggal
  if (line.lineType === "sub_formula") return aggregateImpact(line.subLines ?? []);
  return line.impact ?? null;
}

const EMPTY_FUNCTION_SHARES: Record<FunctionCategory, number> = {
  diffuser: 0,
  modifier: 0,
  bridger: 0,
  fixative: 0,
};

/**
 * Inti aplikasi. Menghitung berat murni, persen berat, persen murni,
 * dan % kekuatan tiap baris — plus metadata yang dibutuhkan rules checker.
 *
 * Dua aturan yang tidak boleh dilanggar:
 *  1. Baris FO dikeluarkan dari % kekuatan, TAPI tetap dihitung berat & biayanya.
 *     FO bukan impact 0 — menambah FO tidak boleh menurunkan % kekuatan bahan lain.
 *  2. Impact kosong tidak dianggap nol. Barisnya dikeluarkan dari penilaian dan
 *     namanya dilaporkan di `missingImpact`.
 *
 * Untuk donut kategori fungsi dan rules checker, panggil fungsi ini pada hasil
 * expandLines() — bukan pada daftar baris mentah.
 */
export function computeFormula(lines: CalcLine[]): FormulaResult {
  const weighedTotal = sum(lines.map((l) => l.weightG));
  const neat = lines.map(neatWeight);
  const neatTotal = sum(neat);

  const impacts = lines.map(impactOf);

  // Indeks baris yang bisa dinilai kekuatannya.
  const scorable = lines
    .map((_, i) => i)
    .filter((i) => impacts[i] != null && neat[i] > 0);

  // Basis persen dihitung ULANG hanya dari bagian yang bisa dinilai, supaya
  // % kekuatan tetap berjumlah 100 dan tidak terdilusi oleh bagian FO.
  const scorableNeat = sum(scorable.map((i) => neat[i]));
  const contrib = new Map<number, number>();
  scorable.forEach((i) => contrib.set(i, neat[i] * impacts[i]!));
  const contribTotal = sum([...contrib.values()]);

  const rows: CalcRow[] = lines.map((l, i) => {
    const c = contrib.get(i);
    const price = l.pricePerGram ?? null;
    return {
      ...l,
      neatWeightG: neat[i],
      weightPct: weighedTotal ? (l.weightG / weighedTotal) * 100 : 0,
      neatPct: neatTotal ? (neat[i] / neatTotal) * 100 : 0,
      strengthPct:
        c == null ? null : contribTotal ? (c / contribTotal) * 100 : 0,
      effectiveImpact: impacts[i],
      impactIsAggregate: l.lineType === "sub_formula" && impacts[i] != null,
      // Biaya memakai berat MURNI — bukan berat timbang.
      costIdr: price == null ? null : neat[i] * price,
    };
  });

  const foRows = rows.filter((r) => r.lineType === "fo");
  const foNeat = sum(foRows.map((r) => r.neatWeightG));

  const missingImpact = lines
    .filter((l) => l.lineType !== "fo" && impactOf(l) == null)
    .map((l) => l.label);

  const missingPrice = rows.filter((r) => r.costIdr == null).map((r) => r.label);
  const costIdr = missingPrice.length
    ? null
    : sum(rows.map((r) => r.costIdr ?? 0));

  const functionShares = { ...EMPTY_FUNCTION_SHARES };
  for (const r of rows) {
    if (r.strengthPct == null) continue;
    if (!r.functionCategory) continue;
    functionShares[r.functionCategory] += r.strengthPct;
  }

  const scored = rows.filter((r) => r.strengthPct != null);
  const lead = scored.length
    ? scored.reduce((best, r) => (r.strengthPct! > best.strengthPct! ? r : best))
    : null;

  const foShares = foRows
    .map((r) => ({
      label: r.label,
      share: neatTotal ? (r.neatWeightG / neatTotal) * 100 : 0,
      family: r.foFamily ?? null,
    }))
    .sort((a, b) => b.share - a.share);

  return {
    rows,
    totals: {
      weighedG: weighedTotal,
      neatG: neatTotal,
      costIdr,
      costPerGram: costIdr == null || !neatTotal ? null : costIdr / neatTotal,
      missingPrice,
    },

    strengthBasis: neatTotal ? (scorableNeat / neatTotal) * 100 : 0,
    foNeatShare: neatTotal ? (foNeat / neatTotal) * 100 : 0,
    hasFO: foRows.length > 0,
    foCount: foRows.length,
    foFamilies: foRows.map((r) => r.foFamily ?? "").filter(Boolean),
    foShares,

    strengthComplete: missingImpact.length === 0 && foRows.length === 0,
    missingImpact,

    functionShares,
    lead: lead ? { label: lead.label, share: lead.strengthPct! } : null,
  };
}
