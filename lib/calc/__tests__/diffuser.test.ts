import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { fixtureContext } from "./fixture";

const ctx = fixtureContext();

const isDiffuser = (v: string | null) =>
  (v ?? "").toLowerCase() === "diffuser";

/**
 * Menyeragamkan asal kategori SELURUH bahan diffuser.
 *
 * Fixture sudah memuat bahan berkategori "Diffuser" dari data aslinya, jadi
 * menyentuh sebagian saja membuat test-nya buta terhadap sisanya.
 */
function withDiffusers(source: "supplier" | "derived") {
  const c = fixtureContext();
  let converted = 0;
  for (const m of c.materials.values()) {
    if (isDiffuser(m.functionCategory)) {
      m.functionSource = source;
      continue;
    }
    if (converted >= 6) continue;
    if (m.isSolvent) continue;
    if (c.version.lines.some((l) => l.refId === m.id)) continue;
    m.functionCategory = "diffuser";
    m.functionSource = source;
    converted++;
  }
  return c;
}

describe("saran diffuser", () => {
  it("tidak menyarankan bahan yang sudah ada di formula", () => {
    const result = analyze(withDiffusers("supplier"));
    const used = new Set(ctx.version.lines.map((l) => l.refId));
    for (const s of result.diffusers.suggestions) {
      expect(used.has(s.materialId)).toBe(false);
    }
  });

  it("hanya menyarankan bahan berkategori diffuser", () => {
    const c = withDiffusers("supplier");
    const result = analyze(c);
    expect(result.diffusers.suggestions.length).toBeGreaterThan(0);
    for (const s of result.diffusers.suggestions) {
      expect(isDiffuser(c.materials.get(s.materialId)?.functionCategory ?? null)).toBe(true);
    }
  });

  it("TIDAK menyarankan kategori hasil tebakan", () => {
    // Menyarankan dosis berdasarkan tebakan sendiri menumpuk ketidakpastian
    // di atas ketidakpastian.
    const result = analyze(withDiffusers("derived"));
    expect(result.diffusers.suggestions).toHaveLength(0);
  });

  it("diurut dari yang paling searah dengan formula", () => {
    const scores = analyze(withDiffusers("supplier")).diffusers.suggestions.map(
      (s) => s.score,
    );
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("porsi diffuser tetap dilaporkan walau sarannya dimatikan", () => {
    const c = withDiffusers("supplier");
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
