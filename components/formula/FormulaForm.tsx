"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Notice } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createFormula, updateFormula } from "@/app/actions/formulas";
import {
  FORMULA_SOURCES,
  FORMULA_TYPES,
  TARGET_CATEGORIES,
} from "@/lib/constants";
import type {
  FormulaSourceEnum,
  FormulaTypeEnum,
} from "@/lib/supabase/database.types";

const NONE = "none";

export type FormulaFormValues = {
  name: string;
  type: FormulaTypeEnum;
  target_category: string;
  source: FormulaSourceEnum;
  source_note: string;
  description: string;
};

export function FormulaForm({
  id,
  initial,
}: {
  id?: string;
  initial?: Partial<FormulaFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormulaFormValues>({
    name: "",
    type: "accord",
    target_category: NONE,
    source: "own",
    source_note: "",
    description: "",
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setField(undefined);

    const payload = {
      name: values.name,
      type: values.type,
      target_category:
        values.target_category === NONE ? null : values.target_category,
      source: values.source,
      source_note: values.source_note || null,
      description: values.description || null,
    };

    startTransition(async () => {
      if (id) {
        const result = await updateFormula(id, payload);
        if (!result.ok) {
          setError(result.error);
          setField(result.field);
          return;
        }
        toast.success("Formula diperbarui.");
        router.push(`/formulas/${id}`);
        return;
      }

      const result = await createFormula(payload);
      if (!result.ok) {
        setError(result.error);
        setField(result.field);
        return;
      }
      // Langsung masuk ke editor versi v1 — tidak ada halaman perantara.
      router.push(`/formulas/${result.data.formulaId}/edit`);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="formula-name" className="mb-1.5">
          Nama <span className="text-[var(--danger)]">*</span>
        </Label>
        <Input
          id="formula-name"
          value={values.name}
          placeholder="Jasmine Accord"
          autoFocus
          aria-invalid={field === "name"}
          onChange={(e) =>
            setValues((v) => ({ ...v, name: e.target.value }))
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5">
            Tipe <span className="text-[var(--danger)]">*</span>
          </Label>
          <Select
            value={values.type}
            onValueChange={(v) =>
              setValues((prev) => ({ ...prev, type: v as FormulaTypeEnum }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMULA_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5">Kategori target</Label>
          <Select
            value={values.target_category}
            onValueChange={(v) =>
              setValues((prev) => ({ ...prev, target_category: v }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>&mdash; belum ditentukan</SelectItem>
              {TARGET_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5">Sumber</Label>
          <Select
            value={values.source}
            onValueChange={(v) =>
              setValues((prev) => ({
                ...prev,
                source: v as FormulaSourceEnum,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMULA_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="source-note" className="mb-1.5">
            Catatan sumber
          </Label>
          <Input
            id="source-note"
            value={values.source_note}
            placeholder="formula accord dari Ecofragrantica, diterima 2026-10-01"
            onChange={(e) =>
              setValues((v) => ({ ...v, source_note: e.target.value }))
            }
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description" className="mb-1.5">
          Apa yang mau dicapai formula ini?
        </Label>
        <Textarea
          id="description"
          rows={3}
          value={values.description}
          placeholder="misal: accord jasmine yang creamy tapi nggak indolic, buat jadi heart di parfum woody"
          onChange={(e) =>
            setValues((v) => ({ ...v, description: e.target.value }))
          }
        />
        <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
          Opsional, tapi isi saja — tanpa tujuan yang tertulis, sulit menilai
          apakah revisi berikutnya membaik atau cuma berubah.
        </p>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      <Button type="button" onClick={submit} disabled={pending}>
        {pending
          ? "Menyimpan…"
          : id
            ? "Simpan perubahan"
            : "Simpan & mulai isi bahan"}
      </Button>
    </div>
  );
}
