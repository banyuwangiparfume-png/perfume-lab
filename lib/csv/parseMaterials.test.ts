import { describe, expect, it } from "vitest";
import {
  guessColumnMap,
  MATERIAL_COLUMNS,
  parseMaterialRows,
} from "./parseMaterials";

const identityMap = Object.fromEntries(
  MATERIAL_COLUMNS.map((c) => [c, c]),
) as Record<(typeof MATERIAL_COLUMNS)[number], string>;

const row = (over: Record<string, unknown> = {}) => ({
  name: "Ambroxan",
  synonym: "Ambrofix",
  cas_number: "6790-58-5",
  family: "Amber",
  category: "Aromachemical",
  odour_profile: "ambergris sweet",
  function_category: "Modifier",
  odor_impact: "400",
  tgsc_url: "",
  price_5g: "",
  price_10g: "",
  price_50g: "",
  price_100g: "",
  price_500g: "7524000",
  ...over,
});

describe("guessColumnMap", () => {
  it("mengenali header standar", () => {
    const map = guessColumnMap([
      "name",
      "CAS No",
      "Odour Profile",
      "Function Category",
      "Impact",
    ]);
    expect(map.name).toBe("name");
    expect(map.cas_number).toBe("CAS No");
    expect(map.odour_profile).toBe("Odour Profile");
    expect(map.function_category).toBe("Function Category");
    expect(map.odor_impact).toBe("Impact");
  });

  it("header yang tidak dikenal diabaikan, bukan ditebak sembarangan", () => {
    expect(guessColumnMap(["Kolom Aneh"])).toEqual({});
  });
});

describe("parseMaterialRows", () => {
  it("memetakan baris yang lengkap", () => {
    const { rows, failures } = parseMaterialRows([row()], identityMap);
    expect(failures).toEqual([]);
    expect(rows[0]).toMatchObject({
      name: "Ambroxan",
      cas_number: "6790-58-5",
      function_category: "modifier",
      odor_impact: 400,
    });
    expect(rows[0].prices).toEqual([{ tier_grams: 500, price_idr: 7_524_000 }]);
  });

  it("impact kosong disimpan sebagai null, bukan 0", () => {
    const { rows } = parseMaterialRows([row({ odor_impact: "" })], identityMap);
    expect(rows[0].odor_impact).toBeNull();
  });

  it('penanda data kosong seperti "-" juga jadi null', () => {
    const { rows } = parseMaterialRows(
      [row({ odor_impact: "-", family: "n/a" })],
      identityMap,
    );
    expect(rows[0].odor_impact).toBeNull();
    expect(rows[0].family).toBeNull();
  });

  it('impact "n/a" dianggap kosong, tapi teks lain dilaporkan gagal', () => {
    const { failures } = parseMaterialRows(
      [row({ odor_impact: "kuat sekali" })],
      identityMap,
    );
    expect(failures[0]).toMatchObject({ line: 1 });
    expect(failures[0].reason).toContain("odor_impact bukan angka");
  });

  it("nama kosong dilaporkan dengan nomor barisnya", () => {
    const { rows, failures } = parseMaterialRows(
      [row(), row({ name: "   " })],
      identityMap,
    );
    expect(rows).toHaveLength(1);
    expect(failures[0]).toMatchObject({ line: 2, reason: "nama kosong" });
  });

  it("CAS ganda dilaporkan beserta baris pasangannya", () => {
    const { failures } = parseMaterialRows(
      [row(), row({ name: "Ambrofix" })],
      identityMap,
    );
    expect(failures[0].reason).toBe("CAS ganda dengan baris 1");
  });

  it("nama ganda tanpa CAS ditolak supaya import tetap idempoten", () => {
    const { failures } = parseMaterialRows(
      [row({ cas_number: "" }), row({ cas_number: "" })],
      identityMap,
    );
    expect(failures[0].reason).toContain("nama ganda dengan baris 1");
  });

  it("kategori fungsi tidak dikenal dilaporkan, tidak ditebak", () => {
    const { failures } = parseMaterialRows(
      [row({ function_category: "Booster" })],
      identityMap,
    );
    expect(failures[0].reason).toContain('"Booster" tidak dikenal');
  });

  it("kategori fungsi kosong tetap diimpor", () => {
    const { rows, failures } = parseMaterialRows(
      [row({ function_category: "" })],
      identityMap,
    );
    expect(failures).toEqual([]);
    expect(rows[0].function_category).toBeNull();
  });

  it("harga dengan pemisah ribuan titik dibaca benar", () => {
    const { rows } = parseMaterialRows(
      [row({ price_500g: "7.524.000" })],
      identityMap,
    );
    expect(rows[0].prices[0].price_idr).toBe(7_524_000);
  });

  it("harga dengan pemisah ribuan koma dibaca benar", () => {
    const { rows } = parseMaterialRows(
      [row({ price_500g: "7,524,000" })],
      identityMap,
    );
    expect(rows[0].prices[0].price_idr).toBe(7_524_000);
  });

  it('prefix "Rp" dan spasi dibuang', () => {
    const { rows } = parseMaterialRows(
      [row({ price_500g: "Rp 7.524.000" })],
      identityMap,
    );
    expect(rows[0].prices[0].price_idr).toBe(7_524_000);
  });

  it("koma desimal pada impact dibaca benar", () => {
    const { rows } = parseMaterialRows(
      [row({ odor_impact: "92,5" })],
      identityMap,
    );
    expect(rows[0].odor_impact).toBeCloseTo(92.5, 6);
  });

  it("harga nol atau kosong tidak membuat baris harga", () => {
    const { rows } = parseMaterialRows(
      [row({ price_500g: "0" })],
      identityMap,
    );
    expect(rows[0].prices).toEqual([]);
  });

  it("kolom yang tidak dipetakan diabaikan tanpa error", () => {
    const { rows, failures } = parseMaterialRows(
      [{ Nama: "Hedione", Impact: "65" }],
      { name: "Nama", odor_impact: "Impact" },
    );
    expect(failures).toEqual([]);
    expect(rows[0]).toMatchObject({ name: "Hedione", odor_impact: 65 });
    expect(rows[0].family).toBeNull();
  });
});
