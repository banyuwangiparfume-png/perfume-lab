import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { functionMix, shareOf, UNKNOWN_KEY } from "../functions";
import { fixtureContext } from "./fixture";

const ctx = fixtureContext();
const result = analyze(ctx);
const mix = result.functions;

describe("functionMix — penyebutnya bahan pewangi saja", () => {
  it("porsi semua peran berjumlah 100%", () => {
    const total = mix.rows.reduce((a, r) => a + r.pct, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it("pelarut dikeluarkan dari penyebut, bukan dihitung sebagai peran", () => {
    // Kalau pelarut ikut, porsi tiap peran mengecil hanya karena formulanya
    // diencerkan — padahal komposisi perannya tidak berubah sama sekali.
    expect(mix.excluded.solventPct).toBeGreaterThan(0);
    for (const row of mix.rows) {
      for (const name of row.materials) {
        const refId = [...ctx.materials.values()].find((m) => m.name === name)?.id;
        expect(ctx.materials.get(refId ?? "")?.isSolvent).not.toBe(true);
      }
    }
  });

  it("fixture ini memang punya pelarut — kalau tidak, test di atas kosong", () => {
    expect(mix.excluded.solventPct).toBeGreaterThan(0);
    expect(mix.materialCount).toBeGreaterThan(2);
  });

  it("tiap bahan pewangi masuk tepat satu peran", () => {
    const names = mix.rows.flatMap((r) => r.materials);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(mix.materialCount);
  });
});

describe("functionMix — kategori yang belum terisi", () => {
  it("yang belum berkategori selalu di baris terakhir", () => {
    const i = mix.rows.findIndex((r) => r.key === UNKNOWN_KEY);
    if (i >= 0) expect(i).toBe(mix.rows.length - 1);
  });

  it("coverage = 100% dikurangi porsi yang belum berkategori", () => {
    const unknown = shareOf(mix, UNKNOWN_KEY);
    expect(mix.coverage).toBeCloseTo(100 - unknown, 6);
  });

  it("formula kosong tidak menghasilkan pembagian nol", () => {
    const empty = functionMix({
      rows: [],
      coverage: 0,
      missingImpact: [],
      excludedFoPct: 0,
      totalScore: 0,
    });
    expect(empty.rows).toEqual([]);
    expect(empty.coverage).toBe(0);
    expect(empty.materialCount).toBe(0);
  });
});

describe("R13 — peran fixative", () => {
  const r13 = (ctxLike = ctx) => {
    const a = analyze(ctxLike);
    return a.warnings.filter((w) => w.code === "R13");
  };

  it("tidak menuduh formula saat kategori fungsinya sendiri belum terisi", () => {
    // Bahan tanpa kategori bukan bukti formula kekurangan fixative. Yang
    // dilaporkan harus datanya, bukan formulanya.
    const stripped = fixtureContext();
    for (const m of stripped.materials.values()) m.functionCategory = null;
    const w = r13(stripped);
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain("kategori fungsi");
    expect(w[0].level).toBe("info");
  });

  it("memperingatkan kalau tidak ada fixative sama sekali", () => {
    const none = fixtureContext();
    for (const m of none.materials.values()) {
      // Kapitalisasinya bisa beda antar sumber data; modul hitungnya
      // sendiri sudah menormalkan, jadi di sini juga harus.
      if ((m.functionCategory ?? "").toLowerCase() === "fixative") {
        m.functionCategory = "modifier";
      }
    }
    const w = r13(none);
    expect(w).toHaveLength(1);
    expect(w[0].level).toBe("warning");
    expect(w[0].message).toContain("Fixative");
  });

  it("diam untuk formula yang terlalu kecil untuk dinilai", () => {
    const tiny = fixtureContext();
    tiny.version.lines = tiny.version.lines.slice(0, 1);
    expect(r13(tiny)).toHaveLength(0);
  });
});
