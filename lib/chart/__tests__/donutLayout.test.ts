import { describe, expect, it } from "vitest";
import { DEFAULT_GEOMETRY as G, donutLayout, spreadLabels } from "../donutLayout";

describe("label donat", () => {
  it("satu label per irisan bernilai", () => {
    const out = donutLayout([
      { key: "a", value: 20 },
      { key: "b", value: 0 },
      { key: "c", value: 10 },
    ]);
    expect(out.map((s) => s.key)).toEqual(["a", "c"]);
  });

  it("irisan kecil berdempetan tidak saling menumpuk labelnya", () => {
    // Satu irisan besar + enam irisan tipis yang semuanya jatuh di sisi yang sama.
    const out = donutLayout([
      { key: "big", value: 70 },
      ...["a", "b", "c", "d", "e", "f"].map((k) => ({ key: k, value: 5 })),
    ]);
    for (const side of ["start", "end"] as const) {
      const ys = out.filter((s) => s.anchor === side).map((s) => s.labelY).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(G.lineHeight - 1e-6);
      }
    }
  });

  it("semua label tetap di dalam kotak", () => {
    const out = donutLayout(Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, value: 1 + (i % 3) })));
    for (const s of out) {
      expect(s.labelY).toBeGreaterThanOrEqual(0);
      expect(s.labelY).toBeLessThanOrEqual(G.height);
    }
  });

  it("label di kanan rata kiri, di kiri rata kanan, dan di luar donat", () => {
    for (const s of donutLayout([{ key: "a", value: 1 }, { key: "b", value: 1 }])) {
      if (s.anchor === "start") expect(s.labelX).toBeGreaterThan(G.cx + G.outer);
      else expect(s.labelX).toBeLessThan(G.cx - G.outer);
    }
  });

  it("garis penunjuk berakhir di samping teksnya", () => {
    for (const s of donutLayout([{ key: "a", value: 3 }, { key: "b", value: 1 }])) {
      expect(s.leader.at(-1)![1]).toBe(s.labelY);
    }
  });

  it("satu irisan penuh tetap tergambar", () => {
    const [only] = donutLayout([{ key: "a", value: 1 }]);
    expect(only.path).toMatch(/A/);
  });
});

describe("spreadLabels", () => {
  it("menjaga jarak minimal dan urutan aslinya", () => {
    const out = spreadLabels([50, 51, 52], 10, 0, 200);
    expect(out[1] - out[0]).toBeGreaterThanOrEqual(10);
    expect(out[2] - out[1]).toBeGreaterThanOrEqual(10);
  });
  it("tumpukan yang menabrak dasar digeser naik", () => {
    const out = spreadLabels([195, 196, 197], 10, 0, 200);
    expect(Math.max(...out)).toBeLessThanOrEqual(200);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
  });
});

describe("garis penunjuk", () => {
  it("tidak bersilangan: urutan label tiap sisi sama dengan urutan tepi irisannya", () => {
    const out = donutLayout([
      { key: "big", value: 39 }, { key: "b", value: 19 }, { key: "c", value: 16 },
      ...["d", "e", "f", "g", "h", "i", "j", "k"].map((k, i) => ({ key: k, value: 6 - i * 0.7 })),
    ]);
    for (const side of ["start", "end"] as const) {
      const s = out.filter((x) => x.anchor === side);
      const byEdge = [...s].sort((a, b) => a.leader[0][1] - b.leader[0][1]).map((x) => x.key);
      const byLabel = [...s].sort((a, b) => a.labelY - b.labelY).map((x) => x.key);
      expect(byLabel).toEqual(byEdge);
    }
  });
});
