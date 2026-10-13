import type { ExpandedItem, FormulaContext } from "./types";

export type SolventRow = {
  solventId: string;
  name: string;
  /** ditambahkan user sebagai baris bahan biasa */
  directPct: number;
  /** ikut masuk karena user mengencerkan baris lain */
  fromDilution: { lineName: string; pct: number }[];
  /** ikut masuk dari dalam accord */
  fromAccords: { accordName: string; pct: number }[];
  /** sudah ada di produk saat dibeli ("Indole 50 BB") */
  hiddenFromSupplier: { materialName: string; pct: number }[];
  /** yang benar-benar dituang: direct + dilusi + accord */
  explicitTotal: number;
  /** explicitTotal + bawaan supplier — ini angka yang mengubah karakter */
  effectiveTotal: number;
};

export type SolventReport = {
  rows: SolventRow[];
  /** total semua pelarut sebagai % formula, berbasis yang dituang */
  totalExplicitPct: number;
  totalEffectivePct: number;
};

/**
 * Melacak pelarut dari semua sumbernya sekaligus.
 *
 * Ini masalah yang paling tidak terlihat di spreadsheet: BB 10% yang
 * ditambahkan sebagai fixative, ditambah 4,5% yang ikut masuk karena Ambroxan
 * diencerkan dalam BB, ditambah 2,5% yang sudah ada di dalam "Indole 50 BB" —
 * totalnya 17%, bukan 10%. Tidak ada satu kolom pun di spreadsheet yang
 * menunjukkan itu.
 *
 * Bawaan supplier dipisahkan dari yang dituang, karena perlakuannya beda:
 * yang dituang bisa diturunkan dengan mengubah baris BB, yang bawaan hanya
 * bisa dikurangi dengan memakai bahan lain.
 */
export function solventReport(
  ctx: FormulaContext,
  items: ExpandedItem[],
): SolventReport {
  const rows = new Map<string, SolventRow>();

  const row = (solventId: string): SolventRow => {
    let r = rows.get(solventId);
    if (!r) {
      r = {
        solventId,
        name: ctx.materials.get(solventId)?.name ?? "(pelarut tidak dikenal)",
        directPct: 0,
        fromDilution: [],
        fromAccords: [],
        hiddenFromSupplier: [],
        explicitTotal: 0,
        effectiveTotal: 0,
      };
      rows.set(solventId, r);
    }
    return r;
  };

  const lineName = (lineId: string): string => {
    const line = ctx.version.lines.find((l) => l.id === lineId);
    if (!line) return "baris lain";
    if (line.kind === "accord") {
      return ctx.accords.get(line.refId)?.name ?? "accord";
    }
    return (
      ctx.materials.get(line.refId)?.name ??
      ctx.fos.get(line.refId)?.name ??
      "baris lain"
    );
  };

  for (const item of items) {
    if (item.kind !== "material") continue;
    const material = ctx.materials.get(item.refId);

    if (item.role === "user_solvent") {
      const r = row(item.refId);
      if (item.via.length) {
        r.fromAccords.push({
          accordName: item.via[item.via.length - 1],
          pct: item.productPct,
        });
      } else {
        r.fromDilution.push({
          lineName: lineName(item.sourceLineId),
          pct: item.productPct,
        });
      }
    } else if (material?.isSolvent) {
      // Pelarut yang ditambahkan langsung sebagai baris bahan biasa.
      const r = row(item.refId);
      if (item.via.length) {
        r.fromAccords.push({
          accordName: item.via[item.via.length - 1],
          pct: item.productPct,
        });
      } else {
        r.directPct += item.productPct;
      }
    }

    if (item.hiddenSolvent && item.hiddenSolvent.pct > 0) {
      const id = item.hiddenSolvent.solventId;
      if (id) {
        row(id).hiddenFromSupplier.push({
          materialName: material?.name ?? "(bahan)",
          pct: item.hiddenSolvent.pct,
        });
      }
    }
  }

  const out = [...rows.values()];
  for (const r of out) {
    r.explicitTotal =
      r.directPct +
      r.fromDilution.reduce((a, x) => a + x.pct, 0) +
      r.fromAccords.reduce((a, x) => a + x.pct, 0);
    r.effectiveTotal =
      r.explicitTotal + r.hiddenFromSupplier.reduce((a, x) => a + x.pct, 0);
  }
  out.sort((a, b) => b.effectiveTotal - a.effectiveTotal);

  return {
    rows: out,
    totalExplicitPct: out.reduce((a, r) => a + r.explicitTotal, 0),
    totalEffectivePct: out.reduce((a, r) => a + r.effectiveTotal, 0),
  };
}

/**
 * Berapa baris pelarut langsung harus diturunkan supaya total efektifnya pas
 * di target. Tidak pernah menyarankan angka negatif — kalau bawaan supplier
 * saja sudah melebihi target, baris langsungnya cuma bisa jadi nol.
 */
export function suggestDirectAdjustment(
  row: SolventRow,
  targetEffectivePct: number,
): { newDirectPct: number; reachable: boolean } {
  const excess = row.effectiveTotal - targetEffectivePct;
  const newDirectPct = Math.max(0, row.directPct - excess);
  return {
    newDirectPct,
    reachable: row.directPct - excess >= 0,
  };
}
