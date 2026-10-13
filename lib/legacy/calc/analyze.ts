import { runRules, type Finding } from "../../rules";
import { expandLines } from "./expand";
import { computeFormula } from "./formula";
import type { CalcLine, FormulaResult } from "./types";

export type Analysis = {
  /** untuk tabel komponen — bentuk ringkas, sub-formula tetap satu baris */
  display: FormulaResult;
  /** daftar yang sudah dibentangkan */
  expanded: CalcLine[];
  /** untuk rules checker dan donut kategori fungsi */
  expandedResult: FormulaResult;
  findings: Finding[];
};

/**
 * Satu pintu masuk untuk seluruh analisa sebuah versi.
 *
 * Memastikan rules selalu berjalan di atas daftar yang sudah dibentangkan,
 * dan tabel komponen selalu memakai bentuk ringkas. Pakai ini — jangan
 * memasangkan computeFormula + runRules sendiri, karena pasangan yang keliru
 * membuat formula berisi 3 sub-formula terbaca sebagai "3 bahan".
 */
export function analyze(lines: CalcLine[]): Analysis {
  const display = computeFormula(lines);
  const expanded = expandLines(lines);
  const expandedResult = computeFormula(expanded);
  return {
    display,
    expanded,
    expandedResult,
    findings: runRules(expandedResult, expanded),
  };
}
