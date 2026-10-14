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
    for (const s of result.diffusers.suggestions) {
      expect(used.has(s.materialId)).toBe(false);
    }
  });

  it("hanya menyarankan bahan berkategori diffuser", () => {
    const c = withRole("diffuser", "supplier");
    const result = analyze(c);
    expect(result.diffusers.suggestions.length).toBeGreaterThan(0);
    for (const s of result.diffusers.suggestions) {
      expect(
        isRole(c.materials.get(s.materialId)?.functionCategory ?? null, "diffuser"),
      ).toBe(true);
    }
  });

  it("TIDAK menyarankan kategori hasil tebakan", () => {
    // Menyarankan dosis berdasarkan tebakan sendiri menumpuk ketidakpastian
    // di atas ketidakpastian.
    const result = analyze(withRole("diffuser", "derived"));
    expect(result.diffusers.suggestions).toHaveLength(0);
  });

  it("diurut dari yang paling searah dengan formula", () => {
    const scores = analyze(withRole("diffuser", "supplier")).diffusers.suggestions.map(
      (s) => s.score,
    );
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("porsi diffuser tetap dilaporkan walau sarannya dimatikan", () => {
    const c = withRole("diffuser", "supplier");
    const full = analyze(c);
    const quick = analyze(c, { skipBridges: true });
    expect(quick.diffusers.sharePct).toBeCloseTo(full.diffusers.sharePct, 8);
    expect(quick.diffusers.suggestions).toHaveLength(0);
  });

  it("formula tanpa diffuser melaporkan porsi nol, bukan error", () => {
    const result = analyze(ctx);
    expect(result.diffusers.sharePct).toBe(0);
    expect(result.diffusers.present).toEqual([]);
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
    const diff = new Set(result.diffusers.suggestions.map((s) => s.materialId));
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
