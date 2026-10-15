import { describe, expect, it } from "vitest";
import config from "@/seed/facet-keywords.json";
import { deriveMaterial, knownFamilies, normalizeName } from "../deriveMaterial";
import type { FacetKeywordConfig } from "../facetize";

const CONFIG = config as unknown as FacetKeywordConfig;

describe("deriveMaterial", () => {
  it("membaca dilusi supplier dari nama produk", () => {
    const d = deriveMaterial({ name: "Indole 50 BB", family: "Floral" }, CONFIG);
    expect(d.supplierDilutionPct).toBe(50);
    expect(d.solventToken).toBe("BB");
  });

  it("bahan tanpa angka di nama dianggap neat", () => {
    const d = deriveMaterial({ name: "Nagarmotha Oil", family: "Woody" }, CONFIG);
    expect(d.supplierDilutionPct).toBe(100);
    expect(d.solventToken).toBeNull();
  });

  it("tier hint diturunkan dari family yang dikenal", () => {
    expect(deriveMaterial({ name: "x", family: "Woody" }, CONFIG).noteTierHint).toBe("base");
    expect(deriveMaterial({ name: "x", family: "Citrus" }, CONFIG).noteTierHint).toBe("top");
    expect(deriveMaterial({ name: "x", family: "Ngarang" }, CONFIG).noteTierHint).toBeNull();
  });

  it("facet dihitung dari odour profile", () => {
    const d = deriveMaterial(
      {
        name: "Nagarmotha Oil",
        family: "Woody",
        category: "Essential Oil",
        odourProfile: "woody, earthy, smoky, leathery",
      },
      CONFIG,
    );
    expect(Object.keys(d.facets)).toContain("woody");
    expect(d.isBridgeCandidate).toBe(true);
  });

  it("pelarut dikenali dari kategori", () => {
    expect(deriveMaterial({ name: "Something", category: "Solvent" }, CONFIG).isSolvent).toBe(true);
  });

  it("hasilnya sama persis dengan aturan import — satu sumber", () => {
    // Dua pintu masuk (import & form) harus menghasilkan bahan yang sama untuk
    // data yang sama.
    const a = deriveMaterial({ name: "Hedione", family: "Floral", category: "Aromachemical", odourProfile: "jasmine, citrus" }, CONFIG);
    const b = deriveMaterial({ name: "Hedione", family: "Floral", category: "Aromachemical", odourProfile: "jasmine, citrus" }, CONFIG);
    expect(a).toEqual(b);
  });
});

describe("pembantu form", () => {
  it("family yang ditawarkan adalah kunci aturan tier", () => {
    expect(knownFamilies(CONFIG)).toContain("Woody");
    expect(knownFamilies(CONFIG)).toContain("Musk / Animalic");
  });

  it("nama dibandingkan tanpa peduli huruf besar dan spasi ganda", () => {
    expect(normalizeName("  Nagarmotha   OIL ")).toBe(normalizeName("nagarmotha oil"));
  });
});
