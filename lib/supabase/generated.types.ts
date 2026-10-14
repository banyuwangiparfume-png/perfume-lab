export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          owner_id: string
          settings: Json
        }
        Insert: {
          owner_id: string
          settings?: Json
        }
        Update: {
          owner_id?: string
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_rules: {
        Row: {
          created_at: string
          facet_a: string
          facet_b: string
          id: string
          note: string | null
          owner_id: string | null
          raw_material_id: string
          source: Database["public"]["Enums"]["rule_source"]
        }
        Insert: {
          created_at?: string
          facet_a: string
          facet_b: string
          id?: string
          note?: string | null
          owner_id?: string | null
          raw_material_id: string
          source?: Database["public"]["Enums"]["rule_source"]
        }
        Update: {
          created_at?: string
          facet_a?: string
          facet_b?: string
          id?: string
          note?: string | null
          owner_id?: string | null
          raw_material_id?: string
          source?: Database["public"]["Enums"]["rule_source"]
        }
        Relationships: [
          {
            foreignKeyName: "bridge_rules_facet_a_fkey"
            columns: ["facet_a"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "bridge_rules_facet_b_fkey"
            columns: ["facet_b"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "bridge_rules_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bridge_rules_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_sheet_items: {
        Row: {
          cost_sheet_id: string
          id: string
          packaging_item_id: string
          quantity: number
        }
        Insert: {
          cost_sheet_id: string
          id?: string
          packaging_item_id: string
          quantity?: number
        }
        Update: {
          cost_sheet_id?: string
          id?: string
          packaging_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_sheet_items_cost_sheet_id_fkey"
            columns: ["cost_sheet_id"]
            isOneToOne: false
            referencedRelation: "cost_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_sheet_items_packaging_item_id_fkey"
            columns: ["packaging_item_id"]
            isOneToOne: false
            referencedRelation: "packaging_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_sheets: {
        Row: {
          booster_pct: number
          bottle_volume_ml: number
          concentrate_price_per_g_snapshot: number | null
          concentrate_source: string
          created_at: string
          density_assumed: number
          ethanol_pct: number
          fill_volume_ml: number
          fo_pct: number
          fo_price_per_g: number | null
          formula_version_id: string | null
          het_price_idr: number | null
          id: string
          misc_cost_idr: number
          name: string
          net_price_idr: number | null
          owner_id: string
          solubilizer_pct: number
          solvent_cost_idr: number
          updated_at: string
          water_pct: number
        }
        Insert: {
          booster_pct?: number
          bottle_volume_ml: number
          concentrate_price_per_g_snapshot?: number | null
          concentrate_source?: string
          created_at?: string
          density_assumed?: number
          ethanol_pct?: number
          fill_volume_ml: number
          fo_pct?: number
          fo_price_per_g?: number | null
          formula_version_id?: string | null
          het_price_idr?: number | null
          id?: string
          misc_cost_idr?: number
          name: string
          net_price_idr?: number | null
          owner_id: string
          solubilizer_pct?: number
          solvent_cost_idr?: number
          updated_at?: string
          water_pct?: number
        }
        Update: {
          booster_pct?: number
          bottle_volume_ml?: number
          concentrate_price_per_g_snapshot?: number | null
          concentrate_source?: string
          created_at?: string
          density_assumed?: number
          ethanol_pct?: number
          fill_volume_ml?: number
          fo_pct?: number
          fo_price_per_g?: number | null
          formula_version_id?: string | null
          het_price_idr?: number | null
          id?: string
          misc_cost_idr?: number
          name?: string
          net_price_idr?: number | null
          owner_id?: string
          solubilizer_pct?: number
          solvent_cost_idr?: number
          updated_at?: string
          water_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "cost_sheets_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_sheets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_points: {
        Row: {
          descriptors: string[]
          dominant_note: string | null
          evaluation_id: string
          id: string
          intensity: number | null
          minutes_elapsed: number
          note: string | null
        }
        Insert: {
          descriptors?: string[]
          dominant_note?: string | null
          evaluation_id: string
          id?: string
          intensity?: number | null
          minutes_elapsed: number
          note?: string | null
        }
        Update: {
          descriptors?: string[]
          dominant_note?: string | null
          evaluation_id?: string
          id?: string
          intensity?: number | null
          minutes_elapsed?: number
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_points_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          blind_code: string | null
          created_at: string
          diluted_in: string | null
          evaluated_at: string
          evaluator_name: string
          formula_version_id: string
          id: string
          maceration_days: number | null
          medium: Database["public"]["Enums"]["eval_medium"]
          overall_note: string | null
          owner_id: string
          purpose: Database["public"]["Enums"]["eval_purpose"]
          rating: number | null
          transition_verdict:
            | Database["public"]["Enums"]["transition_verdict"]
            | null
        }
        Insert: {
          blind_code?: string | null
          created_at?: string
          diluted_in?: string | null
          evaluated_at?: string
          evaluator_name: string
          formula_version_id: string
          id?: string
          maceration_days?: number | null
          medium?: Database["public"]["Enums"]["eval_medium"]
          overall_note?: string | null
          owner_id: string
          purpose?: Database["public"]["Enums"]["eval_purpose"]
          rating?: number | null
          transition_verdict?:
            | Database["public"]["Enums"]["transition_verdict"]
            | null
        }
        Update: {
          blind_code?: string | null
          created_at?: string
          diluted_in?: string | null
          evaluated_at?: string
          evaluator_name?: string
          formula_version_id?: string
          id?: string
          maceration_days?: number | null
          medium?: Database["public"]["Enums"]["eval_medium"]
          overall_note?: string | null
          owner_id?: string
          purpose?: Database["public"]["Enums"]["eval_purpose"]
          rating?: number | null
          transition_verdict?:
            | Database["public"]["Enums"]["transition_verdict"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facets: {
        Row: {
          color: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          color: string
          key: string
          label: string
          sort_order: number
        }
        Update: {
          color?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      formula_lines: {
        Row: {
          accord_version_id: string | null
          created_at: string
          fo_id: string | null
          formula_version_id: string
          id: string
          is_locked: boolean
          line_type: Database["public"]["Enums"]["line_type"]
          note: string | null
          pct: number
          raw_material_id: string | null
          solvent: string | null
          sort_order: number
          tier: Database["public"]["Enums"]["tier_key"]
          user_dilution_pct: number
          user_solvent_id: string | null
          weight_g: number | null
        }
        Insert: {
          accord_version_id?: string | null
          created_at?: string
          fo_id?: string | null
          formula_version_id: string
          id?: string
          is_locked?: boolean
          line_type?: Database["public"]["Enums"]["line_type"]
          note?: string | null
          pct: number
          raw_material_id?: string | null
          solvent?: string | null
          sort_order?: number
          tier?: Database["public"]["Enums"]["tier_key"]
          user_dilution_pct?: number
          user_solvent_id?: string | null
          weight_g?: number | null
        }
        Update: {
          accord_version_id?: string | null
          created_at?: string
          fo_id?: string | null
          formula_version_id?: string
          id?: string
          is_locked?: boolean
          line_type?: Database["public"]["Enums"]["line_type"]
          note?: string | null
          pct?: number
          raw_material_id?: string | null
          solvent?: string | null
          sort_order?: number
          tier?: Database["public"]["Enums"]["tier_key"]
          user_dilution_pct?: number
          user_solvent_id?: string | null
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formula_lines_fo_id_fkey"
            columns: ["fo_id"]
            isOneToOne: false
            referencedRelation: "fragrance_oils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_lines_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_lines_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_lines_sub_formula_version_id_fkey"
            columns: ["accord_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_lines_user_solvent_id_fkey"
            columns: ["user_solvent_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_versions: {
        Row: {
          base_pct: number | null
          batch_g: number
          change_note: string | null
          created_at: string
          diluted_at: string | null
          formula_id: string
          id: string
          label: string | null
          mid_pct: number | null
          mixed_at: string | null
          parent_version_id: string | null
          price_tier_override: number | null
          status: Database["public"]["Enums"]["version_status"]
          top_pct: number | null
          updated_at: string
          version_no: number
        }
        Insert: {
          base_pct?: number | null
          batch_g?: number
          change_note?: string | null
          created_at?: string
          diluted_at?: string | null
          formula_id: string
          id?: string
          label?: string | null
          mid_pct?: number | null
          mixed_at?: string | null
          parent_version_id?: string | null
          price_tier_override?: number | null
          status?: Database["public"]["Enums"]["version_status"]
          top_pct?: number | null
          updated_at?: string
          version_no: number
        }
        Update: {
          base_pct?: number | null
          batch_g?: number
          change_note?: string | null
          created_at?: string
          diluted_at?: string | null
          formula_id?: string
          id?: string
          label?: string | null
          mid_pct?: number | null
          mixed_at?: string | null
          parent_version_id?: string | null
          price_tier_override?: number | null
          status?: Database["public"]["Enums"]["version_status"]
          top_pct?: number | null
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "formula_versions_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      formulas: {
        Row: {
          category: Database["public"]["Enums"]["formula_category"]
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          owner_id: string
          parent_formula_id: string | null
          pyramid_mode: boolean
          source: Database["public"]["Enums"]["formula_source"]
          source_note: string | null
          target_category: string | null
          target_family: string | null
          type: Database["public"]["Enums"]["formula_type"]
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["formula_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          owner_id: string
          parent_formula_id?: string | null
          pyramid_mode?: boolean
          source?: Database["public"]["Enums"]["formula_source"]
          source_note?: string | null
          target_category?: string | null
          target_family?: string | null
          type?: Database["public"]["Enums"]["formula_type"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["formula_category"]
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          owner_id?: string
          parent_formula_id?: string | null
          pyramid_mode?: boolean
          source?: Database["public"]["Enums"]["formula_source"]
          source_note?: string | null
          target_category?: string | null
          target_family?: string | null
          type?: Database["public"]["Enums"]["formula_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formulas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulas_parent_formula_id_fkey"
            columns: ["parent_formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      fragrance_oils: {
        Row: {
          created_at: string
          dep_pct: number
          family: string
          id: string
          inspired_by: string | null
          is_active: boolean
          name: string
          note_pyramid: string | null
          owner_id: string
          personal_note: string | null
          price_per_gram: number | null
          sub_family: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dep_pct?: number
          family: string
          id?: string
          inspired_by?: string | null
          is_active?: boolean
          name: string
          note_pyramid?: string | null
          owner_id: string
          personal_note?: string | null
          price_per_gram?: number | null
          sub_family?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dep_pct?: number
          family?: string
          id?: string
          inspired_by?: string | null
          is_active?: boolean
          name?: string
          note_pyramid?: string | null
          owner_id?: string
          personal_note?: string | null
          price_per_gram?: number | null
          sub_family?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fragrance_oils_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          applied_at: string | null
          created_at: string
          file_name: string
          id: string
          owner_id: string
          pricelist_date: string
          status: Database["public"]["Enums"]["import_status"]
          summary: Json
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          file_name: string
          id?: string
          owner_id: string
          pricelist_date: string
          status?: Database["public"]["Enums"]["import_status"]
          summary?: Json
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          file_name?: string
          id?: string
          owner_id?: string
          pricelist_date?: string
          status?: Database["public"]["Enums"]["import_status"]
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_items: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          owner_id: string
          unit: string
          unit_cost_idr: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          unit?: string
          unit_cost_idr: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          unit?: string
          unit_cost_idr?: number
        }
        Relationships: [
          {
            foreignKeyName: "packaging_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      raw_material_facets: {
        Row: {
          facet_key: string
          raw_material_id: string
          weight: number
        }
        Insert: {
          facet_key: string
          raw_material_id: string
          weight: number
        }
        Update: {
          facet_key?: string
          raw_material_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_facets_facet_key_fkey"
            columns: ["facet_key"]
            isOneToOne: false
            referencedRelation: "facets"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "raw_material_facets_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          cas_number: string | null
          category: string | null
          created_at: string
          default_dilution_pct: number
          default_solvent: string | null
          facets_manual: boolean
          family: string | null
          fr_fl: string | null
          function_category:
            | Database["public"]["Enums"]["function_category"]
            | null
          function_category_note: string | null
          function_category_override:
            | Database["public"]["Enums"]["function_category"]
            | null
          id: string
          ifra_cat4_limit_pct: number | null
          impact_basis: Database["public"]["Enums"]["impact_basis"]
          is_active: boolean
          is_bridge_candidate: boolean
          is_solvent: boolean
          last_seen_import_id: string | null
          name: string
          name_normalized: string
          note_tier_hint: Database["public"]["Enums"]["tier_key"] | null
          note_tier_hint_override:
            | Database["public"]["Enums"]["tier_key"]
            | null
          odor_impact: number | null
          odor_impact_note: string | null
          odor_impact_override: number | null
          odour_profile: string | null
          owner_id: string | null
          personal_note: string | null
          supplier: string | null
          supplier_dilution_pct: number
          supplier_solvent_id: string | null
          synonym: string | null
          tgsc_url: string | null
          updated_at: string
        }
        Insert: {
          cas_number?: string | null
          category?: string | null
          created_at?: string
          default_dilution_pct?: number
          default_solvent?: string | null
          facets_manual?: boolean
          family?: string | null
          fr_fl?: string | null
          function_category?:
            | Database["public"]["Enums"]["function_category"]
            | null
          function_category_note?: string | null
          function_category_override?:
            | Database["public"]["Enums"]["function_category"]
            | null
          id?: string
          ifra_cat4_limit_pct?: number | null
          impact_basis?: Database["public"]["Enums"]["impact_basis"]
          is_active?: boolean
          is_bridge_candidate?: boolean
          is_solvent?: boolean
          last_seen_import_id?: string | null
          name: string
          name_normalized?: string
          note_tier_hint?: Database["public"]["Enums"]["tier_key"] | null
          note_tier_hint_override?:
            | Database["public"]["Enums"]["tier_key"]
            | null
          odor_impact?: number | null
          odor_impact_note?: string | null
          odor_impact_override?: number | null
          odour_profile?: string | null
          owner_id?: string | null
          personal_note?: string | null
          supplier?: string | null
          supplier_dilution_pct?: number
          supplier_solvent_id?: string | null
          synonym?: string | null
          tgsc_url?: string | null
          updated_at?: string
        }
        Update: {
          cas_number?: string | null
          category?: string | null
          created_at?: string
          default_dilution_pct?: number
          default_solvent?: string | null
          facets_manual?: boolean
          family?: string | null
          fr_fl?: string | null
          function_category?:
            | Database["public"]["Enums"]["function_category"]
            | null
          function_category_note?: string | null
          function_category_override?:
            | Database["public"]["Enums"]["function_category"]
            | null
          id?: string
          ifra_cat4_limit_pct?: number | null
          impact_basis?: Database["public"]["Enums"]["impact_basis"]
          is_active?: boolean
          is_bridge_candidate?: boolean
          is_solvent?: boolean
          last_seen_import_id?: string | null
          name?: string
          name_normalized?: string
          note_tier_hint?: Database["public"]["Enums"]["tier_key"] | null
          note_tier_hint_override?:
            | Database["public"]["Enums"]["tier_key"]
            | null
          odor_impact?: number | null
          odor_impact_note?: string | null
          odor_impact_override?: number | null
          odour_profile?: string | null
          owner_id?: string | null
          personal_note?: string | null
          supplier?: string | null
          supplier_dilution_pct?: number
          supplier_solvent_id?: string | null
          synonym?: string | null
          tgsc_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_last_import_fk"
            columns: ["last_seen_import_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_supplier_solvent_id_fkey"
            columns: ["supplier_solvent_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      rm_prices: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          import_batch_id: string | null
          price_idr: number
          raw_material_id: string
          supplier: string | null
          tier_size: number
        }
        Insert: {
          created_at?: string
          effective_date?: string
          id?: string
          import_batch_id?: string | null
          price_idr: number
          raw_material_id: string
          supplier?: string | null
          tier_size: number
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          import_batch_id?: string | null
          price_idr?: number
          raw_material_id?: string
          supplier?: string | null
          tier_size?: number
        }
        Relationships: [
          {
            foreignKeyName: "rm_prices_import_fk"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_prices_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          formula_version_id: string | null
          fragrance_oil_id: string | null
          happened_at: string
          id: string
          kind: Database["public"]["Enums"]["movement_kind"]
          note: string | null
          owner_id: string
          qty_g: number
          raw_material_id: string | null
          unit_price_idr: number | null
        }
        Insert: {
          created_at?: string
          formula_version_id?: string | null
          fragrance_oil_id?: string | null
          happened_at?: string
          id?: string
          kind: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          owner_id: string
          qty_g: number
          raw_material_id?: string | null
          unit_price_idr?: number | null
        }
        Update: {
          created_at?: string
          formula_version_id?: string | null
          fragrance_oil_id?: string | null
          happened_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["movement_kind"]
          note?: string | null
          owner_id?: string
          qty_g?: number
          raw_material_id?: string | null
          unit_price_idr?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_fragrance_oil_id_fkey"
            columns: ["fragrance_oil_id"]
            isOneToOne: false
            referencedRelation: "fragrance_oils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stock: {
        Row: {
          created_at: string
          fragrance_oil_id: string | null
          id: string
          owner_id: string
          raw_material_id: string | null
        }
        Insert: {
          created_at?: string
          fragrance_oil_id?: string | null
          id?: string
          owner_id: string
          raw_material_id?: string | null
        }
        Update: {
          created_at?: string
          fragrance_oil_id?: string | null
          id?: string
          owner_id?: string
          raw_material_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stock_fragrance_oil_id_fkey"
            columns: ["fragrance_oil_id"]
            isOneToOne: false
            referencedRelation: "fragrance_oils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stock_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stock_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      rm_current_prices: {
        Row: {
          effective_date: string | null
          price_idr: number | null
          price_per_unit: number | null
          raw_material_id: string | null
          tier_size: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rm_prices_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_on_hand: {
        Row: {
          fragrance_oil_id: string | null
          last_moved_at: string | null
          owner_id: string | null
          qty_g: number | null
          raw_material_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_fragrance_oil_id_fkey"
            columns: ["fragrance_oil_id"]
            isOneToOne: false
            referencedRelation: "fragrance_oils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      normalize_material_name: { Args: { s: string }; Returns: string }
      save_draft_lines: {
        Args: { p_lines: Json; p_version_id: string }
        Returns: number
      }
      save_formula_version: {
        Args: { p_change_note?: string; p_formula_id: string; p_label?: string }
        Returns: {
          base_pct: number | null
          batch_g: number
          change_note: string | null
          created_at: string
          diluted_at: string | null
          formula_id: string
          id: string
          label: string | null
          mid_pct: number | null
          mixed_at: string | null
          parent_version_id: string | null
          price_tier_override: number | null
          status: Database["public"]["Enums"]["version_status"]
          top_pct: number | null
          updated_at: string
          version_no: number
        }
        SetofOptions: {
          from: "*"
          to: "formula_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      eval_medium: "blotter" | "skin" | "fabric"
      eval_purpose: "screening" | "final"
      formula_category: "fragrance" | "accord"
      formula_source: "own" | "ecofragrantica" | "kurdlab" | "other"
      formula_type:
        | "accord"
        | "base"
        | "booster"
        | "full_perfume"
        | "experiment"
      function_category: "diffuser" | "modifier" | "bridger" | "fixative"
      impact_basis: "as_sold" | "active"
      import_status: "previewed" | "applied" | "discarded"
      line_type: "raw_material" | "fo" | "accord"
      movement_kind: "pembelian" | "produksi" | "penyesuaian"
      rule_source: "temen" | "klasik" | "saya"
      tier_key: "top" | "mid" | "base" | "all"
      transition_verdict: "smooth" | "broken" | "muddy"
      user_role: "user" | "admin"
      version_status: "draft" | "saved" | "mixed" | "evaluated" | "locked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      eval_medium: ["blotter", "skin", "fabric"],
      eval_purpose: ["screening", "final"],
      formula_category: ["fragrance", "accord"],
      formula_source: ["own", "ecofragrantica", "kurdlab", "other"],
      formula_type: ["accord", "base", "booster", "full_perfume", "experiment"],
      function_category: ["diffuser", "modifier", "bridger", "fixative"],
      impact_basis: ["as_sold", "active"],
      import_status: ["previewed", "applied", "discarded"],
      line_type: ["raw_material", "fo", "accord"],
      movement_kind: ["pembelian", "produksi", "penyesuaian"],
      rule_source: ["temen", "klasik", "saya"],
      tier_key: ["top", "mid", "base", "all"],
      transition_verdict: ["smooth", "broken", "muddy"],
      user_role: ["user", "admin"],
      version_status: ["draft", "saved", "mixed", "evaluated", "locked"],
    },
  },
} as const
