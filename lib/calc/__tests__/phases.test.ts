import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { PHASE_PRESENCE, phaseReport } from "../phases";
import type { ExpandedItem, FormulaContext, Material } from "../types";
import { fixtureContext } from "./fixture";

const material = (
  id: string,
  facets: Record<string, number>,
  extra: Partial<Material> = {},
): Material =>
  ({
    id,
    name: id,
    facets,
    impact: 100,
    impactBasis: "as_sold",
    supplierDilutionPct: 100,
    isSolvent: false,
    noteTierHint: null,
    ...extra,
  }) as unknown as Material;

const item = (
  refId: string,
  pct: number,
  tier: ExpandedItem["tier"],
): ExpandedItem => ({
  kind: "material",
  refId,
  tier,
  role: "ingredient",
  productPct: pct,
  activePct: pct,
  strengthBasisPct: pct,
  via: [],
  sourceLineId: refId,
});

const ctxWith = (
  materials: Material[],
  pyramid = true,
): FormulaContext =>
  ({
    materials: new Map(materials.map((m) => [m.id, m])),
    version: { pyramid: pyramid ? { top: 20, mid: 30, base: 50 } : null },
  }) as unknown as FormulaContext;

/** mangga di Top, kamboja di Mid, guaiac di Base — contoh dari diskusi */
const mangoCase = () => {
  const ctx = ctxWith([
    material("mangga", { fruity: 1 }, { impact: 300 }),
    material("kamboja", { white: 1 }, { impact: 150 }),
    material("guaiac", { woody: 0.8, smoky: 0.6 }, { impact: 40 }),
  ]);
  const items = [
    item("mangga", 15, "top"),
    item("kamboja", 25, "mid"),
    item("guaiac", 60, "base"),
  ];
  return phaseReport(ctx, items);
};

const phase = (r: ReturnType<typeof phaseReport>, key: string) =>
  r.phases.find((p) => p.key === key)!;

describe("kekuatan per fase", () => {
  it("tiap fase tier-nya berjumlah 100", () => {
    for (const p of mangoCase().phases) {
      expect(p.tiers.top + p.tiers.mid + p.tiers.base).toBeCloseTo(100, 6);
    }
  });

  it("tiap fase dimenangkan tier-nya sendiri pada formula yang seimbang", () => {
    const r = mangoCase();
    expect(phase(r, "opening").rows[0].name).toBe("mangga");
    expect(phase(r, "heart").rows[0].name).toBe("kamboja");
    expect(phase(r, "drydown").rows[0].name).toBe("guaiac");
  });

  it("Base tetap hadir di Opening — dia sudah ada sejak semprotan pertama", () => {
    expect(phase(mangoCase(), "opening").tiers.base).toBeGreaterThan(0);
  });

  it("Top tidak tersisa sama sekali di Drydown", () => {
    expect(phase(mangoCase(), "drydown").tiers.top).toBe(0);
    expect(PHASE_PRESENCE.drydown.top).toBe(0);
  });

  it("menghitung porsi persis dari kekuatan × kehadiran", () => {
    // Opening: mangga 15×300×1 = 4500; kamboja 25×150×0,6 = 2250;
    // guaiac 60×40×0,3 = 720. Total 7470.
    const opening = phase(mangoCase(), "opening");
    expect(opening.tiers.top).toBeCloseTo((4500 / 7470) * 100, 6);
    expect(opening.tiers.base).toBeCloseTo((720 / 7470) * 100, 6);
  });

  it("profil facet tiap fase mengikuti siapa yang paling keras", () => {
    const r = mangoCase();
    expect(phase(r, "opening").facets[0].facet).toBe("fruity");
    expect(phase(r, "heart").facets[0].facet).toBe("white");
    expect(phase(r, "drydown").facets[0].facet).toBe("woody");
  });
});

describe("catatan per fase", () => {
  it("memberi tahu kalau Base terlalu keras di pembukaan", () => {
    const ctx = ctxWith([
      material("mangga", { fruity: 1 }, { impact: 50 }),
      material("guaiac", { woody: 1 }, { impact: 400 }),
    ]);
    const r = phaseReport(ctx, [item("mangga", 20, "top"), item("guaiac", 80, "base")]);
    expect(phase(r, "opening").notes.join(" ")).toMatch(/Base sudah/);
  });

  it("memberi tahu kalau Top kalah oleh Mid di pembukaan", () => {
    const ctx = ctxWith([
      material("mangga", { fruity: 1 }, { impact: 20 }),
      material("kamboja", { white: 1 }, { impact: 400 }),
    ]);
    const r = phaseReport(ctx, [item("mangga", 20, "top"), item("kamboja", 80, "mid")]);
    expect(phase(r, "opening").notes.join(" ")).toMatch(/Top cuma/);
  });

  it("formula yang seimbang tidak diberi catatan", () => {
    for (const p of mangoCase().phases) expect(p.notes).toEqual([]);
  });

  it("formula tanpa Top tidak diomeli soal Top yang pelan", () => {
    const ctx = ctxWith([material("kamboja", { white: 1 })]);
    const r = phaseReport(ctx, [item("kamboja", 100, "mid")]);
    expect(phase(r, "opening").notes.join(" ")).not.toMatch(/Top cuma/);
  });
});

describe("tanpa piramida", () => {
  it("memakai kebiasaan bahan, lalu Mid kalau itu kosong", () => {
    const ctx = ctxWith(
      [
        material("jeruk", { citrus: 1 }, { noteTierHint: "top" }),
        material("tanpa", { floral: 1 }),
      ],
      false,
    );
    const r = phaseReport(ctx, [item("jeruk", 50, "all"), item("tanpa", 50, "all")]);
    const opening = phase(r, "opening");
    expect(opening.rows.find((x) => x.refId === "jeruk")?.tier).toBe("top");
    expect(opening.rows.find((x) => x.refId === "tanpa")?.tier).toBe("mid");
    expect(r.fromPyramid).toBe(false);
  });
});

describe("lewat analyze()", () => {
  it("pelarut tidak ikut dihitung", () => {
    const c = fixtureContext();
    const r = analyze(c);
    for (const p of r.phases.phases) {
      for (const row of p.rows) {
        expect(c.materials.get(row.refId)?.isSolvent).toBeFalsy();
      }
    }
  });

  it("porsi bahan di tiap fase berjumlah 100", () => {
    const r = analyze(fixtureContext());
    for (const p of r.phases.phases) {
      const sum = p.rows.reduce((a, x) => a + x.pct, 0);
      expect(sum).toBeCloseTo(100, 6);
    }
  });
});
