import { describe, expect, it } from "vitest";
import { suggestFunctionCategory } from "../functions";

describe("suggestFunctionCategory", () => {
  it.each([
    ["Musk / Animalic", "fixative"],
    ["Sweet/Balsamic", "fixative"],
    ["Woody", "fixative"],
    ["Citrus", "diffuser"],
    ["Green", "diffuser"],
    ["Floral", "modifier"],
    ["Fruity", "modifier"],
    ["Herbal", "modifier"],
    ["Mineral", "modifier"],
  ])("%s -> %s", (family, expected) => {
    expect(suggestFunctionCategory(family)).toBe(expected);
  });

  it("tidak peduli kapital dan spasi", () => {
    expect(suggestFunctionCategory("  woODY ")).toBe("fixative");
  });

  it("family yang tidak dikenal TIDAK ditebak", () => {
    // Lebih baik tampil "belum berkategori" daripada diberi peran yang salah
    // diam-diam. Ini yang membuat tebakan ini bisa dipercaya.
    expect(suggestFunctionCategory("Soulful")).toBeNull();
    expect(suggestFunctionCategory("Industrial")).toBeNull();
    expect(suggestFunctionCategory("")).toBeNull();
    expect(suggestFunctionCategory(null)).toBeNull();
  });
});
