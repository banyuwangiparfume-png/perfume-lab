import { describe, expect, it } from "vitest";
import { facetDrilldown } from "../drilldown";
import { OTHER_SUBNOTE, classifySubnote } from "../subnotes";
import { makeCtx, mat } from "./ctxHelper";

describe("sub-aroma", () => {
  it("nama produk menentukan lebih dulu", () => {
    expect(classifySubnote("woody", "Methyl Cedryl Ketone / Vertofix Coeur | | woody, amber, dry")).toBe("cedarwood");
    expect(classifySubnote("woody", "Iso E Super / Amber Fleur Pure Concentrate | | woody, ambery, velvet")).toBe("ambery-woods");
    expect(classifySubnote("woody", "Javanol | | sandalwood, creamy")).toBe("sandalwood");
    expect(classifySubnote("woody", "Sandaswseet / Sandalore | | ")).toBe("sandalwood");
    expect(classifySubnote("woody", "Vetiver Oil Java | | earthy, smoky")).toBe("vetiver");
  });

  it("kalau nama tidak menyebut, deskriptor paling awal di odour profile menang", () => {
    expect(classifySubnote("woody", "Bacdanol | | sandalwood, cedar, creamy")).toBe("sandalwood");
    expect(classifySubnote("woody", "Woody X | | cedar, then sandalwood")).toBe("cedarwood");
  });

  it("kata kunci dicocokkan sebagai kata utuh", () => {
    // "cigar" bukan agar(wood), "rosemary" bukan rose, "sublime" bukan lime
    expect(classifySubnote("woody", "Brown note | | cigar, honey")).not.toBe("oud");
    expect(classifySubnote("floral", "Rosemary Oil | | herbal, camphor")).toBe(OTHER_SUBNOTE);
    expect(classifySubnote("citrus", "X | | sublime fresh")).toBe(OTHER_SUBNOTE);
  });

  it("awalan yang disengaja tetap menangkap turunannya", () => {
    expect(classifySubnote("woody", "Cedrol | | ")).toBe("cedarwood");
    expect(classifySubnote("woody", "Cedryl Acetate | | ")).toBe("cedarwood");
  });

  it("yang tidak cocok masuk kelompok lain, tidak ditebak", () => {
    expect(classifySubnote("woody", "Amberwood?? no | | warm")).toBe("ambery-woods");
    expect(classifySubnote("woody", "Mystery | | warm, dry")).toBe(OTHER_SUBNOTE);
  });
});

describe("drill-down irisan", () => {
  const materials = [
    mat("sandal", { name: "Javanol", facets: { woody: 1 } }),
    mat("cedar", { name: "Vertofix", facets: { woody: 0.8, amber: 0.6 } }),
    mat("cedar2", { name: "Cedramber", facets: { woody: 1 } }),
    mat("rose", { name: "Rose oil", facets: { floral: 1 } }),
  ];
  const { ctx, items } = makeCtx(materials, [
    { refId: "sandal", pct: 10 },
    { refId: "cedar", pct: 20 },
    { refId: "cedar2", pct: 10 },
    { refId: "rose", pct: 60 },
  ]);
  const text = (id: string) => ctx.materials.get(id)!.name;
  const d = facetDrilldown(items, ctx.materials, "woody", text);

  it("dikelompokkan per sub-aroma dan berjumlah 100% dari irisannya", () => {
    expect(d.bySubnote).toBe(true);
    expect(d.groups.map((g) => g.key).sort()).toEqual(["cedarwood", "sandalwood"]);
    expect(d.groups.reduce((a, g) => a + g.pct, 0)).toBeCloseTo(100, 8);
  });

  it("bahan dalam satu kelompok tercantum dengan porsinya sendiri", () => {
    const cedar = d.groups.find((g) => g.key === "cedarwood")!;
    expect(cedar.materials.map((m) => m.refId).sort()).toEqual(["cedar", "cedar2"]);
    expect(cedar.pct).toBeCloseTo(cedar.materials.reduce((a, m) => a + m.pct, 0), 8);
  });

  it("facet tanpa kamus dipecah per bahan", () => {
    const { ctx: c, items: it2 } = makeCtx(
      [mat("a", { facets: { aquatic: 1 } }), mat("b", { facets: { aquatic: 1 } })],
      [{ refId: "a", pct: 30 }, { refId: "b", pct: 70 }],
    );
    const x = facetDrilldown(it2, c.materials, "aquatic", (id) => id);
    expect(x.bySubnote).toBe(false);
    expect(x.groups.map((g) => g.key)).toEqual(["b", "a"]);
  });

  it("irisan yang tidak ada mengembalikan daftar kosong", () => {
    expect(facetDrilldown(items, ctx.materials, "smoky", text).groups).toEqual([]);
  });
});

describe("kasus dari stok asli", () => {
  it.each([
    ["Linalool | | citrus floral sweet bois de rose woody", "woody", "rosewood"],
    ["Kephalis Giv | | woody woody old wood amber tobacco herbal", "woody", "smoky"],
    ["Russian Leather FO | | smoky, leathery", "woody", "smoky"],
    ["Alpha Pinene | | sharp warm resinous fresh pine terpenic", "woody", "pine"],
    ["Veramoss | | mossy oakmoss woody phenolic earthy", "woody", "mossy"],
    ["Guaiacol | | phenolic smoky spicy vanilla woody", "woody", "smoky"],
    ["Guaiacwood | | sweet dry woody spicy", "woody", "guaiac"],
    ["Aldehyde C-12 MNA | | fresh amber aldehydic mossy citrus tuberose", "floral", "aldehydic"],
    ["Base Ajisai | | subtle green freshness, light watery florals", "floral", "watery"],
    ["Single Notes Sakura | | juicy sweet fruity-cherry", "floral", "blossom"],
    ["Orange Fleur Accord | | floral-citrus orange blossom", "floral", "orange-blossom"],
  ])("%s → %s/%s", (text, facet, key) => {
    expect(classifySubnote(facet, text)).toBe(key);
  });
});
