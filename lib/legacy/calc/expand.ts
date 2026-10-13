import { T } from "../../rules/thresholds";
import { neatWeight } from "./formula";
import type { CalcLine } from "./types";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Menskalakan penyusun sebuah sub-formula ke porsinya di formula induk.
 *
 * Faktornya dihitung dari berat MURNI, supaya Σ berat murni sub-baris
 * tepat sama dengan berat murni baris induknya. Dilusi tiap sub-baris
 * dipertahankan — jadi angka yang muncul di sub-baris tetap "berat seperti
 * ditimbang" pada dilusi aslinya, bukan angka murni yang menyesatkan.
 *
 * Dipakai dua kali: oleh expandLines() untuk rules checker, dan oleh tabel
 * komponen saat user memperluas baris sub-formula.
 */
export function scaleSubLines(line: CalcLine): CalcLine[] {
  const sub = line.subLines ?? [];
  if (!sub.length) return [];
  const parentNeat = neatWeight(line);
  const subNeat = sum(sub.map(neatWeight));
  if (subNeat <= 0 || parentNeat <= 0) return [];
  const factor = parentNeat / subNeat;
  return sub.map((s) => ({
    ...s,
    id: `${line.id}:${s.id}`,
    weightG: s.weightG * factor,
  }));
}

/**
 * Membentangkan baris sub_formula jadi raw material penyusunnya, dengan berat
 * diskalakan proporsional.
 *
 * Baris FO TIDAK dibentangkan — isinya memang tidak diketahui, jadi dia tetap
 * satu baris.
 *
 * Dipakai oleh rules checker dan donut kategori fungsi, BUKAN oleh tabel
 * komponen. Kalau rules dijalankan di atas baris mentah, formula berisi
 * 3 sub-formula akan terbaca "3 bahan" padahal isinya 24.
 */
export function expandLines(
  lines: CalcLine[],
  depth = 0,
  /**
   * Banyaknya pembentangan yang boleh dilakukan. T.maxSubFormulaDepth menghitung
   * root sebagai tingkat 1, jadi jumlah pembentangannya satu lebih sedikit:
   * kedalaman 3 tingkat = 2 kali bentang.
   */
  maxExpansions: number = T.maxSubFormulaDepth - 1,
): CalcLine[] {
  const out: CalcLine[] = [];
  for (const line of lines) {
    if (line.lineType !== "sub_formula") {
      out.push(line);
      continue;
    }
    // Kedalaman habis atau penyusunnya belum ter-resolve: biarkan sebagai
    // satu baris. Lebih baik hitungan sedikit kasar daripada data dikarang.
    if (depth >= maxExpansions) {
      out.push(line);
      continue;
    }
    const scaled = scaleSubLines(line);
    if (!scaled.length) {
      out.push(line);
      continue;
    }
    out.push(...expandLines(scaled, depth + 1, maxExpansions));
  }
  return out;
}

/**
 * Jumlah bahan setelah sub-formula dibentangkan. Baris FO tidak dihitung
 * di sini — isinya puluhan bahan yang tidak terlihat, dan itu ditangani
 * terpisah oleh Rule 1.
 */
export function countMaterials(expanded: CalcLine[]): number {
  return expanded.filter((l) => l.lineType !== "fo").length;
}

/** Jumlah family aroma yang terlibat, termasuk family baris FO. */
export function countFamilies(expanded: CalcLine[]): number {
  const families = new Set<string>();
  for (const l of expanded) {
    const f = l.lineType === "fo" ? l.foFamily : l.family;
    if (f) families.add(f.trim().toLowerCase());
  }
  return families.size;
}
