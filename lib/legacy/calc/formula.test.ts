import { describe, expect, it } from "vitest";
import { fo, rm, sub } from "./__fixtures__/lines";
import { expandLines } from "./expand";
import { aggregateImpact, computeFormula } from "./formula";
import type { CalcLine } from "./types";

const sumOf = (xs: (number | null)[]) =>
  xs.reduce<number>((a, b) => a + (b ?? 0), 0);

describe("berat murni & dilusi", () => {
  it("bahan 1,000 g @ 10% menghasilkan berat murni 0,100 g", () => {
    const r = computeFormula([rm("Ambroxan", 1, 400, { dilutionPct: 10 })]);
    expect(r.rows[0].neatWeightG).toBeCloseTo(0.1, 10);
  });

  it("bahan dengan dilusi 10% kontribusinya sepersepuluh bahan neat yang sama", () => {
    // Dua bahan impact sama, berat timbang sama, salah satunya 10%.
    const r = computeFormula([
      rm("Neat", 1, 100),
      rm("Encer", 1, 100, { dilutionPct: 10 }),
    ]);
    const [neat, diluted] = r.rows;
    expect(diluted.strengthPct! / neat.strengthPct!).toBeCloseTo(0.1, 10);
  });

  it("mengubah dilusi tidak mengubah berat timbang", () => {
    const line = rm("Iso E Super", 2.5, 40, { dilutionPct: 10 });
    const r = computeFormula([line]);
    expect(r.rows[0].weightG).toBe(2.5);
    expect(r.totals.weighedG).toBe(2.5);
    expect(r.totals.neatG).toBeCloseTo(0.25, 10);
  });
});

describe("total persen", () => {
  const lines = [
    rm("Hedione", 26, 65),
    rm("Galaxolide", 18, 60),
    rm("Musk T", 24, 40),
    rm("Iso E Super", 20, 40),
    rm("Ambroxan", 2, 400),
    rm("Bacdanol", 4, 80),
    rm("Cashmeran", 3, 80),
    rm("Sandalore", 3, 75),
  ];

  it("total % murni 100", () => {
    const r = computeFormula(lines);
    expect(sumOf(r.rows.map((x) => x.neatPct))).toBeCloseTo(100, 6);
  });

  it("total % kekuatan 100", () => {
    const r = computeFormula(lines);
    expect(sumOf(r.rows.map((x) => x.strengthPct))).toBeCloseTo(100, 6);
  });

  it("cocok dengan tabel contoh di PRD — Ambroxan 2% berat ~13,1% kekuatan", () => {
    const r = computeFormula(lines);
    const ambroxan = r.rows.find((x) => x.label === "Ambroxan")!;
    const isoE = r.rows.find((x) => x.label === "Iso E Super")!;
    expect(ambroxan.neatPct).toBeCloseTo(2, 6);
    expect(ambroxan.strengthPct!).toBeCloseTo(13.1, 1);
    // Leverage 10x: porsi 2% punya kekuatan setara porsi 20%.
    expect(ambroxan.strengthPct!).toBeCloseTo(isoE.strengthPct!, 1);
  });
});

describe("impact kosong", () => {
  it("strengthComplete false dan bahannya dilaporkan, bukan dianggap nol", () => {
    const r = computeFormula([rm("Ada", 5, 100), rm("Kosong", 5, null)]);
    expect(r.strengthComplete).toBe(false);
    expect(r.missingImpact).toEqual(["Kosong"]);
    expect(r.rows[1].strengthPct).toBeNull();
    expect(r.rows[1].effectiveImpact).toBeNull();
    // Kalau dianggap impact 0, "Ada" tetap 100% — jadi angka itu sendiri
    // bukan bukti. Yang membuktikan: basisnya turun ke 50%, dan app wajib
    // mengatakan bahwa hasilnya belum lengkap.
    expect(r.strengthBasis).toBeCloseTo(50, 6);
    expect(r.rows[0].strengthPct).toBeCloseTo(100, 6);
  });
});

describe("baris FO", () => {
  it("strengthPct null, tapi weightPct dan biaya tetap terhitung", () => {
    const r = computeFormula([
      fo("Tabbac 28", 94, { pricePerGram: 1000 }),
      rm("Booster", 6, 100, { pricePerGram: 5000 }),
    ]);
    const foRow = r.rows[0];
    expect(foRow.strengthPct).toBeNull();
    expect(foRow.effectiveImpact).toBeNull();
    expect(foRow.neatPct).toBeCloseTo(94, 6);
    expect(foRow.costIdr).toBeCloseTo(94_000, 6);
    expect(r.totals.costIdr).toBeCloseTo(94_000 + 30_000, 6);
  });

  it("strengthBasis = 6% untuk formula 94% FO + 6% booster", () => {
    const r = computeFormula([fo("Tabbac 28", 94), rm("Booster", 6, 100)]);
    expect(r.strengthBasis).toBeCloseTo(6, 6);
    expect(r.foNeatShare).toBeCloseTo(94, 6);
    expect(r.hasFO).toBe(true);
    expect(r.foCount).toBe(1);
    expect(r.strengthComplete).toBe(false);
  });

  it("FO tidak diperlakukan sebagai impact 0 — menambah FO tidak menurunkan % kekuatan bahan lain", () => {
    const tanpaFo = computeFormula([rm("A", 3, 100), rm("B", 3, 50)]);
    const denganFo = computeFormula([
      rm("A", 3, 100),
      rm("B", 3, 50),
      fo("Tabbac 28", 94),
    ]);
    expect(denganFo.rows[0].strengthPct!).toBeCloseTo(
      tanpaFo.rows[0].strengthPct!,
      10,
    );
    expect(denganFo.rows[1].strengthPct!).toBeCloseTo(
      tanpaFo.rows[1].strengthPct!,
      10,
    );
  });

  it("foNeatShare benar walau baris FO bukan di awal daftar", () => {
    // Regresi: menjumlahkan neat FO lewat indeks hasil filter akan salah
    // membaca indeks baris lain.
    const r = computeFormula([
      rm("A", 10, 100),
      fo("FO-1", 60),
      rm("B", 10, 100),
      fo("FO-2", 20),
    ]);
    expect(r.foNeatShare).toBeCloseTo(80, 6);
    expect(r.foCount).toBe(2);
    expect(r.strengthBasis).toBeCloseTo(20, 6);
  });

  it("beberapa FO dilaporkan dengan porsi terurut dan family-nya", () => {
    const r = computeFormula([
      fo("FO kecil", 30, { family: "Woody" }),
      fo("FO besar", 70, { family: "Tobacco" }),
    ]);
    expect(r.foShares.map((f) => f.label)).toEqual(["FO besar", "FO kecil"]);
    expect(r.foShares[0].share).toBeCloseTo(70, 6);
    expect(r.foFamilies).toEqual(["Woody", "Tobacco"]);
  });
});

describe("sub-formula", () => {
  // Jasmine-ish accord: C kuat sedikit, D lemah banyak.
  const accord: CalcLine[] = [rm("C", 2, 200), rm("D", 3, 20)];

  it("impact agregat = rata-rata tertimbang berat murni", () => {
    // (2x200 + 3x20) / 5 = 92
    expect(aggregateImpact(accord)!).toBeCloseTo(92, 10);
  });

  it("impact agregat tidak berubah kalau seluruh berat diskalakan", () => {
    const scaled = accord.map((l) => ({ ...l, weightG: l.weightG * 7.5 }));
    expect(aggregateImpact(scaled)!).toBeCloseTo(aggregateImpact(accord)!, 10);
  });

  it("null kalau ada penyusun yang impact-nya kosong", () => {
    expect(aggregateImpact([rm("C", 2, 200), rm("X", 1, null)])).toBeNull();
  });

  it("null kalau sub-formula mengandung FO", () => {
    expect(aggregateImpact([rm("C", 2, 200), fo("FO", 1)])).toBeNull();
  });

  it("% kekuatan IDENTIK dengan formula sama yang ditulis datar", () => {
    const flat = computeFormula([
      rm("A", 5, 100),
      rm("B", 5, 50),
      rm("C", 2, 200),
      rm("D", 3, 20),
    ]);
    const nested = computeFormula([
      rm("A", 5, 100),
      rm("B", 5, 50),
      sub("Jasmine Accord v3", 5, accord),
    ]);

    expect(nested.rows[0].strengthPct!).toBeCloseTo(
      flat.rows[0].strengthPct!,
      10,
    );
    expect(nested.rows[1].strengthPct!).toBeCloseTo(
      flat.rows[1].strengthPct!,
      10,
    );
    // Baris sub-formula = gabungan porsi C dan D di versi datar.
    expect(nested.rows[2].strengthPct!).toBeCloseTo(
      flat.rows[2].strengthPct! + flat.rows[3].strengthPct!,
      10,
    );
    expect(nested.rows[2].impactIsAggregate).toBe(true);
  });

  it("identik juga setelah dibentangkan, walau berat barisnya beda skala", () => {
    const flat = computeFormula([
      rm("A", 10, 100),
      rm("C", 4, 200),
      rm("D", 6, 20),
    ]);
    // Accord dipakai 10 g padahal resep aslinya 5 g: penyusunnya harus
    // terskala 2x saat dibentangkan.
    const nested = computeFormula(
      expandLines([rm("A", 10, 100), sub("Accord", 10, accord)]),
    );
    expect(nested.rows.map((r) => r.label)).toEqual(["A", "C", "D"]);
    expect(nested.rows[1].weightG).toBeCloseTo(4, 10);
    expect(nested.rows[2].weightG).toBeCloseTo(6, 10);
    flat.rows.forEach((f, i) => {
      expect(nested.rows[i].strengthPct!).toBeCloseTo(f.strengthPct!, 10);
    });
  });

  it("dilusi pada baris sub-formula ikut diperhitungkan", () => {
    // Accord disimpan encer 50% di rak: 10 g @ 50% = 5 g murni.
    const r = computeFormula([
      rm("A", 5, 100),
      rm("B", 5, 50),
      sub("Accord encer", 10, accord, { dilutionPct: 50 }),
    ]);
    expect(r.rows[2].neatWeightG).toBeCloseTo(5, 10);
    const flat = computeFormula([
      rm("A", 5, 100),
      rm("B", 5, 50),
      rm("C", 2, 200),
      rm("D", 3, 20),
    ]);
    expect(r.rows[2].strengthPct!).toBeCloseTo(
      flat.rows[2].strengthPct! + flat.rows[3].strengthPct!,
      10,
    );
  });
});

describe("biaya", () => {
  it("memakai berat murni, bukan berat timbang", () => {
    // 1 g larutan 10% hanya memakai 0,1 g bahan seharga Rp15.000/g.
    const r = computeFormula([
      rm("Ambroxan", 1, 400, { dilutionPct: 10, pricePerGram: 15_000 }),
    ]);
    expect(r.rows[0].costIdr).toBeCloseTo(1_500, 6);
    expect(r.totals.costPerGram).toBeCloseTo(15_000, 6);
  });

  it("biaya total null kalau ada baris yang harganya belum ada", () => {
    const r = computeFormula([
      rm("Ada harga", 5, 100, { pricePerGram: 1000 }),
      rm("Belum ada harga", 5, 100),
    ]);
    expect(r.totals.costIdr).toBeNull();
    expect(r.totals.costPerGram).toBeNull();
    expect(r.totals.missingPrice).toEqual(["Belum ada harga"]);
  });
});

describe("kasus tepi", () => {
  it("formula kosong tidak membuat pembagian nol", () => {
    const r = computeFormula([]);
    expect(r.rows).toEqual([]);
    expect(r.totals.weighedG).toBe(0);
    expect(r.strengthBasis).toBe(0);
    expect(r.lead).toBeNull();
    expect(Number.isFinite(r.foNeatShare)).toBe(true);
  });

  it("formula satu bahan tidak membuat pembagian nol", () => {
    const r = computeFormula([rm("Solo", 10, 100)]);
    expect(r.rows[0].strengthPct!).toBeCloseTo(100, 6);
    expect(r.rows[0].neatPct).toBeCloseTo(100, 6);
    expect(r.lead!.label).toBe("Solo");
  });

  it("baris berat nol tidak dinilai dan tidak merusak total", () => {
    const r = computeFormula([rm("Ada", 10, 100), rm("Nol", 0, 100)]);
    expect(r.rows[1].strengthPct).toBeNull();
    expect(r.rows[0].strengthPct!).toBeCloseTo(100, 6);
  });

  it("formula yang isinya hanya FO: tidak ada yang dinilai, tapi tidak error", () => {
    const r = computeFormula([fo("Tabbac 28", 100)]);
    expect(r.strengthBasis).toBe(0);
    expect(r.rows[0].strengthPct).toBeNull();
    expect(r.lead).toBeNull();
  });
});

describe("sebaran kategori fungsi", () => {
  it("dihitung dari % kekuatan, bukan % berat", () => {
    const r = computeFormula([
      rm("Diffuser kecil", 2, 400, { functionCategory: "diffuser" }),
      rm("Fixative besar", 18, 40, { functionCategory: "fixative" }),
    ]);
    // 2x400 = 800 vs 18x40 = 720 → diffuser menang walau beratnya 9x lebih kecil
    expect(r.functionShares.diffuser).toBeGreaterThan(
      r.functionShares.fixative,
    );
    expect(
      r.functionShares.diffuser + r.functionShares.fixative,
    ).toBeCloseTo(100, 6);
  });
});
