import { describe, expect, it } from "vitest";
import { fo, rm, sub } from "../legacy/calc/__fixtures__/lines";
import { analyze } from "../legacy/calc/analyze";
import type { CalcLine } from "../legacy/calc/types";
import type { Finding } from "./index";

const rules = (lines: CalcLine[]) => analyze(lines).findings;
const has = (fs: Finding[], rule: string) => fs.some((f) => f.rule === rule);
const get = (fs: Finding[], rule: string) => fs.find((f) => f.rule === rule);

describe("Rule 1 — jumlah bahan", () => {
  it("formula 15 bahan memicu peringatan", () => {
    const lines = Array.from({ length: 15 }, (_, i) =>
      rm(`m${i}`, 1, 100, { id: `m-${i}` }),
    );
    const f = get(rules(lines), "material-count")!;
    expect(f.level).toBe("warning");
    expect(f.message).toContain("15 bahan");
  });

  it("formula 3 bahan dapat info, bukan peringatan", () => {
    const f = get(
      rules([rm("A", 1, 100), rm("B", 1, 100), rm("C", 1, 100)]),
      "material-count",
    )!;
    expect(f.level).toBe("info");
  });

  it("formula 3 sub-formula x 8 bahan memicu peringatan — rules jalan di atas daftar yang dibentangkan", () => {
    const eight = Array.from({ length: 8 }, (_, i) =>
      rm(`m${i}`, 1, 100, { id: `m-${i}` }),
    );
    const lines = [
      sub("S1", 8, eight, { id: "s1" }),
      sub("S2", 8, eight, { id: "s2" }),
      sub("S3", 8, eight, { id: "s3" }),
    ];
    const f = get(rules(lines), "material-count")!;
    expect(f.level).toBe("warning");
    expect(f.message).toContain("24 bahan");
  });

  it("formula berisi FO memberi tahu ada bahan yang tidak terlihat", () => {
    const f = get(
      rules([fo("Tabbac 28", 94), rm("Booster", 6, 100)]),
      "fo-hidden-materials",
    )!;
    expect(f.level).toBe("info");
    expect(f.message).toContain("30–80 bahan");
  });
});

describe("Rule 2 — sebaran fungsi", () => {
  it("formula tanpa Fixative memicu peringatan", () => {
    const f = get(
      rules([
        rm("A", 5, 100, { functionCategory: "modifier" }),
        rm("B", 5, 100, { functionCategory: "diffuser" }),
      ]),
      "fixative-share",
    )!;
    expect(f.level).toBe("warning");
    expect(f.message).toContain("0,0%");
  });

  it("formula yang semuanya mendorong keluar memicu peringatan", () => {
    expect(
      has(
        rules([
          rm("A", 5, 100, { functionCategory: "modifier" }),
          rm("B", 5, 100, { functionCategory: "diffuser" }),
        ]),
        "push-share",
      ),
    ).toBe(true);
  });

  it("4 family tanpa Bridger memicu peringatan beserta tombol kandidat", () => {
    const f = get(
      rules([
        rm("A", 5, 100, { functionCategory: "modifier", family: "Woody" }),
        rm("B", 5, 100, { functionCategory: "fixative", family: "Floral" }),
        rm("C", 5, 100, { functionCategory: "fixative", family: "Citrus" }),
        rm("D", 5, 100, { functionCategory: "fixative", family: "Musk" }),
      ]),
      "no-bridger",
    )!;
    expect(f.level).toBe("warning");
    expect(f.message).toContain("4 keluarga aroma");
    expect(f.actionHint).toEqual({
      kind: "bridger-candidates",
      label: "Lihat kandidat Bridger",
    });
  });

  it("formula 2 family tanpa Bridger tidak diperingatkan", () => {
    expect(
      has(
        rules([
          rm("A", 5, 100, { functionCategory: "fixative", family: "Woody" }),
          rm("B", 5, 100, { functionCategory: "fixative", family: "Floral" }),
        ]),
        "no-bridger",
      ),
    ).toBe(false);
  });

  it("basis angka dijelaskan kalau ada FO, karena bagian FO tidak ikut terhitung", () => {
    const f = get(
      rules([
        fo("Tabbac 28", 80),
        rm("A", 20, 100, { functionCategory: "modifier" }),
      ]),
      "fixative-share",
    )!;
    expect(f.basisNote).toContain("20,0%");
  });
});

describe("Rule 3 — dominansi", () => {
  it("porsi kekuatan terlalu rata memicu peringatan", () => {
    const lines = Array.from({ length: 8 }, (_, i) =>
      rm(`m${i}`, 1, 100, { id: `m-${i}`, functionCategory: "fixative" }),
    );
    const f = get(rules(lines), "no-lead")!;
    expect(f.level).toBe("warning");
    expect(f.message).toContain("12,5%");
  });

  it("satu bahan menguasai lebih dari 60% memicu peringatan", () => {
    const f = get(
      rules([
        rm("Ambroxan", 1, 400, { functionCategory: "fixative" }),
        rm("Pelengkap", 9, 20, { functionCategory: "fixative" }),
      ]),
      "over-lead",
    )!;
    expect(f.message).toContain("Ambroxan");
  });

  it("formula satu bahan tidak memicu rule dominansi", () => {
    const f = rules([rm("Solo", 10, 100)]);
    expect(has(f, "over-lead")).toBe(false);
    expect(has(f, "no-lead")).toBe(false);
  });
});

describe("Rule 4 — bahan yang menelan / tenggelam", () => {
  it("bahan dosis kecil berimpact tinggi memicu peringatan", () => {
    const f = get(
      rules([
        rm("Ambroxan", 1, 400, { functionCategory: "fixative" }),
        rm("Pelengkap", 9, 20, { functionCategory: "fixative" }),
      ]),
      "swallowing",
    )!;
    expect(f.level).toBe("warning");
    expect(f.message).toContain("Ambroxan");
  });

  it("bahan dengan kontribusi di bawah 1% diberi info", () => {
    const f = get(
      rules([
        rm("Dominan", 100, 400, { functionCategory: "fixative" }),
        rm("Nyaris tak terdengar", 1, 1, { functionCategory: "fixative" }),
      ]),
      "negligible",
    )!;
    expect(f.level).toBe("info");
    expect(f.message).toContain("Nyaris tak terdengar");
  });
});

describe("Rule 5 — kelengkapan data", () => {
  it("bahan tanpa impact memicu critical dan menyebut namanya", () => {
    const f = get(
      rules([rm("Ada", 5, 100), rm("Belum ada data", 5, null)]),
      "missing-impact",
    )!;
    expect(f.level).toBe("critical");
    expect(f.message).toContain("Belum ada data");
  });

  it("sub-formula yang penyusunnya belum lengkap ikut dilaporkan", () => {
    const f = get(
      rules([sub("Accord bolong", 5, [rm("A", 2, 100), rm("B", 3, null)])]),
      "missing-impact",
    )!;
    expect(f.message).toContain("B");
  });
});

describe("Rule 6 — dominasi FO", () => {
  it("menyala saat porsi FO di bawah 85%", () => {
    const f = get(
      rules([fo("Tabbac 28", 84), rm("Accord", 16, 100)]),
      "fo-share",
    )!;
    expect(f.level).toBe("warning");
    expect(f.message).toContain("84,0%");
  });

  it("tidak menyala saat porsi FO 94%", () => {
    const f = get(rules([fo("Tabbac 28", 94), rm("Booster", 6, 100)]), "fo-share");
    expect(f).toBeUndefined();
  });

  it("memberi info saat tambahan di luar FO terlalu kecil", () => {
    const f = get(
      rules([fo("Tabbac 28", 99.5), rm("Accord", 0.5, 100)]),
      "fo-share",
    )!;
    expect(f.level).toBe("info");
  });
});

describe("Rule 7 — lebih dari satu FO", () => {
  it("menyala saat ada 2 FO dan menyebut family keduanya", () => {
    const f = rules([
      fo("Tabbac 28", 50, { family: "Tobacco" }),
      fo("Oud 7", 50, { family: "Woody" }),
    ]);
    expect(get(f, "multi-fo")!.message).toContain("2 bibit jadi");
    expect(get(f, "multi-fo-balance")!.message).toContain("50,0%");
    const fam = get(f, "multi-fo-family")!;
    expect(fam.message).toContain("Tobacco");
    expect(fam.message).toContain("Woody");
  });

  it("dua FO family sama dengan porsi 70:30 hanya dapat peringatan umum", () => {
    const f = rules([
      fo("Tabbac 28", 70, { family: "Tobacco" }),
      fo("Tabac Rouge", 30, { family: "Tobacco" }),
    ]);
    expect(has(f, "multi-fo")).toBe(true);
    expect(has(f, "multi-fo-balance")).toBe(false);
    expect(has(f, "multi-fo-family")).toBe(false);
  });

  it("tidak memblokir apa pun — tidak ada temuan tingkat critical", () => {
    const f = rules([
      fo("Tabbac 28", 50, { family: "Tobacco" }),
      fo("Oud 7", 50, { family: "Woody" }),
    ]);
    expect(f.some((x) => x.level === "critical")).toBe(false);
  });
});

describe("formula sehat", () => {
  it("tidak menghasilkan temuan apa pun", () => {
    const f = rules([
      rm("Bergamot FCF", 10, 200, {
        functionCategory: "diffuser",
        family: "Citrus",
      }),
      rm("Iso E Super", 25, 100, {
        functionCategory: "modifier",
        family: "Woody",
      }),
      rm("Hedione", 20, 100, {
        functionCategory: "bridger",
        family: "Floral",
      }),
      rm("Galaxolide", 30, 60, {
        functionCategory: "fixative",
        family: "Musk",
      }),
      rm("Ambroxan", 15, 100, {
        functionCategory: "fixative",
        family: "Amber",
      }),
    ]);
    expect(f).toEqual([]);
  });

  it("formula kosong tidak menghasilkan temuan", () => {
    expect(rules([])).toEqual([]);
  });
});
