import { describe, expect, it } from "vitest";
import config from "@/seed/facet-keywords.json";
import { FACET_LABELS, facetLabel } from "@/lib/tiers";

/**
 * FACET_LABELS adalah salinan untuk layar yang tidak membawa tabel `facets`.
 * Test ini yang menjaga salinan itu tidak menyimpang dari sumbernya — kalau
 * nanti ada facet baru di seed, test ini yang gagal duluan, bukan user yang
 * menemukan kunci mentah muncul di pie.
 */
describe("FACET_LABELS", () => {
  const facets = config.facets as Record<string, { label: string }>;

  it("punya kunci yang persis sama dengan seed", () => {
    expect(Object.keys(FACET_LABELS).sort()).toEqual(
      Object.keys(facets).sort(),
    );
  });

  it("labelnya sama dengan seed", () => {
    for (const [key, def] of Object.entries(facets)) {
      expect(FACET_LABELS[key]).toBe(def.label);
    }
  });

  it("facet yang tidak dikenal jatuh ke kuncinya sendiri", () => {
    // Lebih baik menampilkan kunci mentah daripada kosong: user jadi tahu ada
    // facet baru yang belum diberi nama.
    expect(facetLabel("belum-ada")).toBe("belum-ada");
  });
});
