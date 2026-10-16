import { describe, expect, it } from "vitest";
import {
  matchFormulaRows,
  parseNumber,
  pyramidFrom,
  toLines,
  type ImportCatalog,
} from "../formulaImport";

const catalog: ImportCatalog = {
  entries: [
    { id: "hed", kind: "raw_material", name: "Hedione / Methyl Dihydrojasmonate", cas: "24851-98-7", tierHint: "mid" },
    { id: "iso", kind: "raw_material", name: "Iso E Super / Amber Fleur Pure Concentrate", tierHint: "base" },
    { id: "amb1", kind: "raw_material", name: "Ambrox / Ambroxan", cas: "6790-58-5", tierHint: "base" },
    { id: "amb2", kind: "raw_material", name: "Ambrox Super", synonym: "Ambrox", cas: "3738-00-9", tierHint: "base" },
    { id: "berg", kind: "raw_material", name: "Bergamot", tierHint: "top" },
    { id: "jas", kind: "accord", name: "Jasmine Accord · v2" },
    { id: "fo1", kind: "fo", name: "Eco Inspired by Baccarat Rouge 540" },
  ],
  solvents: [
    { id: "tec", name: "Triethyl Citrate / TEC Natural Solvent" },
    { id: "dpg", name: "Dipropylene Glycol" },
  ],
};

const run = (rows: Record<string, unknown>[], pyramid = true) =>
  matchFormulaRows(
    rows.map((values, i) => ({ row: i + 2, values })),
    catalog,
    { pyramid },
  );

describe("pencocokan nama", () => {
  it("nama lengkap persis cocok", () => {
    const r = run([{ tier: "mid", bahan: "Hedione / Methyl Dihydrojasmonate", persen: 20 }]);
    expect(r.rows[0].match?.id).toBe("hed");
  });

  it("potongan nama dari garis miring cocok — AI jarang menulis nama lengkap supplier", () => {
    const r = run([
      { tier: "mid", bahan: "Hedione", persen: 20 },
      { tier: "base", bahan: "iso e super", persen: 10 },
    ]);
    expect(r.rows.map((x) => x.match?.id)).toEqual(["hed", "iso"]);
  });

  it("nama yang cocok ke dua bahan ditandai ambigu, tidak dipilihkan", () => {
    const r = run([{ tier: "base", bahan: "Ambrox", persen: 5 }]);
    expect(r.rows[0].match).toBeNull();
    expect(r.rows[0].issues[0].message).toMatch(/cocok ke 2 bahan/);
  });

  it("CAS memutus ambigu", () => {
    const r = run([{ tier: "base", bahan: "Ambrox", cas: "3738-00-9", persen: 5 }]);
    expect(r.rows[0].match?.id).toBe("amb2");
  });

  it("nama yang tidak ada ditandai, bukan dibuang diam-diam", () => {
    const r = run([{ tier: "top", bahan: "Nagarmotha Oil", persen: 2 }]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].issues[0].level).toBe("error");
    expect(r.importable).toBe(0);
  });

  it("accord dan FO bisa dipanggil dengan namanya", () => {
    const r = run([
      { tier: "mid", bahan: "Jasmine Accord · v2", persen: 10 },
      { tier: "base", bahan: "Eco Inspired by Baccarat Rouge 540", persen: 5 },
    ]);
    expect(r.rows.map((x) => x.match?.kind)).toEqual(["accord", "fo"]);
  });
});

describe("persen, tier, dan dilusi", () => {
  it("menerima koma desimal dan tanda persen", () => {
    expect(parseNumber("7,5%")).toBe(7.5);
    expect(parseNumber(" 12 ")).toBe(12);
    expect(parseNumber("")).toBeNull();
  });

  it("persen kosong atau nol adalah error", () => {
    const r = run([
      { tier: "mid", bahan: "Hedione", persen: "" },
      { tier: "mid", bahan: "Bergamot", persen: 0 },
    ]);
    expect(r.rows.every((x) => x.issues.some((i) => i.level === "error"))).toBe(true);
  });

  it("tier kosong memakai kebiasaan bahan, dengan peringatan", () => {
    const r = run([{ bahan: "Bergamot", persen: 5 }]);
    expect(r.rows[0].tier).toBe("top");
    expect(r.rows[0].issues[0].level).toBe("warn");
  });

  it("tanpa piramida, semua baris masuk tier all dan kolom tier diabaikan", () => {
    const r = run([{ tier: "top", bahan: "Bergamot", persen: 5 }], false);
    expect(r.rows[0].tier).toBe("all");
    expect(r.rows[0].issues).toEqual([]);
  });

  it("dilusi butuh pelarut yang dikenal", () => {
    const r = run([
      { tier: "mid", bahan: "Hedione", persen: 5, dilusi_pct: 10, pelarut: "TEC" },
      { tier: "mid", bahan: "Bergamot", persen: 5, dilusi_pct: 10 },
    ]);
    expect(r.rows[0].solvent?.id).toBe("tec");
    expect(r.rows[0].dilutionPct).toBe(10);
    expect(r.rows[1].issues.some((i) => i.level === "error")).toBe(true);
  });

  it("baris kosong di bawah template dilewati tanpa komentar", () => {
    const r = run([{ tier: "mid", bahan: "Hedione", persen: 5 }, {}, { tier: "" }]);
    expect(r.rows).toHaveLength(1);
  });
});

describe("hasil", () => {
  const full = run([
    { tier: "top", bahan: "Bergamot", persen: 15 },
    { tier: "mid", bahan: "Hedione", persen: 25 },
    { tier: "base", bahan: "Iso E Super", persen: 60 },
  ]);

  it("menjumlah per tier dan total", () => {
    expect(full.totalPct).toBe(100);
    expect(full.tierSums).toEqual({ top: 15, mid: 25, base: 60 });
  });

  it("target piramida diambil dari resep kalau totalnya 100", () => {
    expect(pyramidFrom(full)).toEqual({ top: 15, mid: 25, base: 60 });
  });

  it("total yang bukan 100 tidak dipaksakan jadi piramida", () => {
    const partial = run([{ tier: "top", bahan: "Bergamot", persen: 15 }]);
    expect(pyramidFrom(partial)).toBeNull();
  });

  it("baris editor dikunci dan membawa dilusi", () => {
    let n = 0;
    const lines = toLines(
      run([{ tier: "mid", bahan: "Hedione", persen: 5, dilusi_pct: 10, pelarut: "dipropylene glycol" }]),
      () => `id${n++}`,
    );
    expect(lines).toEqual([
      expect.objectContaining({ refId: "hed", pct: 5, locked: true, userDilutionPct: 10, userSolventId: "dpg" }),
    ]);
  });

  it("baris bermasalah tidak ikut masuk", () => {
    const r = run([
      { tier: "mid", bahan: "Hedione", persen: 5 },
      { tier: "mid", bahan: "Ngarang", persen: 5 },
    ]);
    expect(toLines(r, () => "x")).toHaveLength(1);
    expect(r.totalPct).toBe(5);
  });
});
