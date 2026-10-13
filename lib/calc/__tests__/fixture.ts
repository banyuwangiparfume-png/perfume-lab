import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS } from "../../settings";
import type {
  BridgeRule,
  FormulaContext,
  Line,
  Material,
  Tier,
  Version,
} from "../types";

/**
 * Membangun FormulaContext dari dua file nyata di seed/:
 *   calc-fixture-01.json — formula contoh beserta SEMUA angka yang diharapkan
 *   bridge-db.json       — 413 bahan Ecofragrantica beserta facet dan impact
 *
 * Fixture ini yang menentukan benar-salahnya seluruh lapisan kalkulasi. Kalau
 * satu angkanya meleset, yang salah hampir pasti kodenya — bukan fixture-nya,
 * karena angka di situ sudah dihitung terpisah dari implementasi ini.
 */

const seedDir = path.join(process.cwd(), "seed");

export const bridgeDb = JSON.parse(
  fs.readFileSync(path.join(seedDir, "bridge-db.json"), "utf8"),
) as {
  facets: Record<string, string>;
  materials: {
    id: number;
    name: string;
    syn: string | null;
    family: string | null;
    cas: string | null;
    kat: string | null;
    fungsi: string | null;
    impact: number | null;
    rp_g: number | null;
    odour: string | null;
    facets: Record<string, number>;
    manual: boolean;
    candidate: boolean;
  }[];
  rules: { mid: number; a: string; b: string; note: string; src: string }[];
};

export const fixture = JSON.parse(
  fs.readFileSync(path.join(seedDir, "calc-fixture-01.json"), "utf8"),
) as {
  input: {
    batchG: number;
    pyramid: { top: number; mid: number; base: number };
    priceTier: number;
    lines: {
      tier: Tier;
      material: string;
      pct: number;
      locked: boolean;
      userDilutionPct: number;
      userSolvent?: string;
      supplierDilutionPct: number;
      supplierSolvent?: string;
      impact: number;
      price10: number;
    }[];
  };
  expected: Record<string, never> & {
    allocation: { topAfterAddDHM: number[]; topAfterEditBergamot10: number[] };
    productPct: Record<string, number>;
    solvents: Record<
      string,
      {
        direct: number;
        fromDilution: number;
        hiddenFromSupplier: number;
        explicitTotal: number;
        effectiveTotal: number;
      }
    >;
    realPyramidActive: Record<string, number>;
    strengthPct: Record<string, number>;
    aromaTop6Pct: Record<string, number>;
    warnings: string[];
    cost: { total: number; perGram: number; rows: Record<string, number> };
    scaling: Record<string, { tier: number; total?: number }>;
    bridges: {
      crossTier: Record<
        string,
        { sim: number; status: string; top5?: string[] }
      >;
    };
  };
  tolerance: { rupiahAndComposition: number; strengthAndAroma: number };
};

const byName = new Map(bridgeDb.materials.map((m) => [m.name, m]));
const byId = new Map(bridgeDb.materials.map((m) => [m.id, m]));

/**
 * Bahan yang diperlakukan sebagai pelarut.
 *
 * Aturan import (file 03 §6.6): kategori Solvent, ditambah tiga bahan yang
 * kategorinya bukan Solvent tapi fungsinya memang melarutkan.
 */
const SOLVENT_NAMES = new Set([
  "Benzyl Benzoate",
  "Benzyl Salicylate",
  "Isopropyl Myristate / IPM",
]);

export function isSolventMaterial(name: string, category: string | null) {
  return (
    SOLVENT_NAMES.has(name) ||
    (category ?? "").toLowerCase() === "solvent" ||
    /triethyl citrate|dipropylene glycol|\bDPG\b|\bTEC\b/i.test(name)
  );
}

/** Semua 413 bahan bridge-db, supaya bridge engine punya kandidat nyata. */
export function allMaterials(): Map<string, Material> {
  const out = new Map<string, Material>();
  for (const m of bridgeDb.materials) {
    out.set(m.name, {
      id: m.name,
      name: m.name,
      category: m.kat,
      impact: m.impact,
      impactBasis: "as_sold",
      supplierDilutionPct: 100,
      supplierSolventId: null,
      facets: m.facets ?? {},
      functionCategory: m.fungsi,
      functionSource: "supplier",
      noteTierHint: null,
      isBridgeCandidate: m.candidate,
      isSolvent: isSolventMaterial(m.name, m.kat),
      prices: m.rp_g ? { 10: m.rp_g * 10 } : {},
    });
  }
  return out;
}

export function bridgeRules(): BridgeRule[] {
  return bridgeDb.rules.map((r, i) => ({
    id: `rule-${i}`,
    materialId: byId.get(r.mid)?.name ?? "",
    facetA: r.a,
    facetB: r.b,
    note: r.note,
    source: r.src as BridgeRule["source"],
  }));
}

/** Konteks fixture: harga dan dilusi supplier diambil dari fixture, bukan db. */
export function fixtureContext(batchG = fixture.input.batchG): FormulaContext {
  const materials = allMaterials();

  for (const l of fixture.input.lines) {
    const base = materials.get(l.material);
    if (!base) throw new Error(`Bahan fixture tidak ada di bridge-db: ${l.material}`);
    materials.set(l.material, {
      ...base,
      impact: l.impact,
      supplierDilutionPct: l.supplierDilutionPct,
      supplierSolventId: l.supplierSolvent ?? null,
      prices: { 10: l.price10 },
    });
  }

  const lines: Line[] = fixture.input.lines.map((l, i) => ({
    id: `line-${i}`,
    tier: l.tier,
    kind: "raw_material",
    refId: l.material,
    pct: l.pct,
    locked: l.locked,
    userDilutionPct: l.userDilutionPct,
    userSolventId: l.userSolvent ?? null,
    sortOrder: i,
  }));

  const version: Version = {
    id: "fixture-version",
    name: "Fixture 01",
    batchG,
    pyramid: fixture.input.pyramid,
    priceTierOverride: null,
    lines,
  };

  return {
    version,
    materials,
    accords: new Map(),
    fos: new Map(),
    bridgeRules: bridgeRules(),
    stock: new Set(),
    settings: DEFAULT_SETTINGS,
  };
}

export const materialNamed = (name: string) => byName.get(name);
