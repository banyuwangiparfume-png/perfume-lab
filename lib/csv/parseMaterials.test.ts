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
    expect(rows[0].prices).toEqual([{ tier_size: 500, price_idr: 7_524_000 }]);
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

  it("CAS yang sama dengan nama beda TETAP diterima — itu produk berbeda", () => {
    // Kasus nyata dari pricelist Ecofragrantica 2026: satu CAS dipakai produk
    // yang beda pelarut, beda grade, atau beda nama dagang. Menolaknya berarti
    // membuang produk yang betul-betul dijual.
    const { rows, failures } = parseMaterialRows(
      [
        row({ name: "Benzoin 50-etha", cas_number: "9000-05-09" }),
        row({ name: "Benzoin 50-bb", cas_number: "9000-05-09" }),
      ],
      identityMap,
    );
    expect(failures).toHaveLength(0);
    expect(rows.map((r) => r.name)).toEqual([
      "Benzoin 50-etha",
      "Benzoin 50-bb",
    ]);
  });

  it("karakter tak terlihat dibuang dari nama", () => {
    // U+2060 (word joiner) terbawa saat teks ditempel ke Excel. Kalau tidak
    // dibuang, "Vanillin" tidak akan pernah cocok dengan "Vanillin".
    // Ditulis sebagai escape, bukan karakter aslinya — kalau tidak, test ini
    // sendiri jadi tidak bisa dibaca di editor mana pun.
    const { rows } = parseMaterialRows(
      [row({ name: String.fromCodePoint(0x2060) + "Vanillin", synonym: "Methyl" + String.fromCodePoint(0x200b) + " Vanillin" })],
      identityMap,
    );
    expect(rows[0].name).toBe("Vanillin");
    expect(rows[0].synonym).toBe("Methyl Vanillin");
  });

  it("spasi berlebih dan baris baru dari sel Excel dirapikan", () => {
    const { rows } = parseMaterialRows(
      [row({ name: "  Iso E   Super" + String.fromCharCode(10) + " Pure " })],
      identityMap,
    );
    expect(rows[0].name).toBe("Iso E Super Pure");
  });

  it("nama ganda ditolak supaya import tetap idempoten", () => {
    // Nama produk adalah identitasnya, jadi di sinilah duplikat sungguhan
    // tertangkap — termasuk saat keduanya punya CAS.
    const { failures } = parseMaterialRows([row(), row()], identityMap);
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
