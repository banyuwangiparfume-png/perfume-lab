import { describe, expect, it } from "vitest";
import { sameContent, type VersionContent } from "../versionDiff";

const line = (id: string, pct: number, extra: Partial<VersionContent["lines"][number]> = {}) => ({
  tier: "mid",
  line_type: "raw_material",
  raw_material_id: id,
  accord_version_id: null,
  fo_id: null,
  pct,
  user_dilution_pct: 100,
  user_solvent_id: null,
  ...extra,
});
const v = (lines: VersionContent["lines"], pyr = [15, 25, 60]): VersionContent => ({
  top_pct: pyr[0],
  mid_pct: pyr[1],
  base_pct: pyr[2],
  lines,
});

describe("sameContent", () => {
  it("isi yang sama dianggap sama, apa pun urutan barisnya", () => {
    expect(sameContent(v([line("a", 10), line("b", 15)]), v([line("b", 15), line("a", 10)]))).toBe(true);
  });

  it("persen berubah = berbeda", () => {
    expect(sameContent(v([line("a", 10)]), v([line("a", 10.5)]))).toBe(false);
  });

  it("selisih di bawah presisi simpan bukan perubahan", () => {
    expect(sameContent(v([line("a", 10)]), v([line("a", 10.000001)]))).toBe(true);
  });

  it("dilusi atau pelarut berubah = berbeda", () => {
    expect(sameContent(v([line("a", 10)]), v([line("a", 10, { user_dilution_pct: 10, user_solvent_id: "tec" })]))).toBe(false);
    expect(
      sameContent(
        v([line("a", 10, { user_dilution_pct: 10, user_solvent_id: "tec" })]),
        v([line("a", 10, { user_dilution_pct: 10, user_solvent_id: "dpg" })]),
      ),
    ).toBe(false);
  });

  it("pindah tier = berbeda", () => {
    expect(sameContent(v([line("a", 10)]), v([line("a", 10, { tier: "base" })]))).toBe(false);
  });

  it("target piramida berubah = berbeda", () => {
    expect(sameContent(v([line("a", 10)]), v([line("a", 10)], [20, 30, 50]))).toBe(false);
  });

  it("bahan ditambah atau dihapus = berbeda", () => {
    expect(sameContent(v([line("a", 10)]), v([line("a", 10), line("b", 1)]))).toBe(false);
  });
});
