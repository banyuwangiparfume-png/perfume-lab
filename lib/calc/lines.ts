import { DEFAULT_IMPACT, strengthOf } from "./strength";
import {
  sum,
  type ExpandedItem,
  type FormulaContext,
  type Tier,
} from "./types";

/** Satu bahan penyusun accord, sudah diskalakan ke porsinya di formula induk. */
export type LineSubRow = {
  refId: string;
  name: string;
  productPct: number;
  activePct: number;
  impact: number | null;
};

export type LineRow = {
  lineId: string;
  /** nomor urut yang dilihat user, mulai dari 1 */
  no: number;
  tier: Tier;
  kind: "raw_material" | "accord" | "fo";
  refId: string;
  name: string;
  /** persen yang diketik user di baris ini — bentuk yang ditimbang */
  pct: number;
  /**
   * Molekul murni dari baris ini: dilusi user dan dilusi supplier sudah
   * dipotong, dan bahan yang memang pelarut tidak dihitung sama sekali.
   * Baris Benzyl Benzoate 10% jadi 0 di sini, bukan 10.
   */
  activePct: number;
  userDilutionPct: number;
  userSolventName: string | null;
  /** dilusi bawaan supplier, null kalau bahannya neat atau bukan raw material */
  supplierDilutionPct: number | null;
  supplierSolventName: string | null;
  /**
   * Daya pukul efektif per satuan massa baris ini. Untuk raw material ini
   * persis nilai impact bahannya; untuk accord ini rata-rata berbobot isinya,
   * termasuk pelarut di dalamnya yang menariknya turun.
   */
  impact: number | null;
  /** impact-nya agregat, jadi di UI perlu ditandai "(rata-rata)" */
  impactIsAverage: boolean;
  /** ada bahan tanpa data impact di baris ini — angkanya cuma perkiraan */
  impactMissing: boolean;
  /** null untuk FO: "tidak dinilai" berbeda dari "tidak kuat" */
  strengthPct: number | null;
  /** isi accord; kosong untuk baris lain */
  sub: LineSubRow[];
};

export type LineTable = {
  rows: LineRow[];
  total: {
    pct: number;
    activePct: number;
    /** jumlah kolom kekuatan; TIDAK selalu 100 — lihat field di bawah */
    strengthPct: number;
    /**
     * Porsi kekuatan yang datang dari pelarut hasil dilusi user.
     *
     * Sengaja tidak ditempelkan ke baris mana pun: Benzyl Benzoate yang ikut
     * masuk saat mengencerkan Ambroxan bukan kekuatan Ambroxan, dan baris
     * Benzyl Benzoate sendiri cuma memuat yang diketik user. Jadi kolom
     * kekuatan berhenti sebelum 100% dan selisihnya ada di sini, bukan
     * dibagi-bagi diam-diam.
     */
    dilutionSolventStrengthPct: number;
  };
};

/**
 * Tabel komposisi per BARIS, untuk dibaca manusia.
 *
 * Bedanya dengan `strengthTable`: yang itu per BAHAN — Benzyl Benzoate yang
 * datang dari tiga tempat jadi satu baris, karena itu yang benar untuk menilai
 * kekuatan. Yang ini per baris yang diketik user, karena itu yang dia cari saat
 * membaca formulanya sendiri.
 *
 * Normalisasi kekuatannya memakai `strengthOf` dan total yang sama persis,
 * jadi dua tabel itu tidak akan pernah menunjukkan 100% yang berbeda.
 */
export function lineTable(
  ctx: FormulaContext,
  items: ExpandedItem[],
): LineTable {
  const byLine = new Map<string, ExpandedItem[]>();
  for (const item of items) {
    const list = byLine.get(item.sourceLineId);
    if (list) list.push(item);
    else byLine.set(item.sourceLineId, [item]);
  }

  // Pembaginya SELURUH item — sama persis dengan strengthTable — supaya
  // persentase di dua tabel bisa dibandingkan langsung.
  const totalStrength = sum(
    items.map((it) => strengthOf(it, ctx.materials.get(it.refId))),
  );
  const solventStrength = sum(
    items
      .filter((it) => it.role === "user_solvent")
      .map((it) => strengthOf(it, ctx.materials.get(it.refId))),
  );

  const nameOf = (refId: string) =>
    ctx.materials.get(refId)?.name ??
    ctx.fos.get(refId)?.name ??
    ctx.accords.get(refId)?.name ??
    "(tidak ditemukan)";

  const rows = ctx.version.lines.map((line, i): LineRow => {
    const own = byLine.get(line.id) ?? [];
    const ingredients = own.filter((it) => it.role === "ingredient");

    const lineStrength = sum(
      ingredients.map((it) => strengthOf(it, ctx.materials.get(it.refId))),
    );
    const basis = sum(ingredients.map((it) => it.strengthBasisPct));

    const material =
      line.kind === "raw_material" ? ctx.materials.get(line.refId) : undefined;

    const missing = ingredients.some((it) => {
      const m = ctx.materials.get(it.refId);
      return it.kind === "material" && !!m && m.impact == null && !m.isSolvent;
    });

    return {
      lineId: line.id,
      no: i + 1,
      tier: line.tier,
      kind: line.kind,
      refId: line.refId,
      name: nameOf(line.refId),
      pct: line.pct,
      activePct: sum(
        ingredients
          .filter((it) => !ctx.materials.get(it.refId)?.isSolvent)
          .map((it) => it.activePct),
      ),
      userDilutionPct: line.userDilutionPct,
      userSolventName: line.userSolventId ? nameOf(line.userSolventId) : null,
      supplierDilutionPct:
        material && material.supplierDilutionPct < 100
          ? material.supplierDilutionPct
          : null,
      supplierSolventName:
        material?.supplierSolventId ? nameOf(material.supplierSolventId) : null,
      // FO memang tidak punya impact, dan itu bukan data yang hilang.
      impact: line.kind === "fo" ? null : basis ? lineStrength / basis : null,
      impactIsAverage: line.kind === "accord",
      impactMissing: missing,
      strengthPct:
        line.kind === "fo"
          ? null
          : totalStrength
            ? (lineStrength / totalStrength) * 100
            : 0,
      sub:
        line.kind === "accord"
          ? collapseSub(ctx, ingredients)
          : [],
    };
  });

  return {
    rows,
    total: {
      pct: sum(rows.map((r) => r.pct)),
      activePct: sum(rows.map((r) => r.activePct)),
      strengthPct: sum(rows.map((r) => r.strengthPct ?? 0)),
      dilutionSolventStrengthPct: totalStrength
        ? (solventStrength / totalStrength) * 100
        : 0,
    },
  };
}

/** Isi accord digabung per bahan, diurut dari porsi terbesar. */
function collapseSub(
  ctx: FormulaContext,
  items: ExpandedItem[],
): LineSubRow[] {
  const acc = new Map<string, LineSubRow>();

  for (const it of items) {
    const prev = acc.get(it.refId);
    if (prev) {
      prev.productPct += it.productPct;
      prev.activePct += it.activePct;
      continue;
    }
    const m = ctx.materials.get(it.refId);
    acc.set(it.refId, {
      refId: it.refId,
      name: m?.name ?? ctx.fos.get(it.refId)?.name ?? "(tidak ditemukan)",
      productPct: it.productPct,
      activePct: it.activePct,
      impact: m ? (m.impact ?? (m.isSolvent ? 0 : DEFAULT_IMPACT)) : null,
    });
  }

  return [...acc.values()].sort((a, b) => b.productPct - a.productPct);
}
