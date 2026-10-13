import { EVAL_MEDIA, EVAL_PURPOSES } from "../constants";
import type {
  EvalMediumEnum,
  EvalPurposeEnum,
} from "../supabase/database.types";
import type { Finding } from "./index";
import { T } from "./thresholds";

/**
 * Rule 8 — kesahihan perbandingan.
 *
 * Berbeda dari rule lain yang memeriksa FORMULA, rule ini memeriksa apakah dua
 * evaluasi layak dibandingkan sama sekali.
 *
 * Tabel compare yang terlihat rapi tapi datanya dari kondisi berbeda lebih
 * berbahaya daripada tidak punya tabel: user akan menarik kesimpulan dengan
 * percaya diri dari perbandingan yang tidak sah. Karena itu temuannya
 * ditampilkan DI ATAS tabel — kalau user sudah selesai membaca tabelnya,
 * peringatan itu sudah terlambat.
 *
 * Semua temuan bersifat memberi tahu, tidak memblokir apa pun.
 */

export type CompareEvaluation = {
  evaluatorName: string;
  purpose: EvalPurposeEnum;
  medium: EvalMediumEnum;
  dilutedIn: string | null;
  macerationDays: number | null;
  blindCode: string | null;
};

export type CompareSubject = {
  /** "v2" — dipakai apa adanya di pesan temuan */
  label: string;
  /** evaluasi yang mewakili versi ini; null kalau versinya belum dinilai */
  evaluation: CompareEvaluation | null;
};

const mediumLabel = (m: EvalMediumEnum) =>
  EVAL_MEDIA.find((x) => x.value === m)?.label ?? m;

const purposeLabel = (p: EvalPurposeEnum) =>
  EVAL_PURPOSES.find((x) => x.value === p)?.label ?? p;

/** Daftar nilai unik beserta versi mana saja yang memakainya. */
function groupBy<T>(
  subjects: { label: string; evaluation: CompareEvaluation }[],
  pick: (e: CompareEvaluation) => T,
): Map<T, string[]> {
  const out = new Map<T, string[]>();
  for (const s of subjects) {
    const key = pick(s.evaluation);
    out.set(key, [...(out.get(key) ?? []), s.label]);
  }
  return out;
}

export function runCompareRules(subjects: CompareSubject[]): Finding[] {
  const scored = subjects.filter(
    (s): s is { label: string; evaluation: CompareEvaluation } =>
      s.evaluation != null,
  );

  // Dengan kurang dari dua evaluasi tidak ada yang bisa dibandingkan, jadi
  // tidak ada pula yang bisa tidak sah.
  if (scored.length < 2) return [];

  const out: Finding[] = [];

  // --- umur maserasi ---
  const aged = scored.filter((s) => s.evaluation.macerationDays != null);
  if (aged.length >= 2) {
    const sorted = aged
      .slice()
      .sort(
        (a, b) =>
          a.evaluation.macerationDays! - b.evaluation.macerationDays!,
      );
    const youngest = sorted[0];
    const oldest = sorted[sorted.length - 1];
    const gap =
      oldest.evaluation.macerationDays! - youngest.evaluation.macerationDays!;

    if (gap > T.macerationGapDays) {
      out.push({
        rule: "compare-maceration-gap",
        level: "warning",
        message: `${oldest.label} dinilai di umur ${oldest.evaluation.macerationDays} hari, ${youngest.label} di umur ${youngest.evaluation.macerationDays} hari. Ini membandingkan umur, bukan formula. Nilai ulang setelah umurnya setara.`,
      });
    }
  }

  // --- tujuan penilaian ---
  const purposes = groupBy(scored, (e) => e.purpose);
  if (purposes.size > 1) {
    const parts = [...purposes.entries()].map(
      ([purpose, labels]) =>
        `${labels.join(", ")} sebagai ${purposeLabel(purpose).toLowerCase()}`,
    );
    out.push({
      rule: "compare-purpose",
      level: "warning",
      message: `${parts.join(", ")}. Dua protokol berbeda, hasilnya tidak sebanding.`,
    });
  }

  // --- media ---
  const media = groupBy(scored, (e) => e.medium);
  if (media.size > 1) {
    const names = [...media.keys()].map(mediumLabel).join(" vs ");
    out.push({
      rule: "compare-medium",
      level: "warning",
      message: `Dinilai di media berbeda (${names}). Wangi di kulit dan di blotter bisa jauh berbeda.`,
    });
  }

  // --- pengenceran ---
  const dilutions = groupBy(scored, (e) => e.dilutedIn?.trim() || null);
  if (dilutions.size > 1) {
    const names = [...dilutions.keys()]
      .map((d) => d ?? "tidak dicatat")
      .join(" vs ");
    out.push({
      rule: "compare-dilution",
      level: "warning",
      message: `Konsentrasi pengenceran berbeda (${names}).`,
    });
  }

  // --- penilai ---
  const evaluators = new Set(
    scored.map((s) => s.evaluation.evaluatorName.trim().toLowerCase()),
  );
  const noneBlind = scored.every((s) => !s.evaluation.blindCode?.trim());
  if (evaluators.size > 1 && noneBlind) {
    out.push({
      rule: "compare-evaluator",
      level: "info",
      message:
        "Dinilai oleh orang berbeda tanpa kode buta. Perbedaan penilaian bisa datang dari hidungnya, bukan dari formulanya.",
    });
  }

  return out;
}

export const COMPARE_VALID =
  "Kondisi uji antar versi setara — perbandingan di bawah layak dibaca.";
