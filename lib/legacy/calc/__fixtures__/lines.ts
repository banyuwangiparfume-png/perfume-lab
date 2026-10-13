import type { CalcLine, FunctionCategory } from "../types";

let seq = 0;

/** Pembuat baris raw material untuk test. Default: neat, tanpa harga. */
export function rm(
  label: string,
  weightG: number,
  impact: number | null,
  opts: {
    dilutionPct?: number;
    functionCategory?: FunctionCategory | null;
    family?: string | null;
    pricePerGram?: number | null;
    id?: string;
  } = {},
): CalcLine {
  return {
    id: opts.id ?? `rm-${++seq}`,
    lineType: "raw_material",
    label,
    weightG,
    dilutionPct: opts.dilutionPct ?? 100,
    impact,
    functionCategory: opts.functionCategory ?? "modifier",
    family: opts.family ?? "Woody",
    pricePerGram: opts.pricePerGram ?? null,
  };
}

export function fo(
  label: string,
  weightG: number,
  opts: { family?: string | null; pricePerGram?: number | null; id?: string } = {},
): CalcLine {
  return {
    id: opts.id ?? `fo-${++seq}`,
    lineType: "fo",
    label,
    weightG,
    dilutionPct: 100,
    foFamily: opts.family ?? "Tobacco",
    pricePerGram: opts.pricePerGram ?? null,
  };
}

export function sub(
  label: string,
  weightG: number,
  subLines: CalcLine[],
  opts: { dilutionPct?: number; id?: string } = {},
): CalcLine {
  return {
    id: opts.id ?? `sub-${++seq}`,
    lineType: "sub_formula",
    label,
    weightG,
    dilutionPct: opts.dilutionPct ?? 100,
    subLines,
  };
}
