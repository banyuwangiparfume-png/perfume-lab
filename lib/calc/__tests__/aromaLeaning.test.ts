import { describe, expect, it } from "vitest";
import { aromaShares } from "../aroma";
import type { ExpandedItem, Material } from "../types";

const material = (
  id: string,
  facets: Record<string, number>,
  impact = 50,
): Material =>
  ({
    id,
    name: id,
    facets,
    impact,
    supplierDilutionPct: null,
  }) as unknown as Material;

const item = (refId: string, productPct: number): ExpandedItem =>
  ({
    kind: "material",
    refId,
    tier: "mid",
    productPct,
    activePct: productPct,
    strengthBasisPct: productPct,
    role: "ingredient",
    via: [],
  }) as unknown as ExpandedItem;

describe("kecondongan irisan aroma", () => {
  it("menyebut arah lain yang dibawa penyumbang irisan", () => {
    const materials = new Map([
      ["a", material("a", { floral: 0.6, fruity: 0.4 })],
      ["b", material("b", { floral: 0.5, green: 0.5 })],
    ]);
    const shares = aromaShares([item("a", 50), item("b", 50)], materials);

    const floral = shares.find((s) => s.facet === "floral")!;
    const keys = floral.leaning.map((l) => l.facet);
    expect(keys).toContain("fruity");
    expect(keys).toContain("green");
    // Yang menentukan urutan bukan besar sumbangannya ke floral, tapi berapa
    // banyak arah lain yang ikut terbawa: a menyumbang 50 × 0,6 × 0,4 = 12
    // fruity, b menyumbang 50 × 0,5 × 0,5 = 12,5 green.
    expect(floral.leaning[0].facet).toBe("green");
  });

  it("persennya relatif terhadap irisannya sendiri, bukan seluruh formula", () => {
    // Satu bahan saja: seluruh irisan floral berasal darinya, jadi arahnya
    // 100% fruity — walaupun fruity cuma sebagian kecil formula.
    const materials = new Map([
      ["a", material("a", { floral: 0.9, fruity: 0.1 })],
    ]);
    const shares = aromaShares([item("a", 100)], materials);
    const floral = shares.find((s) => s.facet === "floral")!;

    expect(floral.leaning).toHaveLength(1);
    expect(floral.leaning[0].facet).toBe("fruity");
    // Besarannya dipertahankan: tiap satuan floral cuma membawa 0,1/0,9 fruity.
    expect(floral.leaning[0].pct).toBeCloseTo((0.1 / 1) * 100, 6);
  });

  it("bahan berfacet tunggal mengencerkan kecondongan, bukan dihitung nol", () => {
    // Setengah floral datang dari bahan murni yang tidak punya arah lain.
    // Jawaban yang benar: arahnya cuma separuh, bukan penuh.
    const materials = new Map([
      ["murni", material("murni", { floral: 1 })],
      ["campur", material("campur", { floral: 0.5, woody: 0.5 })],
    ]);
    const shares = aromaShares(
      [item("murni", 50), item("campur", 100)],
      materials,
    );
    const floral = shares.find((s) => s.facet === "floral")!;

    // murni menyumbang 50 ke floral tanpa arah apa pun; campur menyumbang 50
    // sambil membawa woody 0,5 per satuan. Jadi 50 × 0,5 / 100 = 25%.
    expect(floral.leaning[0].facet).toBe("woody");
    expect(floral.leaning[0].pct).toBeCloseTo(25, 6);
  });

  it("arah yang terlalu tipis tidak disebut", () => {
    const materials = new Map([
      ["a", material("a", { floral: 0.97, musk: 0.03 })],
    ]);
    const shares = aromaShares([item("a", 100)], materials);
    expect(shares.find((s) => s.facet === "floral")!.leaning).toEqual([]);
  });

  it("maksimal tiga arah, diurutkan dari yang terkuat", () => {
    const materials = new Map([
      [
        "a",
        material("a", {
          floral: 0.5,
          fruity: 0.2,
          green: 0.15,
          woody: 0.1,
          musk: 0.05,
        }),
      ],
    ]);
    const shares = aromaShares([item("a", 100)], materials);
    const floral = shares.find((s) => s.facet === "floral")!;

    expect(floral.leaning.map((l) => l.facet)).toEqual([
      "fruity",
      "green",
      "woody",
    ]);
  });

  it("bahan tanpa arah lain tidak menghasilkan kecondongan sama sekali", () => {
    const materials = new Map([["a", material("a", { woody: 1 })]]);
    const shares = aromaShares([item("a", 100)], materials);
    expect(shares[0].leaning).toEqual([]);
  });
});
