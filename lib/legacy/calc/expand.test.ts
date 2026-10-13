import { describe, expect, it } from "vitest";
import { fo, rm, sub } from "./__fixtures__/lines";
import {
  countFamilies,
  countMaterials,
  expandLines,
  scaleSubLines,
} from "./expand";
import { neatWeight } from "./formula";

const accord = [rm("C", 2, 200), rm("D", 3, 20)];

describe("expandLines", () => {
  it("membentangkan sub-formula jadi penyusunnya", () => {
    const out = expandLines([rm("A", 5, 100), sub("Accord", 5, accord)]);
    expect(out.map((l) => l.label)).toEqual(["A", "C", "D"]);
    expect(out.every((l) => l.lineType === "raw_material")).toBe(true);
  });

  it("berat sub-baris terskala ke porsinya di formula induk", () => {
    const line = sub("Accord", 10, accord); // resep accord totalnya 5 g
    const out = scaleSubLines(line);
    expect(out.map((l) => l.weightG)).toEqual([4, 6]);
    // Σ berat murni sub-baris == berat murni baris induk
    const total = out.reduce((a, l) => a + neatWeight(l), 0);
    expect(total).toBeCloseTo(neatWeight(line), 10);
  });

  it("dilusi sub-baris dipertahankan saat diskalakan", () => {
    const line = sub("Accord", 10, [
      rm("C", 2, 200, { dilutionPct: 10 }),
      rm("D", 3, 20),
    ]);
    const out = scaleSubLines(line);
    expect(out[0].dilutionPct).toBe(10);
    expect(out[1].dilutionPct).toBe(100);
    const total = out.reduce((a, l) => a + neatWeight(l), 0);
    expect(total).toBeCloseTo(neatWeight(line), 10);
  });

  it("baris FO TIDAK dibentangkan — isinya memang tidak diketahui", () => {
    const out = expandLines([fo("Tabbac 28", 94), rm("A", 6, 100)]);
    expect(out.map((l) => l.label)).toEqual(["Tabbac 28", "A"]);
    expect(out[0].lineType).toBe("fo");
  });

  it("sub-formula bersarang dibentangkan sampai batas kedalaman", () => {
    const inner = sub("Inner", 5, accord);
    const outer = sub("Outer", 10, [rm("E", 5, 100), inner]);
    const out = expandLines([outer]);
    expect(out.map((l) => l.label).sort()).toEqual(["C", "D", "E"]);
  });

  it("kedalaman berlebih berhenti, tidak hang", () => {
    // Siklus yang sengaja dibuat di data: Loop memakai dirinya sendiri.
    const loop = sub("Loop", 10, [rm("A", 5, 100)]);
    loop.subLines = [rm("A", 5, 100), loop];
    const out = expandLines([loop]);
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((l) => l.lineType === "sub_formula")).toBe(true);
  });

  it("sub-formula tanpa penyusun ter-resolve tetap jadi satu baris", () => {
    const out = expandLines([sub("Belum di-resolve", 5, [])]);
    expect(out).toHaveLength(1);
    expect(out[0].lineType).toBe("sub_formula");
  });
});

describe("countMaterials", () => {
  it("formula 3 sub-formula x 8 bahan terbaca 24 bahan, bukan 3", () => {
    const eight = Array.from({ length: 8 }, (_, i) =>
      rm(`m${i}`, 1, 100, { id: `m-${i}` }),
    );
    const lines = [
      sub("S1", 8, eight, { id: "s1" }),
      sub("S2", 8, eight, { id: "s2" }),
      sub("S3", 8, eight, { id: "s3" }),
    ];
    expect(countMaterials(expandLines(lines))).toBe(24);
  });

  it("baris FO tidak dihitung sebagai bahan", () => {
    expect(countMaterials(expandLines([fo("FO", 94), rm("A", 6, 100)]))).toBe(1);
  });
});

describe("countFamilies", () => {
  it("family FO ikut dihitung — FO tetap menyumbang karakter", () => {
    const n = countFamilies(
      expandLines([
        rm("A", 1, 100, { family: "Woody" }),
        rm("B", 1, 100, { family: "Floral" }),
        fo("FO", 1, { family: "Tobacco" }),
      ]),
    );
    expect(n).toBe(3);
  });

  it("family yang sama dengan beda huruf besar-kecil tidak dihitung dua kali", () => {
    const n = countFamilies([
      rm("A", 1, 100, { family: "Woody" }),
      rm("B", 1, 100, { family: "woody " }),
    ]);
    expect(n).toBe(1);
  });
});
