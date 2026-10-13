import type { CalcLine } from "./types";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function round(n: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Menskalakan seluruh baris ke total berat timbang `targetG`.
 *
 * Yang diskalakan adalah berat TIMBANG, karena itu yang dibaca user saat
 * meracik. Dilusi tidak disentuh — mengubah dilusi akan mengubah formulanya,
 * bukan menskalakannya.
 *
 * Dibulatkan ke 3 desimal (batas timbangan lab 0,001 g), jadi total hasil bisa
 * selisih beberapa miligram dari target. Itu disengaja: lebih baik angka yang
 * benar-benar bisa ditimbang daripada angka presisi yang tidak bisa dieksekusi.
 */
export function scaleTo(
  lines: CalcLine[],
  targetG: number,
  decimals = 3,
): CalcLine[] {
  const total = sum(lines.map((l) => l.weightG));
  if (total <= 0 || targetG <= 0) return lines;
  const factor = targetG / total;
  return lines.map((l) => ({
    ...l,
    weightG: round(l.weightG * factor, decimals),
  }));
}
