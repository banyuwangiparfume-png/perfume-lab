import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { fixture, fixtureContext } from "./fixture";

/**
 * Tabel per baris tidak boleh jadi jalur hitung kedua. Test di sini tidak
 * memperkenalkan angka baru — semuanya diikat ke hasil yang sudah terbukti di
 * fixture.test.ts, supaya kalau dua tabel mulai berbeda, di sini yang merah.
 */

const ctx = fixtureContext();
const result = analyze(ctx);
const lines = result.lines;
const TOL = fixture.tolerance.strengthAndAroma;

const byName = (name: string) => lines.rows.find((r) => r.name === name);

describe("lineTable — kerangka", () => {
  it("satu baris untuk tiap baris formula, urutannya sama", () => {
    expect(lines.rows).toHaveLength(ctx.version.lines.length);
    expect(lines.rows.map((r) => r.lineId)).toEqual(
      ctx.version.lines.map((l) => l.id),
    );
  });

  it("nomornya urut dari 1", () => {
    expect(lines.rows.map((r) => r.no)).toEqual(
      ctx.version.lines.map((_, i) => i + 1),
    );
  });
});

describe("lineTable — sepakat dengan tabel kekuatan", () => {
  it("kolom kekuatan + pelarut dari dilusi = 100%", () => {
    // Bukan 100% sendiri: pelarut hasil dilusi berbau tapi bukan milik baris
    // mana pun, jadi selisihnya dilaporkan terpisah daripada dibagi diam-diam.
    expect(
      lines.total.strengthPct + lines.total.dilutionSolventStrengthPct,
    ).toBeCloseTo(100, 6);
  });

  it("fixture ini memang punya pelarut dari dilusi yang berbau", () => {
    // Kalau ini nol, dua test di atas jadi tidak menguji apa pun.
    expect(lines.total.dilutionSolventStrengthPct).toBeGreaterThan(0);
  });

  it("bahan yang cuma muncul di satu baris punya kekuatan yang sama di dua tabel", () => {
    // Bahan yang datang dari beberapa tempat (mis. Benzyl Benzoate) memang
    // beda: tabel kekuatan menggabungkannya, tabel baris tidak. Yang tunggal
    // harus sama persis.
    const lineCount = new Map<string, number>();
    for (const l of ctx.version.lines) {
      lineCount.set(l.refId, (lineCount.get(l.refId) ?? 0) + 1);
    }

    const singles = result.strength.rows.filter(
      (r) =>
        r.kind === "material" &&
        lineCount.get(r.refId) === 1 &&
        r.viaAccordPct === 0 &&
        !r.isSolvent,
    );

    expect(singles.length).toBeGreaterThan(3);
    for (const row of singles) {
      expect(byName(row.name)?.strengthPct).toBeCloseTo(
        row.strengthPct!,
        TOL,
      );
    }
  });

  it("kekuatan tiap bahan = jumlah baris yang memuatnya", () => {
    for (const row of result.strength.rows) {
      if (row.kind === "fo") continue;
      const fromLines = lines.rows
        .filter(
          (r) => r.kind === "raw_material" && r.refId === row.refId,
        )
        .reduce((a, r) => a + (r.strengthPct ?? 0), 0);
      // Bahan yang juga datang lewat accord atau lewat dilusi punya porsi yang
      // tercatat di baris LAIN, jadi hanya yang murni-langsung bisa dibanding.
      if (row.viaAccordPct > 0 || row.productPct !== row.weighPct) continue;
      expect(fromLines).toBeCloseTo(row.strengthPct!, TOL);
    }
  });
});

describe("lineTable — murni dan dilusi", () => {
  it("total murni sama dengan jumlah bahan aktif di piramida nyata", () => {
    const fromPyramid = result.realPyramid.reduce((a, r) => a + r.active, 0);
    expect(lines.total.activePct).toBeCloseTo(fromPyramid, 8);
  });

  it("total persen tetap 100%", () => {
    expect(lines.total.pct).toBeCloseTo(100, 8);
  });

  it("baris pelarut yang diketik langsung tidak dihitung sebagai murni", () => {
    const bb = byName("Benzyl Benzoate");
    expect(bb).toBeDefined();
    expect(bb!.pct).toBeGreaterThan(0);
    expect(bb!.activePct).toBe(0);
  });

  it("dilusi user memotong murni: Ambroxan 5% @10% -> 0,5%", () => {
    const amb = byName("Ambroxan")!;
    expect(amb.pct).toBeCloseTo(5, 10);
    expect(amb.userDilutionPct).toBeCloseTo(10, 10);
    expect(amb.activePct).toBeCloseTo(0.5, 10);
  });

  it("dilusi supplier ikut terpotong dan terlaporkan terpisah", () => {
    const diluted = lines.rows.filter((r) => r.supplierDilutionPct !== null);
    expect(diluted.length).toBeGreaterThan(0);
    for (const r of diluted) {
      expect(r.supplierDilutionPct!).toBeLessThan(100);
      // murni = pct x dilusi user x dilusi supplier
      expect(r.activePct).toBeCloseTo(
        r.pct *
          (r.userDilutionPct / 100) *
          (r.supplierDilutionPct! / 100),
        8,
      );
    }
  });
});

describe("lineTable — impact", () => {
  it("raw material memakai nilai impact bahannya apa adanya", () => {
    for (const row of lines.rows) {
      if (row.kind !== "raw_material") continue;
      const m = ctx.materials.get(row.refId)!;
      if (m.impact == null) continue;
      expect(row.impact).toBeCloseTo(m.impact, 8);
      expect(row.impactIsAverage).toBe(false);
    }
  });

  it("FO tidak punya impact maupun kekuatan — null, bukan nol", () => {
    for (const row of lines.rows) {
      if (row.kind !== "fo") continue;
      expect(row.impact).toBeNull();
      expect(row.strengthPct).toBeNull();
    }
  });
});

describe("lineTable — isi accord", () => {
  it("hanya baris accord yang punya sub-baris", () => {
    for (const row of lines.rows) {
      if (row.kind === "accord") continue;
      expect(row.sub).toEqual([]);
    }
  });

  it("sub-baris sudah diskalakan ke porsinya di formula induk", () => {
    for (const row of lines.rows) {
      if (row.kind !== "accord") continue;
      const total = row.sub.reduce((a, s) => a + s.productPct, 0);
      // Isi accord mengisi persen baris itu, bukan 100%.
      expect(total).toBeCloseTo(row.pct * (row.userDilutionPct / 100), 8);
      expect(row.sub.length).toBeGreaterThan(0);
    }
  });

  it("sub-baris diurut dari porsi terbesar", () => {
    for (const row of lines.rows) {
      if (row.kind !== "accord") continue;
      const pcts = row.sub.map((s) => s.productPct);
      expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
    }
  });
});
