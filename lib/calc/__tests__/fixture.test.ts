import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { pickTier } from "../price";
import { fixture, fixtureContext } from "./fixture";

/**
 * Fixture 01 — satu formula nyata yang SEMUA angkanya sudah dihitung di luar
 * implementasi ini. Ini test yang paling menentukan di repo: kalau dia hijau,
 * seluruh rantai kalkulasi (alokasi → dilusi dua lapis → pembentangan →
 * kekuatan → pelarut → piramida nyata → pie → HPP) terbukti benar sekaligus.
 */

const ctx = fixtureContext();
const result = analyze(ctx);
const exp = fixture.expected;
const TOL_MONEY = fixture.tolerance.rupiahAndComposition;
const TOL_PCT = fixture.tolerance.strengthAndAroma;

const rowByName = (name: string) =>
  result.strength.rows.find((r) => r.name === name);

describe("fixture 01 — komposisi nyata", () => {
  it("tidak ada error pembentangan", () => {
    expect(result.error).toBeNull();
  });

  it.each(Object.entries(exp.productPct))(
    "%s -> %s%% produk",
    (name, expected) => {
      expect(rowByName(name)?.productPct).toBeCloseTo(expected, 2);
    },
  );

  it("Ambroxan 5% @10% jadi 0,5% di botol — bukan 5%", () => {
    expect(rowByName("Ambroxan")!.productPct).toBeCloseTo(0.5, 10);
  });

  it("Benzyl Benzoate menggabungkan baris langsung dan sisa dilusi Ambroxan", () => {
    // 10% diketik user + 4,5% ikut masuk dari dilusi Ambroxan
    expect(rowByName("Benzyl Benzoate")!.productPct).toBeCloseTo(14.5, 10);
    expect(rowByName("Benzyl Benzoate")!.weighPct).toBeCloseTo(10, 10);
  });

  it("total komposisi tepat 100%", () => {
    const total = result.items.reduce((a, i) => a + i.productPct, 0);
    expect(total).toBeCloseTo(100, 6);
  });
});

describe("fixture 01 — pelarut", () => {
  const bb = () =>
    result.solvents.rows.find((r) => r.name === "Benzyl Benzoate")!;

  it("BB terlacak dari tiga sumber berbeda", () => {
    const row = bb();
    const e = exp.solvents["Benzyl Benzoate"];
    expect(row.directPct).toBeCloseTo(e.direct, 2);
    expect(row.fromDilution.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(
      e.fromDilution,
      2,
    );
    expect(row.hiddenFromSupplier.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(
      e.hiddenFromSupplier,
      2,
    );
  });

  it("total efektif 17% — bukan 10% yang kelihatan di resep", () => {
    const e = exp.solvents["Benzyl Benzoate"];
    expect(bb().explicitTotal).toBeCloseTo(e.explicitTotal, 2);
    expect(bb().effectiveTotal).toBeCloseTo(e.effectiveTotal, 2);
  });

  it("pelarut bawaan supplier datang dari Indole 50 BB", () => {
    expect(bb().hiddenFromSupplier[0].materialName).toBe("Indole 50 BB");
  });
});

describe("fixture 01 — piramida nyata", () => {
  it.each(Object.entries(exp.realPyramidActive))(
    "tier %s aktif %s%%",
    (tier, expected) => {
      const row = result.realPyramid.find((r) => r.tier === tier)!;
      expect(row.active).toBeCloseTo(expected, 2);
    },
  );

  it("Base diset 60% tapi bahan aktifnya cuma 45,5%", () => {
    const base = result.realPyramid.find((r) => r.tier === "base")!;
    expect(base.target).toBe(60);
    expect(base.filled).toBeCloseTo(60, 6);
    expect(base.active).toBeCloseTo(45.5, 6);
  });
});

describe("fixture 01 — kekuatan", () => {
  it.each(Object.entries(exp.strengthPct))(
    "%s -> %s%% kekuatan",
    (name, expected) => {
      expect(rowByName(name)?.strengthPct).toBeCloseTo(expected, 1);
    },
  );

  it("total kekuatan 100%", () => {
    const total = result.strength.rows.reduce(
      (a, r) => a + (r.strengthPct ?? 0),
      0,
    );
    expect(total).toBeCloseTo(100, 6);
  });

  it("Indole 5% berat jadi 25,7% kekuatan — leverage 5x", () => {
    const indole = rowByName("Indole 50 BB")!;
    expect(indole.productPct).toBeCloseTo(5, 6);
    expect(indole.strengthPct!).toBeCloseTo(25.7, 1);
  });

  it("kekuatan Indole dihitung dari massa produk, bukan massa aktif", () => {
    // Kalau salah pakai massa aktif (2,5%), kekuatannya jatuh ke sekitar 14,8%
    expect(rowByName("Indole 50 BB")!.strengthPct!).toBeGreaterThan(20);
  });

  it("coverage 100% karena tidak ada FO", () => {
    expect(result.coverage).toBeCloseTo(100, 6);
    expect(result.strength.missingImpact).toEqual([]);
  });
});

describe("fixture 01 — pie dominasi aroma", () => {
  const got = (facet: string) =>
    result.aroma.all.slices.find((s) => s.facet === facet)?.pct ?? 0;

  it.each(
    Object.entries(exp.aromaTop6Pct).filter(([f]) => f !== "lainnya"),
  )("%s -> %s%%", (facet, expected) => {
    expect(got(facet)).toBeCloseTo(expected, 1);
  });

  it('"Lainnya" menampung sisanya', () => {
    expect(result.aroma.all.other).toBeCloseTo(
      exp.aromaTop6Pct.lainnya,
      TOL_PCT,
    );
  });

  it("maksimal 6 irisan + Lainnya", () => {
    expect(result.aroma.all.slices.length).toBeLessThanOrEqual(6);
  });

  it("pie per tier tersedia dan jumlahnya 100 tiap tier", () => {
    for (const tier of ["top", "mid", "base"] as const) {
      const all = result.aroma[tier];
      const total =
        all.slices.reduce((a, s) => a + s.pct, 0) + all.other;
      expect(total).toBeCloseTo(100, 4);
    }
  });
});

describe("fixture 01 — HPP", () => {
  it("tier harga 10 g untuk batch 10 g", () => {
    expect(result.cost.tier).toBe(fixture.input.priceTier);
  });

  it.each(Object.entries(exp.cost.rows))("biaya %s = Rp%s", (name, expected) => {
    const row = result.cost.rows.find((r) => r.name === name)!;
    expect(row.cost!).toBeCloseTo(expected, 2);
  });

  it("total batch dan per gram", () => {
    expect(result.cost.total).toBeCloseTo(exp.cost.total, TOL_MONEY);
    expect(result.cost.perGram).toBeCloseTo(exp.cost.perGram, TOL_MONEY);
  });

  it("pelarut bawaan supplier tidak dihargai dua kali", () => {
    // Indole dibeli sebagai cairan 50% — harganya sudah harga cairan itu.
    const indole = result.cost.rows.find((r) => r.name === "Indole 50 BB")!;
    expect(indole.grams).toBeCloseTo(0.5, 10);
  });

  it("tidak ada harga yang hilang atau diambil dari tier lain", () => {
    expect(result.cost.missing).toEqual([]);
    expect(result.cost.fallbackCount).toBe(0);
  });
});

describe("fixture 01 — ganti ukuran batch", () => {
  it("3 g: persen tetap, tier tetap 10 g, biaya 0,3x", () => {
    const small = analyze(fixtureContext(3));
    expect(small.cost.tier).toBe(exp.scaling.batch3g.tier);
    expect(small.cost.total).toBeCloseTo(exp.scaling.batch3g.total!, TOL_MONEY);

    // persen tidak boleh berubah sama sekali
    for (const row of small.strength.rows) {
      expect(row.productPct).toBeCloseTo(rowByName(row.name)!.productPct, 10);
    }
  });

  it("120 g: naik ke tier 100 g", () => {
    expect(analyze(fixtureContext(120)).cost.tier).toBe(
      exp.scaling.batch120g.tier,
    );
  });

  it("aturan tier harga sesuai tabel settings", () => {
    const s = ctx.settings;
    expect(pickTier(3, s)).toBe(10);
    expect(pickTier(30, s)).toBe(10);
    expect(pickTier(49.9, s)).toBe(10);
    expect(pickTier(50, s)).toBe(50);
    expect(pickTier(120, s)).toBe(100);
    expect(pickTier(600, s)).toBe(500);
  });

  it("override per formula mengalahkan aturan", () => {
    expect(pickTier(10, ctx.settings, 500)).toBe(500);
  });
});

describe("fixture 01 — peringatan", () => {
  const codes = () => result.warnings.map((w) => w.code);

  it("R3 — BB datang dari banyak sumber", () => {
    const w = result.warnings.find((x) => x.code === "R3")!;
    expect(w.message).toContain("Benzyl Benzoate");
    expect(w.message).toContain("3 sumber");
  });

  it("R4 — BB di atas ambang 10%", () => {
    const w = result.warnings.find(
      (x) => x.code === "R4" && x.message.includes("Benzyl Benzoate"),
    )!;
    expect(w).toBeDefined();
    expect(w.action).toMatchObject({ kind: "adjust_solvent" });
  });

  it("R5 — Indole mendominasi", () => {
    const w = result.warnings.find(
      (x) => x.code === "R5" && x.message.includes("Indole"),
    );
    expect(w).toBeDefined();
  });

  it("R8 — Base aktif jauh di bawah target", () => {
    const w = result.warnings.find((x) => x.code === "R8")!;
    expect(w.message).toContain("Base");
    expect(w.message).toContain("45,5");
  });

  it("tidak ada R1/R2 — piramida dan tiap tier pas", () => {
    expect(codes()).not.toContain("R1");
    expect(codes()).not.toContain("R2");
  });

  it("tidak ada R6/R9/R10/R11 — data lengkap, tanpa FO, tanpa accord", () => {
    for (const code of ["R6", "R9", "R10", "R11"]) {
      expect(codes()).not.toContain(code);
    }
  });

  it("tidak ada yang memblokir simpan", () => {
    expect(result.warnings.some((w) => w.level === "critical")).toBe(false);
  });
});

describe("fixture 01 — bridger", () => {
  const pair = (a: string, b: string) =>
    result.bridges.crossTier.find(
      (x) => x.pair[0] === a && x.pair[1] === b,
    )!;

  it.each([
    ["top", "mid", "topMid"],
    ["mid", "base", "midBase"],
    ["top", "base", "topBase"],
  ])("similarity %s ↔ %s", (a, b, key) => {
    const e = exp.bridges.crossTier[key];
    expect(pair(a, b).sim).toBeCloseTo(e.sim, 2);
    expect(pair(a, b).status).toBe(e.status);
  });

  it("saran Top ↔ Mid persis seperti acuan", () => {
    expect(pair("top", "mid").suggestions.map((s) => s.name)).toEqual(
      exp.bridges.crossTier.topMid.top5,
    );
  });

  it("saran Mid ↔ Base persis seperti acuan", () => {
    expect(pair("mid", "base").suggestions.map((s) => s.name)).toEqual(
      exp.bridges.crossTier.midBase.top5,
    );
  });

  it("bahan yang sudah ada di formula tidak disarankan ulang", () => {
    const used = new Set(result.strength.rows.map((r) => r.name));
    for (const p of result.bridges.crossTier) {
      for (const s of p.suggestions) expect(used.has(s.name)).toBe(false);
    }
  });

  it("dosis awal mengikuti kekuatan bahannya", () => {
    // Fixture tidak menentukan angka dosis, jadi yang diuji hubungannya:
    // makin keras bahannya, makin kecil dosis awalnya. Bahan tanpa impact
    // tidak ikut — untuk dia dosisnya memang tidak dihitung.
    const scored = pair("top", "mid")
      .suggestions.filter((s) => s.impact != null)
      .sort((a, b) => a.impact! - b.impact!);

    expect(scored.length).toBeGreaterThan(1);
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i].starterDose).toBeLessThanOrEqual(
        scored[i - 1].starterDose,
      );
    }
  });

  it("dosis awal selalu angka yang wajar ditimbang", () => {
    const steps = [0.1, 0.25, 0.5, 1, 2, 5];
    for (const p of result.bridges.crossTier) {
      for (const s of p.suggestions) expect(steps).toContain(s.starterDose);
    }
  });
});
