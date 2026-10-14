import { describe, expect, it } from "vitest";
import { dominantFacet } from "../aroma";

describe("dominantFacet", () => {
  it("mengambil facet dengan bobot terbesar", () => {
    expect(dominantFacet({ amber: 0.98, musk: 0.18, gourmand: 0.11 })).toBe(
      "amber",
    );
  });

  it("vektor kosong tidak punya facet dominan", () => {
    expect(dominantFacet({})).toBeNull();
  });

  it("bobot nol atau negatif diabaikan", () => {
    expect(dominantFacet({ woody: 0, citrus: 0 })).toBeNull();
    expect(dominantFacet({ woody: -1, citrus: 0.2 })).toBe("citrus");
  });

  it("seri diputuskan lewat abjad, bukan urutan objek", () => {
    // Label sebuah bahan tidak boleh berubah-ubah antar render hanya karena
    // urutan kunci objeknya kebetulan berbeda.
    expect(dominantFacet({ woody: 0.5, citrus: 0.5 })).toBe("citrus");
    expect(dominantFacet({ citrus: 0.5, woody: 0.5 })).toBe("citrus");
  });
});
