import { describe, expect, it } from "vitest";
import {
  assertNoCycle,
  checkCandidate,
  depthOf,
  SubFormulaError,
  type SubFormulaGraph,
} from "./cycle";

function graph(
  nodes: Record<string, { label: string; subs?: string[] }>,
): SubFormulaGraph {
  return new Map(
    Object.entries(nodes).map(([versionId, n]) => [
      versionId,
      { versionId, label: n.label, subVersionIds: n.subs ?? [] },
    ]),
  );
}

describe("deteksi siklus", () => {
  it("menolak formula yang memakai dirinya sendiri", () => {
    const g = graph({ a: { label: "Accord A v1" } });
    expect(checkCandidate(g, "a", "a")?.kind).toBe("cycle");
  });

  it("menolak siklus tak langsung A memakai B, B memakai A", () => {
    const g = graph({
      a: { label: "Parfum v1", subs: ["b"] },
      b: { label: "Jasmine Accord v3", subs: [] },
    });
    // Sedang mengedit Jasmine Accord v3, mau memakai Parfum v1 —
    // padahal Parfum v1 sudah memakai Jasmine Accord v3.
    const problem = checkCandidate(g, "b", "a");
    expect(problem?.kind).toBe("cycle");
    expect(problem).toMatchObject({
      pathLabels: ["Parfum v1", "Jasmine Accord v3"],
    });
  });

  it("melempar error dengan NAMA formula, bukan UUID", () => {
    const g = graph({
      "11111111-1111-1111-1111-111111111111": {
        label: "Parfum v1",
        subs: ["22222222-2222-2222-2222-222222222222"],
      },
      "22222222-2222-2222-2222-222222222222": { label: "Jasmine Accord v3" },
    });
    try {
      assertNoCycle(g, "22222222-2222-2222-2222-222222222222", [
        "11111111-1111-1111-1111-111111111111",
      ]);
      throw new Error("seharusnya melempar");
    } catch (e) {
      expect(e).toBeInstanceOf(SubFormulaError);
      const msg = (e as SubFormulaError).message;
      expect(msg).toContain("Parfum v1");
      expect(msg).toContain("Jasmine Accord v3");
      expect(msg).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
    }
  });

  it("tidak hang pada siklus yang sudah ada di data", () => {
    const g = graph({
      a: { label: "A", subs: ["b"] },
      b: { label: "B", subs: ["a"] },
    });
    expect(depthOf(g, "a")).toBeGreaterThan(0);
    expect(checkCandidate(g, "c", "a")).not.toBeNull();
  });

  it("kandidat yang bersih diterima", () => {
    const g = graph({
      root: { label: "Parfum v1" },
      accord: { label: "Jasmine Accord v3" },
    });
    expect(checkCandidate(g, "root", "accord")).toBeNull();
    expect(() => assertNoCycle(g, "root", ["accord"])).not.toThrow();
  });
});

describe("batas kedalaman", () => {
  const g = graph({
    root: { label: "Parfum v1" },
    l1: { label: "Booster v5", subs: ["l2"] },
    l2: { label: "Accord v2", subs: ["l3"] },
    l3: { label: "Base v1" },
  });

  it("kedalaman 1 sampai 3 tingkat diterima", () => {
    expect(depthOf(g, "l3")).toBe(1);
    expect(depthOf(g, "l2")).toBe(2);
    expect(checkCandidate(g, "root", "l2")).toBeNull(); // root + 2 = 3 tingkat
  });

  it("kedalaman 4 tingkat ditolak di tingkat ke-4", () => {
    expect(depthOf(g, "l1")).toBe(3);
    const problem = checkCandidate(g, "root", "l1"); // root + 3 = 4 tingkat
    expect(problem?.kind).toBe("depth");
    expect(problem).toMatchObject({ depth: 4, maxDepth: 3 });
  });
});
