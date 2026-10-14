import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { fixtureContext } from "./fixture";

const ctx = fixtureContext();

const isRole = (v: string | null, role: string) =>
  (v ?? "").toLowerCase() === role;

/**
 * Menyeragamkan asal kategori SELURUH bahan diffuser.
 *
 * Fixture sudah memuat bahan berkategori "Diffuser" dari data aslinya, jadi
 * menyentuh sebagian saja membuat test-nya buta terhadap sisanya.
 */
function withRole(role: "diffuser" | "fixative", source: "supplier" | "derived") {
  const c = fixtureContext();
  let converted = 0;
  for (const m of c.materials.values()) {
    if (isRole(m.functionCategory, role)) {
      m.functionSource = source;
      continue;
    }
    if (converted >= 6) continue;
    if (m.isSolvent) continue;
    if (c.version.lines.some((l) => l.refId === m.id)) continue;
    m.functionCategory = role;
    m.functionSource = source;
    converted++;
  }
  return c;
}

describe("saran peran (diffuser & fixative)", () => {
  it("tidak menyarankan bahan yang sudah ada di formula", () => {
    const result = analyze(withRole("diffuser", "supplier"));
    const used = new Set(ctx.version.lines.map((l) => l.refId));
    for (const s of result.diffusers.all.suggestions) {
      expect(used.has(s.materialId)).toBe(false);
    }
  });

  it("hanya menyarankan bahan berkategori diffuser", () => {
    const c = withRole("diffuser", "supplier");
    const result = analyze(c);
    expect(result.diffusers.all.suggestions.length).toBeGreaterThan(0);
    for (const s of result.diffusers.all.suggestions) {
      expect(
        isRole(c.materials.get(s.materialId)?.functionCategory ?? null, "diffuser"),
      ).toBe(true);
    }
  });

  it("TIDAK menyarankan kategori hasil tebakan", () => {
    // Menyarankan dosis berdasarkan tebakan sendiri menumpuk ketidakpastian
    // di atas ketidakpastian.
    const result = analyze(withRole("diffuser", "derived"));
    expect(result.diffusers.all.suggestions).toHaveLength(0);
  });

  it("diurut dari yang paling searah dengan formula", () => {
    const scores = analyze(withRole("diffuser", "supplier")).diffusers.all.suggestions.map(
      (s) => s.score,
    );
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("porsi diffuser tetap dilaporkan walau sarannya dimatikan", () => {
    const c = withRole("diffuser", "supplier");
    const full = analyze(c);
    const quick = analyze(c, { skipBridges: true });
    expect(quick.diffusers.all.sharePct).toBeCloseTo(full.diffusers.all.sharePct, 8);
    expect(quick.diffusers.all.suggestions).toHaveLength(0);
  });

  it("formula tanpa diffuser melaporkan porsi nol, bukan error", () => {
    const result = analyze(ctx);
    expect(result.diffusers.all.sharePct).toBe(0);
    expect(result.diffusers.all.present).toEqual([]);
  });
});

describe("fixative dipisah dari diffuser", () => {
  it("fixative disarankan ke Base, apa pun kebiasaan bahannya", () => {
    // Yang menahan harus berada di lapisan paling lambat menguap. Mengantarnya
    // ke Top membuat dia ikut hilang duluan bersama yang mau ditahan.
    const c = withRole("fixative", "supplier");
    const result = analyze(c);
    expect(result.fixatives.suggestions.length).toBeGreaterThan(0);
    for (const s of result.fixatives.suggestions) expect(s.tier).toBe("base");
  });

  it("dua peran tidak saling menyarankan bahan yang sama", () => {
    const c = fixtureContext();
    const result = analyze(c);
    const diff = new Set(result.diffusers.all.suggestions.map((s) => s.materialId));
    for (const s of result.fixatives.suggestions) {
      expect(diff.has(s.materialId)).toBe(false);
    }
  });

  it("porsi tiap peran tetap dilaporkan walau sarannya dimatikan", () => {
    const c = withRole("fixative", "supplier");
    const full = analyze(c);
    const quick = analyze(c, { skipBridges: true });
    expect(quick.fixatives.sharePct).toBeCloseTo(full.fixatives.sharePct, 8);
    expect(quick.fixatives.role).toBe("fixative");
  });
});

describe("diffuser per sasaran", () => {
  it("tiap tier punya laporannya sendiri saat mode piramida aktif", () => {
    const result = analyze(withRole("diffuser", "supplier"));
    for (const t of ["all", "top", "mid", "base"] as const) {
      expect(result.diffusers[t].scope).toBe(t);
      expect(result.diffusers[t].role).toBe("diffuser");
    }
  });

  it("tanpa piramida, laporan per tier kosong — bukan diisi salinan Semua", () => {
    const c = withRole("diffuser", "supplier");
    c.version.pyramid = null;
    for (const l of c.version.lines) l.tier = "all";
    const result = analyze(c);
    expect(result.diffusers.all.suggestions.length).toBeGreaterThan(0);
    for (const t of ["top", "mid", "base"] as const) {
      expect(result.diffusers[t].suggestions).toEqual([]);
    }
  });

  it("'searah dengan' cuma menyebut bahan dari tier sasarannya", () => {
    const c = withRole("diffuser", "supplier");
    const result = analyze(c);
    for (const t of ["top", "mid", "base"] as const) {
      const inTier = new Set(
        result.items.filter((i) => i.tier === t).map((i) => i.refId),
      );
      for (const s of result.diffusers[t].suggestions) {
        for (const l of s.lifts) expect(inTier.has(l.refId)).toBe(true);
      }
    }
  });

  it("'searah dengan' tidak pernah menyebut pelarut", () => {
    const c = withRole("diffuser", "supplier");
    const result = analyze(c);
    for (const s of result.diffusers.all.suggestions) {
      for (const l of s.lifts) {
        expect(c.materials.get(l.refId)?.isSolvent).toBeFalsy();
      }
    }
  });

  it("dosis per tier tetap mengikuti kebiasaan bahannya, bukan tier sasarannya", () => {
    // Menaruh Hedione di Top tidak membuatnya menguap lebih cepat.
    const c = withRole("diffuser", "supplier");
    const result = analyze(c);
    for (const s of result.diffusers.top.suggestions) {
      const hint = c.materials.get(s.materialId)?.noteTierHint ?? "mid";
      expect(s.tier).toBe(hint);
    }
  });
});
