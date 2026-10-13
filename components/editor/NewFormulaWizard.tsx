"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createFormula } from "@/app/actions/formulas";
import { Card, Notice } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Pyramid } from "@/lib/calc/types";
import { BATCH_PRESETS, parseDecimal } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { PyramidInput } from "./PyramidInput";

const FAMILIES = [
  "Floral",
  "Woody",
  "Oriental",
  "Fresh",
  "Gourmand",
  "Spicy",
  "Leather",
  "Aquatic",
] as const;

const NONE = "none";

/**
 * Dua langkah: info dasar, lalu piramida.
 *
 * Piramida sengaja ditanyakan SEBELUM bahan apa pun dipilih. Itu urutan
 * berpikir yang sebenarnya — "top-nya 15%, mid 25%, base 60%, lalu isi
 * bahannya" — dan alat yang memaksa memilih bahan dulu membuat strukturnya
 * jadi kebetulan, bukan rencana.
 */
export function NewFormulaWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"fragrance" | "accord">("fragrance");
  const [pyramidMode, setPyramidMode] = useState(true);
  const [batchInput, setBatchInput] = useState("10");
  const [family, setFamily] = useState(NONE);
  const [description, setDescription] = useState("");
  const [pyramid, setPyramid] = useState<Pyramid>({ top: 15, mid: 25, base: 60 });
  const [error, setError] = useState<string | null>(null);

  const batchG = parseDecimal(batchInput) ?? 0;
  const pyramidTotal = pyramid.top + pyramid.mid + pyramid.base;
  const pyramidOk = Math.abs(pyramidTotal - 100) < 0.001;

  /** Accord biasanya satu daftar bahan; fragrance biasanya berpiramida. */
  const pickCategory = (next: "fragrance" | "accord") => {
    setCategory(next);
    setPyramidMode(next === "fragrance");
  };

  const canContinue = name.trim().length > 0 && batchG > 0;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createFormula({
        name,
        category,
        pyramid_mode: pyramidMode,
        batch_g: batchG,
        pyramid: pyramidMode ? pyramid : null,
        target_family: family === NONE ? null : family,
        description: description || null,
      });
      if (!result.ok) {
        setError(result.error);
        setStep(result.field === "pyramid" ? 2 : 1);
        return;
      }
      router.push(`/formulas/${result.data.formulaId}/edit`);
    });
  };

  return (
    <div className="max-w-[640px]">
      <ol className="mb-5 flex gap-2 text-[12px]">
        {([1, 2] as const).map((n) => (
          <li
            key={n}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium",
              step === n
                ? "bg-[var(--cta)] text-white"
                : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
            )}
          >
            {n}. {n === 1 ? "Info dasar" : "Piramida"}
          </li>
        ))}
      </ol>

      <Card>
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="mb-1.5">
                Nama <span className="text-[var(--danger)]">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                autoFocus
                placeholder="Tabac Rouge"
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1.5">Kategori</Label>
              <RadioGroup
                value={category}
                onValueChange={(v) => pickCategory(v as "fragrance" | "accord")}
                className="space-y-2"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="fragrance" id="cat-f" className="mt-0.5" />
                  <Label htmlFor="cat-f" className="block font-normal">
                    <span className="text-[13px] font-medium">Fragrance</span>
                    <span className="mt-0.5 block text-[12px] text-[var(--text-subtle)]">
                      Parfum utuh. Tidak muncul sebagai pilihan bahan di formula
                      lain.
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="accord" id="cat-a" className="mt-0.5" />
                  <Label htmlFor="cat-a" className="block font-normal">
                    <span className="text-[13px] font-medium">Accord</span>
                    <span className="mt-0.5 block text-[12px] text-[var(--text-subtle)]">
                      Modul yang bisa dipakai lagi — jasmine accord, booster,
                      base. Muncul sebagai pilihan bahan, dan isinya ikut
                      dihitung di formula yang memakainya.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="batch" className="mb-1.5">
                  Ukuran batch (g)
                </Label>
                <Input
                  id="batch"
                  inputMode="decimal"
                  className="numeric"
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {BATCH_PRESETS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setBatchInput(String(g))}
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[11px] font-medium",
                        batchG === g
                          ? "border-[var(--cta)] bg-[var(--cta)] text-white"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
                      )}
                    >
                      {g} g
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                  Bisa diubah kapan saja tanpa mengubah persen.
                </p>
              </div>

              <div>
                <Label className="mb-1.5">Target family</Label>
                <Select value={family} onValueChange={setFamily}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>&mdash; belum ditentukan</SelectItem>
                    {FAMILIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-[var(--surface-muted)] p-3">
              <input
                id="pyr-mode"
                type="checkbox"
                checked={pyramidMode}
                onChange={(e) => setPyramidMode(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--cta)]"
              />
              <Label htmlFor="pyr-mode" className="block font-normal">
                <span className="text-[13px] font-medium">Mode piramida</span>
                <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">
                  Bahan dibagi ke tier Top / Mid / Base dengan target persen
                  masing-masing. Matikan kalau formulanya cukup satu daftar.
                </span>
              </Label>
            </div>

            <div>
              <Label htmlFor="desc" className="mb-1.5">
                Deskripsi
              </Label>
              <Textarea
                id="desc"
                rows={2}
                value={description}
                placeholder="apa yang mau dicapai formula ini?"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {error && <Notice tone="danger">{error}</Notice>}

            <div className="flex gap-2 border-t border-[var(--border)] pt-4">
              {pyramidMode ? (
                <Button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => setStep(2)}
                >
                  Lanjut ke piramida
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={!canContinue || pending}
                  onClick={submit}
                >
                  {pending ? "Membuat…" : "Buat & mulai isi bahan"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-[16px] font-semibold">Piramida</h2>
              <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                Tentukan porsi tiap tier dulu. Nanti tiap bahan yang kamu
                tambahkan otomatis dibagi di dalam porsi itu.
              </p>
            </div>

            <PyramidInput
              value={pyramid}
              batchG={batchG}
              onChange={setPyramid}
            />

            {error && <Notice tone="danger">{error}</Notice>}

            <div className="flex gap-2 border-t border-[var(--border)] pt-4">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" />
                Kembali
              </Button>
              <Button
                type="button"
                disabled={!pyramidOk || pending}
                onClick={submit}
                title={pyramidOk ? undefined : "Total piramida harus 100%"}
              >
                {pending ? "Membuat…" : "Buat & mulai isi bahan"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
