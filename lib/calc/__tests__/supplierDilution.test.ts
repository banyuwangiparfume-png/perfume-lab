import { describe, expect, it } from "vitest";
import {
  isSolventProduct,
  parseSupplierDilution,
} from "../supplierDilution";

describe("parseSupplierDilution — nama produk Ecofragrantica", () => {
  it.each([
    ["Indole 50 BB", 50, "BB"],
    ["Benzoin 50-bb", 50, "BB"],
    ["1-Octen 3-One 1-TEC", 1, "TEC"],
    ["2-Aminoacetophenone 0,025 TEC", 0.025, "TEC"],
    ["2,6 Trimethyl 1,3 Cyclohexadiene 1 Carboxaldehyde / Safranal 10-TEC", 10, "TEC"],
    ["Benzoin Siam Resinoid 50-dpg", 50, "DPG"],
    ["Benzoin 55-etha", 55, "ETHA"],
    ["Indolene 50 Castor", 50, "CASTOR"],
  ])("%s -> %s%% in %s", (name, pct, token) => {
    const d = parseSupplierDilution(name);
    expect(d).not.toBeNull();
    expect(d!.pct).toBeCloseTo(pct, 6);
    expect(d!.solventToken).toBe(token);
  });

  it("nama tanpa dilusi tetap null, bukan 100", () => {
    expect(parseSupplierDilution("Benzyl Benzoate")).toBeNull();
    expect(parseSupplierDilution("Bergamot Oil Italy FCF")).toBeNull();
  });

  it("kecocokan pertama yang dipakai", () => {
    // "Etha" di belakang bagian dari nama produk, bukan dilusi kedua.
    expect(parseSupplierDilution("Oud Resin 5 TEC Etha")).toEqual({
      pct: 5,
      solventToken: "TEC",
    });
  });
});

describe("isSolventProduct", () => {
  it("menandai pelarut walau kategorinya bukan Solvent", () => {
    // Ini kasus yang paling penting: BB ada di kategori Aromachemical.
    expect(isSolventProduct("Benzyl Benzoate", "Aromachemical")).toBe(true);
  });

  it("menandai dari kategori supplier", () => {
    expect(isSolventProduct("Eco Cutter Base", "Solvent")).toBe(true);
    expect(isSolventProduct("Eco Moisturizer Perfume", "Solvent")).toBe(true);
  });

  it.each([
    "Triethyl Citrate / TEC Natural Solvent",
    "Dipropylene Glycol / DPG",
    "Ethanol FG 96%",
  ])("%s dikenali", (name) => {
    expect(isSolventProduct(name, null)).toBe(true);
  });

  it("bahan yang DIENCERKAN dengan pelarut bukan pelarut", () => {
    // Kalau ini salah, Indolene keluar dari hitungan bahan aktif.
    expect(isSolventProduct("Indolene 50 Castor", "Aromachemical")).toBe(false);
    expect(isSolventProduct("Indole 50 BB", "Aromachemical")).toBe(false);
    expect(isSolventProduct("Benzoin 55-etha", "Essential Oil")).toBe(false);
    expect(isSolventProduct("1-Octen 3-One 1-TEC", "Aromachemical")).toBe(false);
  });
});
