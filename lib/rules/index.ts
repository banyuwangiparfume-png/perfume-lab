import { countFamilies, countMaterials } from "../legacy/calc/expand";
import { fmtPct } from "../calc/format";
import type { CalcLine, FormulaResult } from "../legacy/calc/types";
import { T } from "./thresholds";

export type FindingLevel = "info" | "warning" | "critical";

/** Aksi lanjutan — mengubah peringatan jadi langkah yang bisa dikerjakan. */
export type ActionHint = { kind: "bridger-candidates"; label: string };

export type Finding = {
  rule: string;
  level: FindingLevel;
  message: string;
  /** penjelasan basis angka, ditampilkan sebagai tooltip */
  basisNote?: string;
  actionHint?: ActionHint;
};

/**
 * Menjalankan seluruh pemeriksaan struktural.
 *
 * `expanded` WAJIB hasil expandLines(), dan `result` WAJIB hasil
 * computeFormula(expanded) — bukan computeFormula(baris mentah). Kalau tidak,
 * formula berisi 3 sub-formula akan terbaca "3 bahan" padahal isinya 24.
 * Pakai analyze() di lib/calc/analyze.ts supaya tidak keliru memasangkannya.
 *
 * Nada peringatan: memberi informasi, bukan menghakimi. User yang merasa
 * dimarahi aplikasi akan berhenti mencatat — dan catatan adalah seluruh
 * nilai produk ini.
 */
export function runRules(
  result: FormulaResult,
  expanded: CalcLine[],
): Finding[] {
  if (!expanded.length) return [];

  const out: Finding[] = [];
  const foBasis =
    "Persentase di rule ini memakai % kekuatan, dan bagian FO tidak ikut terhitung di situ. " +
    `Yang dinilai adalah porsi di dalam ${fmtPct(result.strengthBasis)} formula yang bisa dinilai.`;

  // ---------- Rule 1 — jumlah bahan ----------
  const n = countMaterials(expanded);
  if (n > T.maxMaterials) {
    out.push({
      rule: "material-count",
      level: "warning",
      message: `Formula ini punya ${n} bahan. Untuk pemula, di atas ${T.maxMaterials} bahan sulit dikendalikan dan hasilnya cenderung bubur.`,
    });
  } else if (n <= 3 && n > 0) {
    out.push({
      rule: "material-count",
      level: "info",
      message: "Formula sangat sederhana. Bagus untuk belajar rasio.",
    });
  }
  if (result.hasFO) {
    out.push({
      rule: "fo-hidden-materials",
      level: "info",
      message: `Hitungan ${n} bahan di atas belum termasuk isi FO. Satu FO biasanya berisi 30–80 bahan yang tidak terlihat di sini.`,
    });
  }

  // ---------- Rule 2 — sebaran fungsi (pakai % kekuatan) ----------
  const hasScored = result.rows.some((r) => r.strengthPct != null);
  if (hasScored) {
    const fx = result.functionShares.fixative;
    const push =
      result.functionShares.diffuser + result.functionShares.modifier;
    const bridger = result.functionShares.bridger;
    const families = countFamilies(expanded);

    if (fx < T.minFixativeShare) {
      out.push({
        rule: "fixative-share",
        level: "warning",
        message: `Porsi Fixative cuma ${fmtPct(fx)}. Drydown kemungkinan tipis dan wangi cepat hilang.`,
        basisNote: result.hasFO ? foBasis : undefined,
      });
    }
    if (push > T.maxPushShare) {
      out.push({
        rule: "push-share",
        level: "warning",
        message: `Formula didominasi bahan yang mendorong keluar (Diffuser + Modifier ${fmtPct(push)}). Kemungkinan terasa menusuk di awal.`,
        basisNote: result.hasFO ? foBasis : undefined,
      });
    }
    if (bridger === 0 && families >= T.minFamiliesForBridgeCheck) {
      out.push({
        rule: "no-bridger",
        level: "warning",
        message: `Tidak ada bahan kategori Bridger, padahal formula mencakup ${families} keluarga aroma. Transisi berisiko patah.`,
        actionHint: {
          kind: "bridger-candidates",
          label: "Lihat kandidat Bridger",
        },
      });
    }
  }

  // ---------- Rule 3 — dominansi ----------
  const scoredRows = result.rows.filter((r) => r.strengthPct != null);
  // Dengan satu bahan yang dinilai, "ada yang memimpin" selalu 100% —
  // peringatannya cuma jadi kebisingan, jadi rule ini butuh minimal 2 bahan.
  if (result.lead && scoredRows.length >= 2) {
    const top = result.lead;
    if (top.share < T.minLeadShare) {
      out.push({
        rule: "no-lead",
        level: "warning",
        message: `Tidak ada nada yang memimpin — porsi kekuatan terlalu rata (terbesar cuma ${fmtPct(top.share)}). Ini penyebab paling umum formula terasa bubur.`,
        basisNote: result.hasFO ? foBasis : undefined,
      });
    } else if (top.share > T.maxLeadShare) {
      out.push({
        rule: "over-lead",
        level: "warning",
        message: `${top.label} menguasai ${fmtPct(top.share)} kekuatan. Bahan lain kemungkinan tidak terbaca.`,
        basisNote: result.hasFO ? foBasis : undefined,
      });
    }
  }

  // ---------- Rule 4 — bahan yang menelan / tenggelam ----------
  // Basis "porsi berat" di sini adalah % MURNI, bukan % timbang — supaya
  // perbandingannya jujur untuk bahan yang dipakai dalam bentuk encer.
  for (const r of scoredRows) {
    const strength = r.strengthPct!;
    if (strength >= T.swallowRatio * r.neatPct && strength > T.swallowMinShare) {
      out.push({
        rule: "swallowing",
        level: "warning",
        message: `${r.label} cuma ${fmtPct(r.neatPct)} berat tapi ${fmtPct(strength)} kekuatan. Cek apakah dosisnya kelebihan.`,
      });
    }
    if (strength < T.negligibleShare) {
      out.push({
        rule: "negligible",
        level: "info",
        message: `${r.label} kontribusinya di bawah ${T.negligibleShare}%. Naikkan dosisnya atau hapus — saat ini dia hanya menambah biaya.`,
      });
    }
  }

  // ---------- Rule 5 — kelengkapan data ----------
  if (result.missingImpact.length) {
    const names = result.missingImpact.join(", ");
    out.push({
      rule: "missing-impact",
      level: "critical",
      message: `${result.missingImpact.length} bahan belum punya nilai impact (${names}). Semua persentase kekuatan di halaman ini belum bisa dipercaya sampai data itu dilengkapi.`,
    });
  }

  // ---------- Rule 6 — dominasi FO ----------
  if (result.hasFO) {
    const share = result.foNeatShare;
    if (share < T.minFoShare) {
      out.push({
        rule: "fo-share",
        level: "warning",
        message: `FO cuma ${fmtPct(share)} dari formula. Di bawah ${T.minFoShare}%, karakter asli bibitnya mulai tertutup oleh bahan tambahan. Kalau itu memang tujuanmu, abaikan — tapi jangan berharap hasilnya masih mirip FO aslinya.`,
      });
    } else if (share >= 99) {
      out.push({
        rule: "fo-share",
        level: "info",
        message: `Tambahan di luar FO cuma ${fmtPct(100 - share)}. Kemungkinan besar efeknya tidak akan terasa.`,
      });
    }
  }

  // ---------- Rule 7 — lebih dari satu FO ----------
  // Rule ini tidak memblokir apa pun. Menggabungkan dua FO tobacco 70:30
  // adalah hal wajar dan sering berhasil. Yang dicegah adalah melakukannya
  // tanpa sadar risikonya.
  if (result.foCount >= 2) {
    out.push({
      rule: "multi-fo",
      level: "warning",
      message: `Formula ini menggabungkan ${result.foCount} bibit jadi. Tiap FO adalah parfum lengkap berisi puluhan bahan yang tidak dirancang untuk digabung — ini penyebab paling umum hasil terasa bubur.`,
    });

    const biggest = result.foShares[0];
    if (biggest && biggest.share < T.foLeadShare) {
      out.push({
        rule: "multi-fo-balance",
        level: "warning",
        message: `Tidak ada FO yang jelas memimpin (terbesar cuma ${fmtPct(biggest.share)}). Dua bibit dengan porsi seimbang akan saling berebut. Naikkan salah satu ke ${T.foLeadShare}% atau lebih.`,
      });
    }

    const families = [
      ...new Set(
        result.foShares
          .map((f) => f.family?.trim())
          .filter((f): f is string => !!f),
      ),
    ];
    if (families.length >= 2) {
      out.push({
        rule: "multi-fo-family",
        level: "warning",
        message: `FO yang digabung berasal dari family berbeda (${families.join(" dan ")}). Penggabungan dua bibit hanya masuk akal kalau family-nya berdekatan.`,
      });
    }
  }

  return out;
}

/** Teks penutup panel. Wajib ada di semua kondisi — jangan dihapus. */
export const RULES_DISCLAIMER =
  "Pemeriksaan ini hanya menilai struktur, bukan aroma. Formula bisa lolos semua pemeriksaan dan tetap berbau tidak enak. Keputusan akhir tetap di hidung kamu.";

export const RULES_HEALTHY =
  "Struktur formula ini sehat. Sekarang racik dan cium sendiri — pemeriksaan ini tidak bisa menilai aroma.";
