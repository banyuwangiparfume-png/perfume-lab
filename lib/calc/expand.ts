import type {
  ExpandedItem,
  FormulaContext,
  Version,
} from "./types";
import { sum } from "./types";

export const MAX_ACCORD_DEPTH = 3;

export class ExpandError extends Error {
  constructor(
    message: string,
    readonly kind: "cycle" | "depth",
  ) {
    super(message);
    this.name = "ExpandError";
  }
}

/**
 * Membentangkan formula jadi komposisi NYATA — daftar bahan yang benar-benar
 * masuk botol, beserta porsinya terhadap total formula.
 *
 * Tiga hal terjadi di sini sekaligus:
 *  1. dilusi user dipecah: baris Ambroxan 5% @10% jadi 0,5% Ambroxan + 4,5% BB
 *  2. accord dibentangkan rekursif jadi bahan penyusunnya
 *  3. dilusi supplier dicatat sebagai `hiddenSolvent` — tidak dipecah jadi
 *     baris sendiri, karena harganya sudah termasuk di harga produk
 *
 * Yang membuat dua lapis dilusi tidak tertukar: `productPct` selalu bentuk
 * yang DIBELI (dipakai untuk kekuatan dan harga), `activePct` selalu molekul
 * murni (dipakai untuk piramida nyata dan IFRA).
 */
export function expand(
  ctx: FormulaContext,
  version: Version = ctx.version,
  factor = 1,
  via: string[] = [],
  depth = 0,
  seen: Set<string> = new Set([ctx.version.id]),
): ExpandedItem[] {
  if (depth > MAX_ACCORD_DEPTH) {
    throw new ExpandError(
      `Accord bersarang lebih dari ${MAX_ACCORD_DEPTH} tingkat (${via.join(" → ")}). Sedalam itu formulanya tidak bisa dibaca manusia.`,
      "depth",
    );
  }

  const out: ExpandedItem[] = [];

  for (const line of version.lines) {
    const base = line.pct * factor;
    const product = base * (line.userDilutionPct / 100);
    const userSolventPct = base * (1 - line.userDilutionPct / 100);

    if (line.kind === "raw_material") {
      const m = ctx.materials.get(line.refId);
      const supplierPct = m ? m.supplierDilutionPct / 100 : 1;
      const activePct = product * supplierPct;
      out.push({
        kind: "material",
        refId: line.refId,
        tier: line.tier,
        role: "ingredient",
        productPct: product,
        activePct,
        strengthBasisPct:
          m?.impactBasis === "active" ? activePct : product,
        hiddenSolvent:
          supplierPct < 1
            ? {
                solventId: m?.supplierSolventId ?? null,
                pct: product - activePct,
              }
            : undefined,
        via,
        sourceLineId: line.id,
      });
    } else if (line.kind === "accord") {
      const sub = ctx.accords.get(line.refId);
      if (!sub) {
        throw new ExpandError(
          `Accord yang dirujuk tidak ditemukan. Muat ulang halaman, atau pilih ulang accord-nya.`,
          "cycle",
        );
      }
      if (seen.has(line.refId)) {
        throw new ExpandError(
          `Accord membentuk siklus: ${[...via, sub.name ?? "accord ini"].join(" memakai ")} — akhirnya memakai dirinya sendiri.`,
          "cycle",
        );
      }

      const subTotal = sum(sub.lines.map((l) => l.pct));
      if (subTotal > 0) {
        const nested = expand(
          ctx,
          sub,
          product / subTotal,
          [...via, sub.name ?? "accord"],
          depth + 1,
          new Set([...seen, line.refId]),
        );
        // Tier item hasil mengikuti tier baris accord di formula INDUK —
        // isi accord tidak punya tier sendiri di konteks ini.
        for (const item of nested) {
          out.push({ ...item, tier: line.tier, sourceLineId: line.id });
        }
      }
    } else {
      // FO: tidak punya impact maupun facet, tapi beratnya dan harganya nyata.
      out.push({
        kind: "fo",
        refId: line.refId,
        tier: line.tier,
        role: "ingredient",
        productPct: product,
        activePct: product,
        strengthBasisPct: product,
        via,
        sourceLineId: line.id,
      });
    }

    if (userSolventPct > 0 && line.userSolventId) {
      out.push({
        kind: "material",
        refId: line.userSolventId,
        tier: line.tier,
        role: "user_solvent",
        productPct: userSolventPct,
        activePct: userSolventPct,
        strengthBasisPct: userSolventPct,
        via,
        sourceLineId: line.id,
      });
    }
  }

  return out;
}

export type MergedItem = {
  refId: string;
  kind: "material" | "fo";
  productPct: number;
  activePct: number;
  strengthBasisPct: number;
  sources: ExpandedItem[];
};

/**
 * Menggabungkan bahan yang sama dari beberapa sumber.
 *
 * Benzyl Benzoate yang ditambahkan langsung (10%) dan yang ikut masuk dari
 * dilusi Ambroxan (4,5%) adalah cairan yang sama di botol yang sama — jadi
 * dia satu baris 14,5%, bukan dua. Ini juga yang memicu R11 saat satu bahan
 * datang langsung dan lewat accord sekaligus.
 */
export function mergeByMaterial(
  items: ExpandedItem[],
): Map<string, MergedItem> {
  const out = new Map<string, MergedItem>();
  for (const item of items) {
    const prev = out.get(item.refId);
    if (prev) {
      prev.productPct += item.productPct;
      prev.activePct += item.activePct;
      prev.strengthBasisPct += item.strengthBasisPct;
      prev.sources.push(item);
    } else {
      out.set(item.refId, {
        refId: item.refId,
        kind: item.kind,
        productPct: item.productPct,
        activePct: item.activePct,
        strengthBasisPct: item.strengthBasisPct,
        sources: [item],
      });
    }
  }
  return out;
}
