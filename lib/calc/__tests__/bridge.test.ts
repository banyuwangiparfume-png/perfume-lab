import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../settings";
import {
  bridgeStatus,
  recommendTier,
  sim,
  starterDose,
  suggestBridges,
  topFacets,
} from "../bridge";
import type { FormulaContext, Material } from "../types";
import { analyze } from "../analyze";
import { linesAfterAdd, withLines } from "../simulate";
import { allMaterials, bridgeRules, fixtureContext, materialNamed } from "./fixture";

const ctx: FormulaContext = {
  version: {
    id: "v",
    batchG: 10,
    pyramid: null,
    priceTierOverride: null,
    lines: [],
  },
  materials: allMaterials(),
  accords: new Map(),
  fos: new Map(),
  bridgeRules: bridgeRules(),
  stock: new Set(),
  settings: DEFAULT_SETTINGS,
};

const facetsOf = (name: string) => materialNamed(name)!.facets;

describe("sim & status", () => {
  it("vektor identik = 1", () => {
    const v = facetsOf("Bergamot Oil Italy FCF");
    expect(sim(v, v)).toBeCloseTo(1, 3);
  });

  it("vektor tanpa facet yang sama = 0", () => {
    expect(sim({ citrus: 1 }, { woody: 1 })).toBe(0);
  });

  it("ambang status dari settings", () => {
    const t = DEFAULT_SETTINGS.bridgeThresholds;
    expect(bridgeStatus(0.5, t)).toBe("connected");
    expect(bridgeStatus(0.45, t)).toBe("connected");
    expect(bridgeStatus(0.3, t)).toBe("loose");
    expect(bridgeStatus(0.2, t)).toBe("loose");
    expect(bridgeStatus(0.19, t)).toBe("gap");
  });

  it("topFacets hanya mengambil arah yang cukup kuat", () => {
    expect(topFacets({ citrus: 0.9, floral: 0.2, green: 0.31 })).toEqual(
      new Set(["citrus", "green"]),
    );
  });
});

describe("suggestBridges — Bergamot ↔ Rose Oxide", () => {
  const a = facetsOf("Bergamot Oil Italy FCF");
  const b = facetsOf("Rose Oxide");
  const result = suggestBridges(a, b, ctx, new Set(), { limit: 5 });

  it("Linalool di urutan pertama", () => {
    expect(result[0].name).toBe("Linalool");
  });

  it("alasannya ikut dibawa", () => {
    expect(result[0].reason.length).toBeGreaterThan(0);
  });

  it("skor menurun", () => {
    for (let i = 1; i < result.length; i++) {
      expect(result[i].score).toBeLessThanOrEqual(result[i - 1].score);
    }
  });

  it("bahan yang dikecualikan tidak muncul", () => {
    const linaloolId = result[0].materialId;
    const without = suggestBridges(a, b, ctx, new Set([linaloolId]), {
      limit: 5,
    });
    expect(without.map((s) => s.name)).not.toContain("Linalool");
  });

  it("filter stok mengosongkan hasil kalau stok kosong", () => {
    expect(
      suggestBridges(a, b, ctx, new Set(), { onlyStock: true }),
    ).toEqual([]);
  });

  it("filter stok mengembalikan hanya yang distok", () => {
    const linaloolId = result[0].materialId;
    const stocked: FormulaContext = {
      ...ctx,
      stock: new Set([linaloolId]),
    };
    const out = suggestBridges(a, b, stocked, new Set(), { onlyStock: true });
    expect(out.map((s) => s.name)).toEqual(["Linalool"]);
    expect(out[0].inStock).toBe(true);
  });
});

describe("dosis awal & tier tujuan", () => {
  const mk = (over: Partial<Material>): Material => ({
    id: "x",
    name: "X",
    category: null,
    functionSource: "supplier",
    impact: 100,
    impactBasis: "as_sold",
    supplierDilutionPct: 100,
    supplierSolventId: null,
    facets: {},
    functionCategory: null,
    noteTierHint: null,
    isBridgeCandidate: true,
    isSolvent: false,
    prices: {},
    ...over,
  });

  describe("dosis awal dibalik dari porsi kekuatan", () => {
    // Satu formula dengan total kekuatan 1000 unit. Target 3% kekuatan berarti
    // skor yang dicari = 0,03/0,97 x 1000 = 30,9 unit.
    const total = 1000;

    it("makin lemah bahannya, makin besar dosis awalnya", () => {
      const lemah = starterDose(mk({ impact: 20 }), { totalScore: total });
      const sedang = starterDose(mk({ impact: 100 }), { totalScore: total });
      const keras = starterDose(mk({ impact: 500 }), { totalScore: total });

      expect(lemah).toBeGreaterThan(sedang);
      expect(sedang).toBeGreaterThan(keras);
    });

    it("hasilnya selalu angka yang wajar ditimbang", () => {
      const steps = [0.1, 0.25, 0.5, 1, 2, 5];
      for (const impact of [5, 20, 40, 100, 150, 350, 800, 5000]) {
        expect(steps).toContain(
          starterDose(mk({ impact }), { totalScore: total }),
        );
      }
    });

    it("tidak pernah mengusulkan bridger sebagai bahan utama", () => {
      // Bahan sangat lemah di formula sangat kuat: tanpa batas atas, rumusnya
      // bisa mengusulkan puluhan persen.
      expect(
        starterDose(mk({ impact: 1 }), { totalScore: 100000 }),
      ).toBeLessThanOrEqual(5);
    });

    it("bahan tanpa data impact tetap 1% — bukan ditebak", () => {
      expect(starterDose(mk({ impact: null }), { totalScore: total })).toBe(1);
    });

    it("formula kosong tetap 1%, bukan pembagian nol", () => {
      expect(starterDose(mk({ impact: 100 }), { totalScore: 0 })).toBe(1);
      expect(starterDose(mk({ impact: 100 }))).toBe(1);
    });

    it("dosisnya ikut formula, bukan cuma ikut bahannya", () => {
      // Pertanyaan yang tidak bisa dijawab aturan dua bucket: menjembatani
      // formula yang ramai butuh lebih banyak daripada yang sepi.
      const sepi = starterDose(mk({ impact: 100 }), { totalScore: 200 });
      const ramai = starterDose(mk({ impact: 100 }), { totalScore: 5000 });
      expect(ramai).toBeGreaterThan(sepi);
    });
  });

  it("Top ↔ Mid selalu masuk ke Mid", () => {
    expect(recommendTier(mk({}), ["top", "mid"])).toBe("mid");
  });

  it("Mid ↔ Base ikut kebiasaan bahannya", () => {
    expect(recommendTier(mk({ noteTierHint: "mid" }), ["mid", "base"])).toBe(
      "mid",
    );
    expect(recommendTier(mk({ noteTierHint: "base" }), ["mid", "base"])).toBe(
      "base",
    );
    expect(recommendTier(undefined, ["mid", "base"])).toBe("base");
  });

  it("bahan ber-hint top diantar ke Mid, bukan Base", () => {
    // Linalool: family Citrus, jadi hint-nya "top". Menaruhnya di Base adalah
    // yang terburuk dari dua pilihan — tidak bertahan di sana, dan jauh dari
    // tempat asalnya.
    expect(recommendTier(mk({ noteTierHint: "top" }), ["mid", "base"])).toBe(
      "mid",
    );
  });
});

describe("saran bridger membawa tier tujuannya sendiri", () => {
  const ctx = fixtureContext();
  const result = analyze(ctx);

  it("tiap saran punya tier, bukan satu tier untuk seluruh pasangan", () => {
    const pairs = result.bridges.crossTier.filter((p) => p.suggestions.length);
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      for (const s of pair.suggestions) {
        expect(["top", "mid", "base"]).toContain(s.tier);
      }
    }
  });

  it("Mid↔Base: bahan ber-hint mid masuk Mid, sisanya Base", () => {
    // Ini aturan PRD v2 §6 B.A, dan inti dari laporan user: bridger yang
    // ditambahkan harus mendarat di tier yang sesuai catatannya sendiri —
    // bukan di tier yang sama untuk semua saran.
    const pair = result.bridges.crossTier.find(
      (p) => p.pair[0] === "mid" && p.pair[1] === "base",
    );
    expect(pair).toBeDefined();

    for (const s of pair!.suggestions) {
      const hint = ctx.materials.get(s.materialId)?.noteTierHint;
      expect(s.tier).toBe(hint === "mid" ? "mid" : "base");
    }
  });

  it("Top↔Mid selalu ke Mid, apa pun hint bahannya", () => {
    const pair = result.bridges.crossTier.find(
      (p) => p.pair[0] === "top" && p.pair[1] === "mid",
    );
    expect(pair).toBeDefined();
    for (const s of pair!.suggestions) expect(s.tier).toBe("mid");
  });

  it("Top↔Base jatuh ke Mid — jembatan antara ujung duduk di tengah", () => {
    const pair = result.bridges.crossTier.find(
      (p) => p.pair[0] === "top" && p.pair[1] === "base",
    );
    expect(pair).toBeDefined();
    for (const s of pair!.suggestions) expect(s.tier).toBe("mid");
  });
});

describe("kepaduan tier menggantikan perbandingan antar pasangan", () => {
  const ctx = fixtureContext();
  const result = analyze(ctx);

  it("satu entri per tier, bukan satu per pasangan bahan", () => {
    // Inti perbaikannya. Model pasangan menghasilkan n(n-1)/2 entri dan tiap
    // bridger yang ditambahkan membuat pasangan renggang yang baru — daftarnya
    // tidak pernah habis.
    const tiers = result.bridges.withinTier.map((t) => t.tier);
    expect(new Set(tiers).size).toBe(tiers.length);
    expect(tiers.length).toBeLessThanOrEqual(3);
  });

  it("tier dengan kurang dari dua bahan berfacet dilewati", () => {
    const thin = fixtureContext();
    thin.version.lines = thin.version.lines.filter((l) => l.tier === "top").slice(0, 1);
    expect(analyze(thin).bridges.withinTier).toHaveLength(0);
  });

  it("outlier adalah bahan yang paling jauh dari gabungan bahan lain", () => {
    for (const t of result.bridges.withinTier) {
      if (!t.outlier) continue;
      const lines = ctx.version.lines.filter(
        (l) => l.tier === t.tier && l.kind !== "fo",
      );
      expect(lines.map((l) => l.id)).toContain(t.outlier.lineId);
      expect(t.outlier.sim).toBeLessThanOrEqual(t.cohesion + 1e-9);
    }
  });

  it("tier yang sehat tidak menunjuk bahan menyendiri, tapi tetap boleh dipadukan", () => {
    // Bahan "paling tidak mirip" di tier yang sehat bukan masalah — kontras
    // itu cara membuat accord menarik — jadi dia tidak disebut menyendiri.
    // Saran tetap ditawarkan (dibuka lewat "Padukan"), dengan perkiraan
    // kepaduan setelahnya.
    for (const t of result.bridges.withinTier) {
      if (t.status === "connected") expect(t.outlier).toBeNull();
      for (const sg of t.suggestions) {
        expect(sg.after).toBeGreaterThanOrEqual(0);
        expect(sg.after).toBeLessThanOrEqual(1);
      }
    }
  });

  it("sarannya masuk ke tier itu sendiri", () => {
    for (const t of result.bridges.withinTier) {
      for (const sg of t.suggestions) expect(sg.tier).toBe(t.tier);
    }
  });

  it("tidak menyarankan bahan yang sudah ada di formula", () => {
    const used = new Set(ctx.version.lines.map((l) => l.refId));
    for (const t of result.bridges.withinTier) {
      for (const sg of t.suggestions) expect(used.has(sg.materialId)).toBe(false);
    }
  });
});

describe("tier kosong bukan jurang", () => {
  it("pasangan dengan sisi kosong ditandai belum bisa dinilai", () => {
    // Alur nyata: user mengisi Top dulu, Mid dan Base masih kosong. Melaporkan
    // "Jurang 0%" di sana menyuruh memperbaiki transisi yang belum ada.
    const ctx = fixtureContext();
    ctx.version.lines = ctx.version.lines.filter((l) => l.tier === "top");
    const result = analyze(ctx);

    const topMid = result.bridges.crossTier.find(
      (p) => p.pair[0] === "top" && p.pair[1] === "mid",
    );
    expect(topMid?.comparable).toBe(false);
    expect(topMid?.suggestions).toHaveLength(0);
  });

  it("pasangan yang kedua sisinya terisi tetap dinilai seperti biasa", () => {
    const result = analyze(fixtureContext());
    for (const pair of result.bridges.crossTier) {
      expect(pair.comparable).toBe(true);
    }
  });
});

describe("perkiraan skor setelah dipadukan", () => {
  it("saran antar tier: sama persis dengan kemiripan setelah bahannya benar-benar ditambahkan", () => {
    const c = fixtureContext();
    const before = analyze(c);
    const pair = before.bridges.crossTier.find((p) => p.suggestions.length > 0)!;
    const sg = pair.suggestions[0];

    // Lewat alur tombol "+ Tier" yang sebenarnya: baris terbuka di tier
    // tujuan ikut dibagi ulang.
    const applied = withLines(
      c,
      linesAfterAdd(c, { kind: "raw_material", refId: sg.materialId }, sg.tier, sg.starterDose),
    );
    const after = analyze(applied).bridges.crossTier.find(
      (p) => p.pair[0] === pair.pair[0] && p.pair[1] === pair.pair[1],
    )!;
    expect(sg.after).toBeCloseTo(after.sim, 6);
  });

  it("saran dalam tier: sama persis dengan kepaduan setelah bahannya ditambahkan", () => {
    const c = fixtureContext();
    const before = analyze(c);
    const t = before.bridges.withinTier.find((x) => x.suggestions.length > 0)!;
    const sg = t.suggestions[0];

    c.version.lines.push({
      id: "padukan-uji",
      tier: t.tier,
      kind: "raw_material",
      refId: sg.materialId,
      pct: sg.starterDose,
      locked: true,
      userDilutionPct: 100,
      userSolventId: null,
    });
    const after = analyze(c).bridges.withinTier.find((x) => x.tier === t.tier)!;
    expect(sg.after).toBeCloseTo(after.cohesion, 6);
  });
});
