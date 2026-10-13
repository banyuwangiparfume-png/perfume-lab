/**
 * Tipe skema database, ditulis tangan supaya cocok dengan
 * supabase/migrations/*.sql.
 *
 * Begitu project Supabase sudah jalan, file ini bisa diganti hasil generate:
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/database.types.ts
 * Sampai saat itu, SETIAP perubahan migrasi harus diikuti perubahan di sini.
 */

export type FunctionCategoryEnum =
  | "diffuser"
  | "modifier"
  | "bridger"
  | "fixative";
export type FormulaTypeEnum =
  | "accord"
  | "base"
  | "booster"
  | "full_perfume"
  | "experiment";
export type FormulaSourceEnum = "own" | "ecofragrantica" | "kurdlab" | "other";
export type VersionStatusEnum = "draft" | "mixed" | "evaluated" | "locked";
export type EvalMediumEnum = "blotter" | "skin" | "fabric";
export type EvalPurposeEnum = "screening" | "final";
export type TransitionVerdictEnum = "smooth" | "broken" | "muddy";
export type UserRoleEnum = "user" | "admin";
export type LineTypeEnum = "raw_material" | "fo" | "sub_formula";

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: UserRoleEnum;
  created_at: string;
};

export type RawMaterialRow = {
  id: string;
  owner_id: string | null;
  name: string;
  synonym: string | null;
  cas_number: string | null;
  family: string | null;
  category: string | null;
  odour_profile: string | null;
  function_category: FunctionCategoryEnum | null;
  odor_impact: number | null;
  odor_impact_override: number | null;
  odor_impact_note: string | null;
  default_dilution_pct: number;
  default_solvent: string | null;
  ifra_cat4_limit_pct: number | null;
  tgsc_url: string | null;
  supplier: string | null;
  personal_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RmPriceRow = {
  id: string;
  raw_material_id: string;
  tier_grams: number;
  price_idr: number;
  supplier: string | null;
  effective_date: string;
  created_at: string;
};

export type FragranceOilRow = {
  id: string;
  owner_id: string;
  name: string;
  inspired_by: string | null;
  supplier: string | null;
  family: string;
  sub_family: string | null;
  note_pyramid: string | null;
  price_per_gram: number | null;
  dep_pct: number;
  personal_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FormulaRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  type: FormulaTypeEnum;
  target_category: string | null;
  source: FormulaSourceEnum;
  source_note: string | null;
  parent_formula_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type FormulaVersionRow = {
  id: string;
  formula_id: string;
  version_no: number;
  label: string | null;
  change_note: string | null;
  parent_version_id: string | null;
  batch_size_g: number;
  status: VersionStatusEnum;
  /** kapan FASE MINYAK dicampur */
  mixed_at: string | null;
  /** kapan ETHANOL ditambahkan — maserasi dihitung dari sini */
  diluted_at: string | null;
  created_at: string;
};

export type FormulaLineRow = {
  id: string;
  formula_version_id: string;
  line_type: LineTypeEnum;
  raw_material_id: string | null;
  fo_id: string | null;
  sub_formula_version_id: string | null;
  weight_g: number;
  dilution_pct: number;
  solvent: string | null;
  note: string | null;
  sort_order: number;
  created_at: string;
};

export type EvaluationRow = {
  id: string;
  formula_version_id: string;
  owner_id: string;
  evaluator_name: string;
  purpose: EvalPurposeEnum;
  medium: EvalMediumEnum;
  diluted_in: string | null;
  /** dihitung dari formula_versions.diluted_at, bukan mixed_at */
  maceration_days: number | null;
  blind_code: string | null;
  evaluated_at: string;
  overall_note: string | null;
  rating: number | null;
  transition_verdict: TransitionVerdictEnum | null;
  created_at: string;
};

export type EvaluationPointRow = {
  id: string;
  evaluation_id: string;
  minutes_elapsed: number;
  dominant_note: string | null;
  descriptors: string[];
  intensity: number | null;
  note: string | null;
};

export type PackagingItemRow = {
  id: string;
  owner_id: string;
  name: string;
  unit_cost_idr: number;
  unit: string;
  is_active: boolean;
  created_at: string;
};

export type CostSheetRow = {
  id: string;
  owner_id: string;
  name: string;
  formula_version_id: string | null;
  bottle_volume_ml: number;
  fill_volume_ml: number;
  density_assumed: number;
  fo_pct: number;
  fo_price_per_g: number;
  booster_pct: number;
  ethanol_pct: number;
  water_pct: number;
  solubilizer_pct: number;
  solvent_cost_idr: number;
  misc_cost_idr: number;
  het_price_idr: number | null;
  net_price_idr: number | null;
  created_at: string;
  updated_at: string;
};

export type CostSheetItemRow = {
  id: string;
  cost_sheet_id: string;
  packaging_item_id: string;
  quantity: number;
};

/** Kolom yang punya default di database boleh dikosongkan saat insert. */
type Insertable<Row, Optional extends keyof Row> = Omit<Row, Optional> &
  Partial<Pick<Row, Optional>>;

type TableDef<Row, Ins, Upd = Partial<Ins>> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<
        ProfileRow,
        Insertable<ProfileRow, "role" | "created_at" | "email" | "display_name">
      >;
      raw_materials: TableDef<
        RawMaterialRow,
        Insertable<
          RawMaterialRow,
          Exclude<keyof RawMaterialRow, "name">
        >
      >;
      rm_prices: TableDef<
        RmPriceRow,
        Insertable<
          RmPriceRow,
          "id" | "supplier" | "effective_date" | "created_at"
        >
      >;
      fragrance_oils: TableDef<
        FragranceOilRow,
        Insertable<
          FragranceOilRow,
          Exclude<keyof FragranceOilRow, "owner_id" | "name" | "family">
        >
      >;
      formulas: TableDef<
        FormulaRow,
        Insertable<
          FormulaRow,
          Exclude<keyof FormulaRow, "owner_id" | "name">
        >
      >;
      formula_versions: TableDef<
        FormulaVersionRow,
        Insertable<
          FormulaVersionRow,
          Exclude<keyof FormulaVersionRow, "formula_id" | "version_no">
        >
      >;
      formula_lines: TableDef<
        FormulaLineRow,
        Insertable<
          FormulaLineRow,
          Exclude<keyof FormulaLineRow, "formula_version_id" | "weight_g">
        >
      >;
      evaluations: TableDef<
        EvaluationRow,
        Insertable<
          EvaluationRow,
          Exclude<
            keyof EvaluationRow,
            "formula_version_id" | "owner_id" | "evaluator_name"
          >
        >
      >;
      evaluation_points: TableDef<
        EvaluationPointRow,
        Insertable<
          EvaluationPointRow,
          Exclude<
            keyof EvaluationPointRow,
            "evaluation_id" | "minutes_elapsed"
          >
        >
      >;
      packaging_items: TableDef<
        PackagingItemRow,
        Insertable<
          PackagingItemRow,
          Exclude<
            keyof PackagingItemRow,
            "owner_id" | "name" | "unit_cost_idr"
          >
        >
      >;
      cost_sheets: TableDef<
        CostSheetRow,
        Insertable<
          CostSheetRow,
          Exclude<
            keyof CostSheetRow,
            | "owner_id"
            | "name"
            | "bottle_volume_ml"
            | "fill_volume_ml"
            | "fo_price_per_g"
          >
        >
      >;
      cost_sheet_items: TableDef<
        CostSheetItemRow,
        Insertable<CostSheetItemRow, "id" | "quantity">
      >;
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: { Args: Record<never, never>; Returns: boolean };
      create_formula_version: {
        Args: {
          p_formula_id: string;
          p_label?: string | null;
          p_change_note?: string | null;
          p_parent_version_id?: string | null;
          p_batch_size_g?: number;
        };
        Returns: FormulaVersionRow;
      };
      duplicate_formula_version: {
        Args: {
          p_version_id: string;
          p_change_note: string;
          p_label?: string | null;
        };
        Returns: FormulaVersionRow;
      };
      save_formula_lines: {
        Args: { p_version_id: string; p_lines: unknown };
        Returns: number;
      };
    };
    Enums: {
      function_category: FunctionCategoryEnum;
      formula_type: FormulaTypeEnum;
      formula_source: FormulaSourceEnum;
      version_status: VersionStatusEnum;
      eval_medium: EvalMediumEnum;
      eval_purpose: EvalPurposeEnum;
      transition_verdict: TransitionVerdictEnum;
      user_role: UserRoleEnum;
      line_type: LineTypeEnum;
    };
    CompositeTypes: Record<never, never>;
  };
};
