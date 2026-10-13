import { T } from "../../rules/thresholds";

/**
 * Pencegahan siklus dan pembatasan kedalaman sub-formula.
 *
 * Check constraint di database hanya mencegah baris yang merujuk ke dirinya
 * sendiri. Siklus tak langsung (A memakai B, B memakai A) harus dicegah di
 * aplikasi sebelum menyimpan.
 *
 * Fungsi di file ini murni: grafnya diberikan dari luar (dibangun dari
 * formula_lines oleh server action), supaya bisa diuji tanpa database.
 */

export type GraphNode = {
  versionId: string;
  /** "Jasmine Accord v3" — pesan error harus menyebut nama, bukan UUID */
  label: string;
  /** versi lain yang dipakai baris sub_formula pada versi ini */
  subVersionIds: string[];
};

export type SubFormulaGraph = Map<string, GraphNode>;

export type SubFormulaProblem =
  | { kind: "cycle"; pathLabels: string[] }
  | { kind: "depth"; pathLabels: string[]; depth: number; maxDepth: number };

export class SubFormulaError extends Error {
  constructor(
    message: string,
    readonly problem: SubFormulaProblem,
  ) {
    super(message);
    this.name = "SubFormulaError";
  }
}

const labelOf = (graph: SubFormulaGraph, id: string) =>
  graph.get(id)?.label ?? "formula tak dikenal";

/**
 * Menelusuri rantai sub-formula dari `startId`. Mengembalikan jalur (berisi
 * nama, bukan UUID) kalau menemukan `targetId`, atau null kalau bersih.
 */
function findPathTo(
  graph: SubFormulaGraph,
  startId: string,
  targetId: string,
  seen = new Set<string>(),
): string[] | null {
  if (startId === targetId) return [labelOf(graph, startId)];
  if (seen.has(startId)) return null; // siklus yang tidak menyentuh target
  seen.add(startId);
  for (const next of graph.get(startId)?.subVersionIds ?? []) {
    const rest = findPathTo(graph, next, targetId, seen);
    if (rest) return [labelOf(graph, startId), ...rest];
  }
  return null;
}

/** Kedalaman sarang di bawah sebuah versi. Versi datar = 1. */
export function depthOf(
  graph: SubFormulaGraph,
  versionId: string,
  seen = new Set<string>(),
): number {
  if (seen.has(versionId)) return 1; // berhenti, jangan hang
  seen.add(versionId);
  const subs = graph.get(versionId)?.subVersionIds ?? [];
  if (!subs.length) return 1;
  return (
    1 + Math.max(...subs.map((s) => depthOf(graph, s, new Set(seen))))
  );
}

/**
 * Memeriksa satu kandidat sub-formula sebelum dipakai. Mengembalikan alasan
 * penolakan, atau null kalau boleh dipakai. Dipakai juga oleh ComponentPicker
 * untuk menonaktifkan pilihan beserta alasannya di tooltip — bukan
 * menyembunyikannya, karena user akan mencari-cari.
 */
export function checkCandidate(
  graph: SubFormulaGraph,
  editedVersionId: string,
  candidateId: string,
  maxDepth: number = T.maxSubFormulaDepth,
): SubFormulaProblem | null {
  if (candidateId === editedVersionId) {
    return { kind: "cycle", pathLabels: [labelOf(graph, candidateId)] };
  }
  const path = findPathTo(graph, candidateId, editedVersionId);
  if (path) return { kind: "cycle", pathLabels: path };

  const depth = 1 + depthOf(graph, candidateId);
  if (depth > maxDepth) {
    return {
      kind: "depth",
      pathLabels: [labelOf(graph, editedVersionId), labelOf(graph, candidateId)],
      depth,
      maxDepth,
    };
  }
  return null;
}

export function explainProblem(problem: SubFormulaProblem): string {
  if (problem.kind === "cycle") {
    if (problem.pathLabels.length <= 1) {
      return "Formula tidak bisa memakai dirinya sendiri sebagai komponen.";
    }
    return `Tidak bisa dipakai: ${problem.pathLabels.join(
      " memakai ",
    )} — jadi formula ini sudah memakai formula yang kamu edit.`;
  }
  return `Tidak bisa dipakai: sarangnya jadi ${problem.depth} tingkat, maksimal ${problem.maxDepth}. Lebih dalam dari itu formulanya tidak bisa dibaca manusia.`;
}

/**
 * Dipanggil sebelum menyimpan baris. Melempar SubFormulaError dengan pesan
 * yang menyebut NAMA formula penyebabnya — jangan pernah UUID.
 */
export function assertNoCycle(
  graph: SubFormulaGraph,
  editedVersionId: string,
  candidateSubIds: string[],
  maxDepth: number = T.maxSubFormulaDepth,
): void {
  for (const candidateId of candidateSubIds) {
    const problem = checkCandidate(graph, editedVersionId, candidateId, maxDepth);
    if (problem) throw new SubFormulaError(explainProblem(problem), problem);
  }
}
