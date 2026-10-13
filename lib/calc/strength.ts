import { mergeByMaterial } from "./expand";
import {
  TIERS,
  sum,
  type ExpandedItem,
  type FormulaContext,
  type Material,
  type Tier,
} from "./types";

/** Dipakai saat bahan belum punya nilai impact. Ditandai, bukan disembunyikan. */
export const DEFAULT_IMPACT = 100;

/**
 * Kekuatan satu item = porsinya × daya pukul bahannya.
 *
 * Basisnya `strengthBasisPct`, yang untuk `as_sold` sama dengan massa produk —
 * BUKAN massa aktif. Alasannya: nilai impact Ecofragrantica menempel ke produk
 * seperti yang dijual. "Indole 50 BB" punya impact 350 sebagai produk encer;
 * menghitungnya dari massa aktif akan membuat kekuatannya terhitung setengah.
 * Asumsi ini bisa diubah per bahan lewat `impactBasis`.
 */
export function strengthOf(
  item: ExpandedItem,
  material: Material | undefined,
): number {
  if (item.kind === "fo") return 0; // FO tidak punya impact dan tidak akan pernah
  if (!material) return 0;
  if (material.impact == null) {
    // Pelarut tanpa impact memang tidak berbau — nol, bukan 100.
    return material.isSolvent ? 0 : item.strengthBasisPct * DEFAULT_IMPACT;
  }
  return item.strengthBasisPct * material.impact;
}

export type StrengthRow = {
  refId: string;
  name: string;
  kind: "material" | "fo";
  /** % timbang dari baris langsung di formula ini; 0 kalau cuma lewat accord */
  weighPct: number;
  /** porsi nyata di botol, sudah termasuk yang datang lewat accord & dilusi */
  productPct: number;
  strengthPct: number | null;
  impactMissing: boolean;
  functionCategory: string | null;
  isSolvent: boolean;
  /** porsi yang datang dari DALAM accord — bukan dari dilusi pelarut */
  viaAccordPct: number;
  /** jalur accord, kalau bahan ini datang dari dalam accord */
  via: string[];
};

export type StrengthResult = {
  rows: StrengthRow[];
  /** berapa % formula yang ikut dinilai kekuatannya (non-FO) */
  coverage: number;
  /** nama bahan yang impact-nya belum ada */
  missingImpact: string[];
  excludedFoPct: number;
};

export function strengthTable(
  ctx: FormulaContext,
  items: ExpandedItem[],
): StrengthResult {
  const merged = mergeByMaterial(items);

  // % timbang = persen yang diketik user di baris langsung. Bahan yang hanya
  // muncul lewat accord punya 0 di sini, dan itu memang jujur — user tidak
  // mengetiknya.
  const direct = new Map<string, number>();
  for (const line of ctx.version.lines) {
    if (line.kind === "accord") continue;
    direct.set(line.refId, (direct.get(line.refId) ?? 0) + line.pct);
  }

  const contrib = new Map<string, number>();
  let totalStrength = 0;
  for (const [refId, m] of merged) {
    const material = ctx.materials.get(refId);
    const s = sum(m.sources.map((it) => strengthOf(it, material)));
    contrib.set(refId, s);
    totalStrength += s;
  }

  const missingImpact: string[] = [];
  const rows: StrengthRow[] = [];

  for (const [refId, m] of merged) {
    const material = ctx.materials.get(refId);
    const fo = ctx.fos.get(refId);
    const name = material?.name ?? fo?.name ?? "(bahan tidak ditemukan)";
    const isMissing =
      m.kind === "material" && !!material && material.impact == null && !material.isSolvent;
    if (isMissing) missingImpact.push(name);

    const s = contrib.get(refId) ?? 0;
    rows.push({
      refId,
      name,
      kind: m.kind,
      weighPct: direct.get(refId) ?? 0,
      productPct: m.productPct,
      // FO sengaja null, bukan 0 — "tidak dinilai" berbeda dari "tidak kuat".
      strengthPct:
        m.kind === "fo" ? null : totalStrength ? (s / totalStrength) * 100 : 0,
      impactMissing: isMissing,
      functionCategory: material?.functionCategory ?? null,
      isSolvent: material?.isSolvent ?? false,
      viaAccordPct: sum(
        m.sources.filter((it) => it.via.length > 0).map((it) => it.productPct),
      ),
      via: m.sources.find((it) => it.via.length > 0)?.via ?? [],
    });
  }

  rows.sort((a, b) => (b.strengthPct ?? -1) - (a.strengthPct ?? -1));

  const foPct = sum(
    items.filter((i) => i.kind === "fo").map((i) => i.productPct),
  );
  const totalPct = sum(items.map((i) => i.productPct));

  return {
    rows,
    coverage: totalPct ? ((totalPct - foPct) / totalPct) * 100 : 0,
    missingImpact: [...new Set(missingImpact)],
    excludedFoPct: foPct,
  };
}

export type RealPyramidRow = {
  tier: Tier;
  target: number;
  /** Σ persen baris yang ditempatkan di tier ini */
  filled: number;
  /** Σ bahan pewangi aktif — pelarut dan dilusi sudah dikeluarkan */
  active: number;
};

/**
 * Piramida target vs piramida NYATA.
 *
 * "Aktif" mengeluarkan dua hal: pelarut (dari dilusi user maupun yang
 * ditambahkan langsung sebagai baris) dan bagian pelarut bawaan supplier.
 * Benzyl Benzoate 10% yang diketik user tetap pelarut — jadi Base yang diset
 * 60% bisa ternyata cuma 45,5% bahan pewangi.
 *
 * Selisih dua angka itulah informasi yang user cari.
 */
export function realPyramid(
  ctx: FormulaContext,
  items: ExpandedItem[],
): RealPyramidRow[] {
  const p = ctx.version.pyramid;
  const tiers: Tier[] = p ? TIERS : ["all"];

  return tiers.map((tier) => {
    const target = p
      ? tier === "top"
        ? p.top
        : tier === "mid"
          ? p.mid
          : p.base
      : 100;

    const filled = sum(
      ctx.version.lines.filter((l) => l.tier === tier).map((l) => l.pct),
    );

    const active = sum(
      items
        .filter((i) => i.tier === tier && i.role === "ingredient")
        .filter((i) => !ctx.materials.get(i.refId)?.isSolvent)
        .map((i) => i.activePct),
    );

    return { tier, target, filled, active };
  });
}
