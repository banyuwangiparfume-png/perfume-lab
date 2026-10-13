/**
 * Tipe skema database.
 *
 * Isinya diturunkan dari `generated.types.ts`, yang DIHASILKAN dari database
 * asli — bukan ditulis tangan. Perbarui dengan:
 *
 *   npx supabase gen types typescript --linked > lib/supabase/generated.types.ts
 *
 * Jalankan itu setiap kali ada migrasi baru. File ini sendiri jarang berubah:
 * dia cuma memberi nama pendek untuk baris dan enum yang dipakai di seluruh
 * aplikasi, supaya pemanggilnya tidak perlu menulis
 * `Database["public"]["Tables"]["raw_materials"]["Row"]` di mana-mana.
 */

import type { Database as Generated } from "./generated.types";

export type Database = Generated;

type Tables = Generated["public"]["Tables"];
type Enums = Generated["public"]["Enums"];

type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];

// ------------------------------------------------------------------ enum --
export type FunctionCategoryEnum = Enums["function_category"];
export type FormulaCategoryEnum = Enums["formula_category"];
export type FormulaTypeEnum = Enums["formula_type"];
export type FormulaSourceEnum = Enums["formula_source"];
export type VersionStatusEnum = Enums["version_status"];
export type EvalMediumEnum = Enums["eval_medium"];
export type EvalPurposeEnum = Enums["eval_purpose"];
export type TransitionVerdictEnum = Enums["transition_verdict"];
export type UserRoleEnum = Enums["user_role"];
export type LineTypeEnum = Enums["line_type"];
export type TierKeyEnum = Enums["tier_key"];
export type RuleSourceEnum = Enums["rule_source"];
export type ImpactBasisEnum = Enums["impact_basis"];
export type ImportStatusEnum = Enums["import_status"];

// ------------------------------------------------------------------ baris --
export type ProfileRow = Row<"profiles">;
export type RawMaterialRow = Row<"raw_materials">;
export type RmPriceRow = Row<"rm_prices">;
export type FragranceOilRow = Row<"fragrance_oils">;
export type FormulaRow = Row<"formulas">;
export type FormulaVersionRow = Row<"formula_versions">;
export type FormulaLineRow = Row<"formula_lines">;
export type EvaluationRow = Row<"evaluations">;
export type EvaluationPointRow = Row<"evaluation_points">;
export type PackagingItemRow = Row<"packaging_items">;
export type CostSheetRow = Row<"cost_sheets">;
export type CostSheetItemRow = Row<"cost_sheet_items">;

// --- tabel v2 ---
export type FacetRow = Row<"facets">;
export type RawMaterialFacetRow = Row<"raw_material_facets">;
export type BridgeRuleRow = Row<"bridge_rules">;
export type UserStockRow = Row<"user_stock">;
export type ImportBatchRow = Row<"import_batches">;
export type AppSettingsRow = Row<"app_settings">;

export type RmCurrentPriceRow =
  Generated["public"]["Views"]["rm_current_prices"]["Row"];
