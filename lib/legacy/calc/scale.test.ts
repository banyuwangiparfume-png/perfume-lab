import { describe, expect, it } from "vitest";
import { rm } from "./__fixtures__/lines";
import { computeFormula } from "./formula";
import { scaleTo } from "./scale";

const base = [
  rm("Hedione", 2.6, 65),
  rm("Galaxolide", 1.8, 60),
  rm("Ambroxan", 0.2, 400),
  rm("Bacdanol", 0.4, 80),
];

describe("scaleTo", () => {
  it("5 g ke 50 g: semua rasio tetap, total sesuai target", () => {
    const from = scaleTo(base, 5);
    const to = scaleTo(base, 50);
    const total = to.reduce((a, l) => a + l.weightG, 0);
    expect(total).toBeCloseTo(50, 2);

    const a = computeFormula(from);
    const b = computeFormula(to);
    a.rows.forEach((row, i) => {
      expect(b.rows[i].neatPct).toBeCloseTo(row.neatPct, 6);
      expect(b.rows[i].strengthPct!).toBeCloseTo(row.strengthPct!, 6);
    });
  });

  it("skalakan lalu skalakan balik mengembalikan angka semula", () => {
    const total = base.reduce((a, l) => a + l.weightG, 0);
    const roundTrip = scaleTo(scaleTo(base, 50), total);
    roundTrip.forEach((l, i) => {
      expect(l.weightG).toBeCloseTo(base[i].weightG, 3);
    });
  });

  it("membulatkan ke 3 desimal — angka yang benar-benar bisa ditimbang", () => {
    const out = scaleTo([rm("A", 1, 100), rm("B", 2, 100)], 10);
    out.forEach((l) => {
      expect(l.weightG).toBe(Number(l.weightG.toFixed(3)));
    });
  });

  it("tidak menyentuh dilusi — mengubah dilusi berarti mengubah formulanya", () => {
    const lines = [rm("A", 1, 100, { dilutionPct: 10 }), rm("B", 1, 100)];
    const out = scaleTo(lines, 20);
    expect(out[0].dilutionPct).toBe(10);
    expect(out[1].dilutionPct).toBe(100);
  });

  it("formula kosong atau target nol tidak error", () => {
    expect(scaleTo([], 10)).toEqual([]);
    expect(scaleTo(base, 0)).toEqual(base);
  });
});
