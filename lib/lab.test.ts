import { describe, expect, it } from "vitest";
import {
  defaultPurpose,
  generateBlindCode,
  labStage,
  macerationDays,
  oilRestHours,
} from "./lab";

const NOW = new Date("2026-10-20T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("umur fase", () => {
  it("oil rest dihitung dari mixed_at", () => {
    expect(oilRestHours(hoursAgo(30), NOW)).toBe(30);
  });

  it("maserasi dihitung dari diluted_at, BUKAN mixed_at", () => {
    const version = { mixed_at: daysAgo(21), diluted_at: daysAgo(3) };
    expect(macerationDays(version.diluted_at, NOW)).toBe(3);
    // Kalau rumusnya salah pakai mixed_at, angkanya jadi 21 — kelebihan
    // 18 hari, dan compare antar versi langsung jadi menyesatkan.
    expect(macerationDays(version.diluted_at, NOW)).not.toBe(21);
  });

  it("belum diencerkan menghasilkan null, bukan nol", () => {
    expect(macerationDays(null, NOW)).toBeNull();
    expect(oilRestHours(null, NOW)).toBeNull();
  });

  it("tanggal di masa depan tidak menghasilkan umur negatif", () => {
    expect(macerationDays(hoursAgo(-48), NOW)).toBe(0);
  });
});

describe("labStage", () => {
  it("belum dicampur", () => {
    expect(labStage({ mixed_at: null, diluted_at: null }, NOW).key).toBe(
      "belum_dicampur",
    );
  });

  it("baru dicampur beberapa jam masih fase minyak", () => {
    const stage = labStage({ mixed_at: hoursAgo(5), diluted_at: null }, NOW);
    expect(stage.key).toBe("oil_rest");
    expect(stage.detail).toContain("5 jam");
  });

  it("lewat 24 jam jadi siap diencerkan", () => {
    expect(
      labStage({ mixed_at: hoursAgo(26), diluted_at: null }, NOW).key,
    ).toBe("siap_diencerkan");
  });

  it("sudah diencerkan masuk maserasi", () => {
    const stage = labStage(
      { mixed_at: daysAgo(4), diluted_at: daysAgo(3) },
      NOW,
    );
    expect(stage.key).toBe("maserasi");
    expect(stage.detail).toContain("hari ke-3");
  });

  it("maserasi 14 hari ke atas jadi siap final", () => {
    expect(
      labStage({ mixed_at: daysAgo(22), diluted_at: daysAgo(21) }, NOW).key,
    ).toBe("siap_final");
  });
});

describe("defaultPurpose", () => {
  it("di bawah 14 hari default screening", () => {
    expect(defaultPurpose(3)).toBe("screening");
    expect(defaultPurpose(13)).toBe("screening");
  });

  it("14 hari ke atas default final", () => {
    expect(defaultPurpose(14)).toBe("final");
    expect(defaultPurpose(30)).toBe("final");
  });

  it("umur tidak diketahui default screening — pilihan yang lebih aman", () => {
    expect(defaultPurpose(null)).toBe("screening");
  });
});

describe("generateBlindCode", () => {
  it("3 huruf", () => {
    expect(generateBlindCode()).toMatch(/^[A-Z]{3}$/);
  });

  it("tidak memakai huruf I dan O yang gampang tertukar dengan 1 dan 0", () => {
    const codes = Array.from({ length: 400 }, () => generateBlindCode()).join("");
    expect(codes).not.toMatch(/[IO]/);
  });

  it("urutannya tidak bisa ditebak — 200 kode menghasilkan banyak nilai berbeda", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateBlindCode()));
    // Penghitung berurutan atau nilai tetap akan jatuh jauh di bawah ini.
    expect(codes.size).toBeGreaterThan(150);
  });
});
