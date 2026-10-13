import { describe, expect, it } from "vitest";
import {
  addLine,
  allocateTier,
  applyRatio,
  editLinePct,
  moveLine,
  normalizeTier,
  removeLine,
  scaleTier,
  setLocked,
  spreadEven,
  tierStatus,
} from "../allocate";
import { sum, type Line } from "../types";

let seq = 0;
const line = (pct: number, locked = false): Line => ({
  id: `l${++seq}`,
  tier: "top",
  kind: "raw_material",
  refId: `m${seq}`,
  pct,
  locked,
  userDilutionPct: 100,
  userSolventId: null,
});

const total = (lines: Line[]) => sum(lines.map((l) => l.pct));

describe("allocateTier", () => {
  it("dua baris terbuka di target 15% dibagi rata", () => {
    const out = allocateTier([line(0), line(0)], 15);
    expect(out.map((l) => l.pct)).toEqual([7.5, 7.5]);
  });

  it("baris terkunci dipatok, sisanya dibagi ke yang terbuka", () => {
    const out = allocateTier([line(10, true), line(0)], 15);
    expect(out.map((l) => l.pct)).toEqual([10, 5]);
  });

  it("sisa pembulatan jatuh ke baris terbuka terakhir supaya total tepat", () => {
    const out = allocateTier([line(0), line(0), line(0)], 10);
    expect(out.map((l) => l.pct)).toEqual([3.33333, 3.33333, 3.33334]);
    expect(total(out)).toBeCloseTo(10, 10);
  });

  it("sisa negatif bikin baris terbuka nol — tidak pernah negatif", () => {
    const out = allocateTier([line(20, true), line(0)], 15);
    expect(out[1].pct).toBe(0);
    expect(out.every((l) => l.pct >= 0)).toBe(true);
  });

  it("semua terkunci: tidak ada yang berubah sendiri", () => {
    const input = [line(10, true), line(8, true)];
    expect(allocateTier(input, 15).map((l) => l.pct)).toEqual([10, 8]);
  });

  it("immutable — input tidak disentuh", () => {
    const input = [line(0), line(0)];
    allocateTier(input, 15);
    expect(input.map((l) => l.pct)).toEqual([0, 0]);
  });
});

describe("operasi editor", () => {
  it("tambah bahan ke tier kosong: dapat seluruh target", () => {
    const out = addLine([], line(0), 15);
    expect(out[0].pct).toBe(15);
  });

  it("tambah bahan kedua: dibagi rata 7,5 / 7,5", () => {
    const first = addLine([], line(0), 15);
    const out = addLine(first, line(0), 15);
    expect(out.map((l) => l.pct)).toEqual([7.5, 7.5]);
  });

  it("mengetik persen mengunci baris itu dan menyesuaikan sisanya", () => {
    const lines = allocateTier([line(0), line(0)], 15);
    const out = editLinePct(lines, lines[0].id, 10, 15);
    expect(out[0]).toMatchObject({ pct: 10, locked: true });
    expect(out[1].pct).toBe(5);
    expect(total(out)).toBeCloseTo(15, 10);
  });

  it("hapus baris: sisanya dibagi ulang", () => {
    const lines = allocateTier([line(0), line(0), line(0)], 15);
    const out = removeLine(lines, lines[0].id, 15);
    expect(out.map((l) => l.pct)).toEqual([7.5, 7.5]);
  });

  it("membuka gembok mengembalikan baris ke pembagian otomatis", () => {
    const lines = [line(12, true), line(3, true)];
    const out = setLocked(lines, lines[1].id, false, 15);
    expect(out[1].pct).toBe(3);
    expect(total(out)).toBeCloseTo(15, 10);
  });

  it("normalisasi: semua dikali target/total, lalu dikunci", () => {
    const out = normalizeTier([line(8, true), line(8, true)], 15);
    expect(total(out)).toBeCloseTo(15, 10);
    expect(out.every((l) => l.locked)).toBe(true);
  });

  it("rasio 10:5 di target 15 jadi 10 dan 5", () => {
    const a = line(1);
    const b = line(1);
    const out = applyRatio([a, b], { [a.id]: 10, [b.id]: 5 }, 15);
    expect(out.map((l) => l.pct)).toEqual([10, 5]);
    expect(out.every((l) => l.locked)).toBe(true);
  });

  it("ratakan membuka semua gembok", () => {
    const out = spreadEven([line(12, true), line(3, true)], 15);
    expect(out.map((l) => l.pct)).toEqual([7.5, 7.5]);
    expect(out.every((l) => !l.locked)).toBe(true);
  });

  it("ubah target tier 15 -> 20: semua dikali 20/15, gembok tetap", () => {
    const out = scaleTier([line(10, true), line(5, true)], 15, 20);
    expect(total(out)).toBeCloseTo(20, 6);
    expect(out.every((l) => l.locked)).toBe(true);
  });

  it("pindah baris ke tier lain membawa persennya dan mengunci", () => {
    const from = allocateTier([line(0), line(0)], 15);
    const to = allocateTier([line(0)], 25);
    const out = moveLine(from, to, from[0].id, 15, 25, "mid");

    expect(out.from).toHaveLength(1);
    expect(total(out.from)).toBeCloseTo(15, 10);
    expect(out.to).toHaveLength(2);
    expect(total(out.to)).toBeCloseTo(25, 10);
    expect(out.to.find((l) => l.id === from[0].id)).toMatchObject({
      tier: "mid",
      locked: true,
    });
  });
});

describe("tierStatus", () => {
  it("pas target = ok", () => {
    expect(tierStatus([line(10, true), line(5, true)], 15)).toMatchObject({
      filled: 15,
      diff: 0,
      ok: true,
    });
  });

  it("kelebihan dilaporkan sebagai selisih positif", () => {
    const s = tierStatus([line(16, true)], 15);
    expect(s.diff).toBeCloseTo(1, 5);
    expect(s.ok).toBe(false);
  });

  it("selisih di bawah 0,01 masih dianggap pas", () => {
    expect(tierStatus([line(15.005, true)], 15).ok).toBe(true);
  });
});

describe("total tier selalu tepat selama ada baris terbuka", () => {
  it.each([1, 2, 3, 4, 6, 7, 9, 11])("%i baris terbuka di target 25%%", (n) => {
    const out = allocateTier(
      Array.from({ length: n }, () => line(0)),
      25,
    );
    expect(total(out)).toBeCloseTo(25, 10);
  });
});
