import { describe, expect, it } from "vitest";
import { cheapestTier, pickPrice, pricePerGram } from "./pricing";

const tier = (g: number, idr: number, date = "2026-10-01") => ({
  tier_grams: g,
  price_idr: idr,
  effective_date: date,
});

describe("pricePerGram", () => {
  it("harga dibagi gram tier", () => {
    expect(pricePerGram(tier(500, 7_524_000))).toBeCloseTo(15_048, 6);
  });

  it("tier nol tidak membuat pembagian nol", () => {
    expect(pricePerGram(tier(0, 1000))).toBe(0);
  });
});

describe("pickPrice", () => {
  const tiers = [
    tier(5, 100_000),
    tier(10, 180_000),
    tier(50, 800_000),
    tier(100, 1_500_000),
    tier(500, 7_000_000),
  ];

  it("memakai tier terbesar yang masih di bawah preferensi", () => {
    expect(pickPrice(tiers, 500)!.tierGrams).toBe(500);
    expect(pickPrice(tiers, 100)!.tierGrams).toBe(100);
    expect(pickPrice(tiers, 60)!.tierGrams).toBe(50);
  });

  it("kalau semua tier lebih besar dari preferensi, ambil yang terkecil", () => {
    expect(pickPrice([tier(50, 800_000), tier(500, 7_000_000)], 10)!.tierGrams).toBe(50);
  });

  it("hanya memakai harga dari effective_date terbaru", () => {
    const withHistory = [
      tier(500, 7_000_000, "2026-01-01"),
      tier(500, 9_000_000, "2026-10-01"),
    ];
    const picked = pickPrice(withHistory, 500)!;
    expect(picked.effectiveDate).toBe("2026-10-01");
    expect(picked.pricePerGram).toBeCloseTo(18_000, 6);
  });

  it("bahan tanpa harga menghasilkan null, bukan nol", () => {
    expect(pickPrice([], 500)).toBeNull();
  });
});

describe("cheapestTier", () => {
  it("menandai tier dengan harga per gram paling murah", () => {
    const t = cheapestTier([tier(5, 100_000), tier(500, 7_000_000)])!;
    expect(Number(t.tier_grams)).toBe(500);
  });
});
