import { DEFAULT_SETTINGS } from "../../settings";
import { expand } from "../expand";
import type { FormulaContext, Line, Material, Pyramid, Tier } from "../types";

/** Bahan uji: kosongkan yang tidak relevan, sisanya bawaan yang netral. */
export const mat = (id: string, extra: Partial<Material> = {}): Material =>
  ({
    id,
    name: id,
    category: null,
    facets: { woody: 1 },
    impact: 100,
    impactBasis: "as_sold",
    supplierDilutionPct: 100,
    supplierSolventId: null,
    isSolvent: false,
    functionCategory: "modifier",
    functionSource: "supplier",
    noteTierHint: null,
    isBridgeCandidate: false,
    prices: {},
    ...extra,
  }) as Material;

export type LineSpec = {
  refId: string;
  pct: number;
  tier?: Tier;
  /** bawaan terkunci — supaya persen di tes tidak dibagi ulang diam-diam */
  locked?: boolean;
};

/**
 * Formula uji lengkap — baris, piramida, stok — supaya simulator aksi editor
 * (yang membagi ulang baris terbuka di tier) bisa berjalan seperti aslinya.
 */
export function makeCtx(
  materials: Material[],
  lines: LineSpec[],
  opts: { pyramid?: Pyramid | null; stock?: string[] } = {},
) {
  const ctx: FormulaContext = {
    version: {
      id: "uji",
      batchG: 10,
      pyramid: opts.pyramid ?? null,
      priceTierOverride: null,
      lines: lines.map(
        (l, i): Line => ({
          id: `L${i}-${l.refId}`,
          tier: l.tier ?? "mid",
          kind: "raw_material",
          refId: l.refId,
          pct: l.pct,
          locked: l.locked ?? true,
          userDilutionPct: 100,
          userSolventId: null,
          sortOrder: i,
        }),
      ),
    },
    materials: new Map(materials.map((m) => [m.id, m])),
    accords: new Map(),
    fos: new Map(),
    bridgeRules: [],
    stock: new Set(opts.stock ?? []),
    settings: DEFAULT_SETTINGS,
  };
  return { ctx, items: expand(ctx) };
}
