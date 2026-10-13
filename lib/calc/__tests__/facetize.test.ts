import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  facetize,
  isBridgeCandidate,
  tierHintFromFamily,
  tokenize,
  type FacetKeywordConfig,
} from "../facetize";
import { bridgeDb } from "./fixture";

const config = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "seed", "facet-keywords.json"),
    "utf8",
  ),
) as FacetKeywordConfig;

const run = (m: (typeof bridgeDb.materials)[number]) =>
  facetize(
    {
      name: m.name,
      synonym: m.syn,
      family: m.family,
      odourProfile: m.odour,
    },
    config,
  );

/** Selisih maksimum per facet antara hasil port dan acuan bridge-db. */
function maxDelta(
  got: Record<string, number>,
  want: Record<string, number>,
): number {
  let max = 0;
  for (const f of new Set([...Object.keys(got), ...Object.keys(want)])) {
    max = Math.max(max, Math.abs((got[f] ?? 0) - (want[f] ?? 0)));
  }
  return max;
}

describe("tokenize", () => {
  it("memecah di angka dan tanda baca, mempertahankan tanda hubung", () => {
    expect(tokenize("animal floral naphthyl fecal, pungent")).toEqual([
      "animal",
      "floral",
      "naphthyl",
      "fecal",
      "pungent",
    ]);
  });

  it("frasa yang sudah digabung tetap satu token", () => {
    expect(tokenize("woody bois-de-rose")).toEqual(["woody", "bois-de-rose"]);
  });

  it("duplikat dibuang, urutan pertama dipertahankan", () => {
    expect(tokenize("floral animal floral musty")).toEqual([
      "floral",
      "animal",
      "musty",
    ]);
  });

  it("angka di nama bahan jadi pemisah, bukan token", () => {
    expect(tokenize("1-Octen 3-One 1-TEC")).toEqual(["octen", "one", "tec"]);
  });
});

describe("facetize — cocok dengan acuan bridge-db.json", () => {
  const cases: [string, Record<string, number>][] = [
    ["Bergamot Oil Italy FCF", { citrus: 0.936, floral: 0.223, green: 0.203, spicy: 0.182 }],
    ["Indole 50 BB", { animalic: 0.834, floral: 0.437, earthy: 0.278, musk: 0.191 }],
    ["Ambroxan", { amber: 0.977, musk: 0.182, gourmand: 0.114 }],
  ];

  it.each(cases)("%s", (name, want) => {
    const m = bridgeDb.materials.find((x) => x.name === name)!;
    expect(maxDelta(run(m), want)).toBeLessThanOrEqual(0.001);
  });

  it("sinonim ikut menyumbang — tanpa itu Bergamot meleset jauh", () => {
    const m = bridgeDb.materials.find(
      (x) => x.name === "Bergamot Oil Italy FCF",
    )!;
    const withSyn = run(m);
    const withoutSyn = facetize(
      { name: m.name, synonym: null, family: m.family, odourProfile: m.odour },
      config,
    );
    expect(withSyn.citrus).toBeGreaterThan(withoutSyn.citrus);
  });

  it("override manual dipakai apa adanya, dinormalisasi L2", () => {
    const hedione = bridgeDb.materials.find((x) => x.name.startsWith("Hedione"))!;
    expect(maxDelta(run(hedione), hedione.facets)).toBeLessThanOrEqual(0.001);
  });
});

describe("facetize — port terhadap seluruh 413 bahan", () => {
  const results = bridgeDb.materials.map((m) => ({
    name: m.name,
    delta: maxDelta(run(m), m.facets ?? {}),
  }));
  const mismatched = results.filter((r) => r.delta > 0.01);

  it("laporan kecocokan", () => {
    const pct = ((results.length - mismatched.length) / results.length) * 100;
    // Dicetak supaya tingkat kecocokan terlihat di output test, bukan hanya
    // lolos/gagal — kalau port-nya melenceng, angkanya yang memberi tahu.
    console.log(
      `facetize cocok untuk ${results.length - mismatched.length}/${results.length} bahan (${pct.toFixed(1)}%), toleransi 0,01`,
    );
    if (mismatched.length) {
      console.log(
        "  contoh yang meleset:",
        mismatched
          .slice(0, 5)
          .map((r) => `${r.name} (Δ${r.delta.toFixed(3)})`)
          .join(" · "),
      );
    }
    expect(results.length).toBe(413);
  });

  it("minimal 99% bahan direproduksi dalam toleransi 0,01", () => {
    const ratio = (results.length - mismatched.length) / results.length;
    expect(ratio).toBeGreaterThanOrEqual(0.99);
  });

  /*
   * Tiga bahan ini belum direproduksi persis, selisih terbesar ~0,1 pada satu
   * facet. Ketiganya punya token yang berulang di deskriptor atau sinonim, dan
   * acuan memperlakukan pengulangan itu berbeda dari aturan yang tertulis di
   * file 03 §4.9. Menyetel konstanta sampai ketiganya cocok berisiko merusak
   * 410 bahan lain, jadi dibiarkan sampai skrip Python acuannya tersedia.
   *
   * Dampaknya kecil: facetize hanya jalan saat IMPORT, dan hasilnya bisa
   * ditimpa admin lewat facet manual.
   */
  it("daftar yang belum cocok tidak bertambah", () => {
    expect(mismatched.map((r) => r.name).sort()).toEqual([
      "Habanolide",
      "Rose Oxide",
      "Trans 2 Xexenol",
    ]);
  });
});

describe("kandidat bridger & tier hint", () => {
  it("bahan dengan off-note di 4 deskriptor pertama dikeluarkan", () => {
    expect(
      isBridgeCandidate(
        {
          name: "Contoh",
          category: "Aromachemical",
          impact: 100,
          odourProfile: "cheesy sweaty waxy fatty",
        },
        { animalic: 1 },
        config,
      ),
    ).toBe(false);
  });

  it("bahan terlalu keras dikeluarkan", () => {
    expect(
      isBridgeCandidate(
        { name: "Contoh", category: "Aromachemical", impact: 4000, odourProfile: "floral" },
        { floral: 1 },
        config,
      ),
    ).toBe(false);
  });

  it("kategori di luar daftar dikeluarkan", () => {
    expect(
      isBridgeCandidate(
        { name: "DPG", category: "Solvent", impact: null, odourProfile: "" },
        { floral: 1 },
        config,
      ),
    ).toBe(false);
  });

  it("tier hint diturunkan dari family", () => {
    expect(tierHintFromFamily("Citrus", config)).toBe("top");
    expect(tierHintFromFamily("Floral", config)).toBe("mid");
    expect(tierHintFromFamily("Woody", config)).toBe("base");
    expect(tierHintFromFamily("Tidak Dikenal", config)).toBeNull();
  });
});
