import { describe, expect, it } from "vitest";
import {
  runCompareRules,
  type CompareEvaluation,
  type CompareSubject,
} from "./compare";
import type { Finding } from "./index";

const base: CompareEvaluation = {
  evaluatorName: "Bayu",
  purpose: "screening",
  medium: "blotter",
  dilutedIn: "20% in ethanol",
  macerationDays: 3,
  blindCode: null,
};

const subject = (
  label: string,
  over: Partial<CompareEvaluation> = {},
): CompareSubject => ({ label, evaluation: { ...base, ...over } });

const has = (fs: Finding[], rule: string) => fs.some((f) => f.rule === rule);
const get = (fs: Finding[], rule: string) => fs.find((f) => f.rule === rule);

describe("Rule 8 — umur maserasi", () => {
  it("selisih lebih dari 7 hari memicu peringatan dan menyebut kedua umurnya", () => {
    const f = runCompareRules([
      subject("v2", { macerationDays: 21 }),
      subject("v3", { macerationDays: 3 }),
    ]);
    const finding = get(f, "compare-maceration-gap")!;
    expect(finding.level).toBe("warning");
    expect(finding.message).toContain("v2 dinilai di umur 21 hari");
    expect(finding.message).toContain("v3 di umur 3 hari");
  });

  it("selisih tepat 7 hari belum memicu peringatan", () => {
    const f = runCompareRules([
      subject("v1", { macerationDays: 10 }),
      subject("v2", { macerationDays: 3 }),
    ]);
    expect(has(f, "compare-maceration-gap")).toBe(false);
  });

  it("menyebut versi paling tua dan paling muda dari tiga versi", () => {
    const finding = get(
      runCompareRules([
        subject("v1", { macerationDays: 10 }),
        subject("v2", { macerationDays: 30 }),
        subject("v3", { macerationDays: 2 }),
      ]),
      "compare-maceration-gap",
    )!;
    expect(finding.message).toContain("v2 dinilai di umur 30 hari");
    expect(finding.message).toContain("v3 di umur 2 hari");
  });

  it("umur yang tidak tercatat dilewati, tidak dianggap nol", () => {
    const f = runCompareRules([
      subject("v1", { macerationDays: null }),
      subject("v2", { macerationDays: 20 }),
    ]);
    expect(has(f, "compare-maceration-gap")).toBe(false);
  });
});

describe("Rule 8 — tujuan penilaian", () => {
  it("screening vs final memicu peringatan", () => {
    const finding = get(
      runCompareRules([
        subject("v2", { purpose: "screening" }),
        subject("v3", { purpose: "final", macerationDays: 3 }),
      ]),
      "compare-purpose",
    )!;
    expect(finding.level).toBe("warning");
    expect(finding.message).toContain("v2 sebagai screening");
    expect(finding.message).toContain("v3 sebagai final");
    expect(finding.message).toContain("tidak sebanding");
  });

  it("tujuan sama tidak memicu apa pun", () => {
    expect(
      has(runCompareRules([subject("v1"), subject("v2")]), "compare-purpose"),
    ).toBe(false);
  });
});

describe("Rule 8 — media dan pengenceran", () => {
  it("blotter vs kulit memicu peringatan", () => {
    const finding = get(
      runCompareRules([
        subject("v1", { medium: "blotter" }),
        subject("v2", { medium: "skin" }),
      ]),
      "compare-medium",
    )!;
    expect(finding.message).toContain("Blotter");
    expect(finding.message).toContain("Kulit");
  });

  it("konsentrasi pengenceran berbeda memicu peringatan", () => {
    const finding = get(
      runCompareRules([
        subject("v1", { dilutedIn: "20% in ethanol" }),
        subject("v2", { dilutedIn: "10% in ethanol" }),
      ]),
      "compare-dilution",
    )!;
    expect(finding.message).toContain("20% in ethanol");
    expect(finding.message).toContain("10% in ethanol");
  });

  it("salah satu tidak mencatat pengenceran tetap dianggap berbeda", () => {
    const finding = get(
      runCompareRules([
        subject("v1", { dilutedIn: "20% in ethanol" }),
        subject("v2", { dilutedIn: null }),
      ]),
      "compare-dilution",
    )!;
    expect(finding.message).toContain("tidak dicatat");
  });
});

describe("Rule 8 — penilai", () => {
  it("penilai berbeda tanpa kode buta memberi info", () => {
    const finding = get(
      runCompareRules([
        subject("v1", { evaluatorName: "Bayu" }),
        subject("v2", { evaluatorName: "Rina" }),
      ]),
      "compare-evaluator",
    )!;
    expect(finding.level).toBe("info");
    expect(finding.message).toContain("kode buta");
  });

  it("penilai berbeda TAPI memakai kode buta tidak diperingatkan", () => {
    const f = runCompareRules([
      subject("v1", { evaluatorName: "Bayu", blindCode: "QTX" }),
      subject("v2", { evaluatorName: "Rina", blindCode: "MKD" }),
    ]);
    expect(has(f, "compare-evaluator")).toBe(false);
  });

  it("penilai sama tidak diperingatkan", () => {
    expect(
      has(
        runCompareRules([subject("v1"), subject("v2")]),
        "compare-evaluator",
      ),
    ).toBe(false);
  });
});

describe("Rule 8 — kasus tepi", () => {
  it("kondisi identik tidak memunculkan peringatan palsu", () => {
    expect(runCompareRules([subject("v1"), subject("v2"), subject("v3")])).toEqual(
      [],
    );
  });

  it("kurang dari dua evaluasi tidak menghasilkan temuan", () => {
    expect(runCompareRules([subject("v1")])).toEqual([]);
    expect(
      runCompareRules([
        subject("v1"),
        { label: "v2", evaluation: null },
      ]),
    ).toEqual([]);
  });

  it("tidak ada temuan yang memblokir — semuanya info atau warning", () => {
    const f = runCompareRules([
      subject("v1", {
        macerationDays: 30,
        purpose: "final",
        medium: "skin",
        dilutedIn: "10%",
        evaluatorName: "Bayu",
      }),
      subject("v2", {
        macerationDays: 1,
        purpose: "screening",
        medium: "blotter",
        dilutedIn: "20%",
        evaluatorName: "Rina",
      }),
    ]);
    expect(f.length).toBe(5);
    expect(f.every((x) => x.level !== "critical")).toBe(true);
  });
});
