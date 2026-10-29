"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Upload } from "lucide-react";
import { parseFormulaFile } from "@/app/actions/formulaImport";
import { tierSumsFromRaw } from "@/lib/import/formulaImport";
import { PENDING_IMPORT_PREFIX } from "@/lib/import/pending";
import type { RawRow } from "./ImportFormulaDialog";
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
  // Mulai dari berkas: dibaca di sini supaya piramida dan nama bisa diisi
  // dari resepnya sebelum formula dibuat; barisnya diimpor di editor.
  const [file, setFile] = useState<{ name: string; rows: RawRow[]; note: string } | null>(null);
  const [reading, startReading] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const readFile = (f: File) => {
    setError(null);
    const form = new FormData();
    form.set("file", f);
    startReading(async () => {
      const res = await parseFormulaFile(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const sums = tierSumsFromRaw(res.data);
      let note: string;
      if (sums.hasTiers && sums.total > 0) {
        // Piramida mengikuti resep. Kalau totalnya bukan 100 (bahan yang
        // belum ada di master sudah ikut dihitung di sini), proporsinya
        // dipertahankan dan dinormalkan ke 100 — angka yang ditampilkan di
        // langkah 2 masih bisa diubah.
        const r1 = (n: number) => Math.round((n / sums.total) * 1000) / 10;
        const top = r1(sums.top);
        const mid = r1(sums.mid);
        const base = Math.round((100 - top - mid) * 10) / 10;
        setPyramidMode(true);
        setPyramid({ top, mid, base });
        note =
          Math.abs(sums.total - 100) < 0.01
            ? `Piramida diambil dari berkas: ${top}/${mid}/${base}.`
            : `Total berkas ${Math.round(sums.total * 10) / 10}% — piramida dinormalkan ke 100: ${top}/${mid}/${base}.`;
      } else {
        setPyramidMode(false);
        note = "Berkas tanpa kolom tier — formula dibuat tanpa piramida.";
      }
      if (!name.trim()) {
        setName(
          f.name
            .replace(/\.xlsx$/i, "")
            .replace(/^formula[-_ ]*/i, "")
            .replace(/[-_]+/g, " ")
            .trim(),
        );
      }
      setFile({ name: f.name, rows: res.data, note: `${res.data.length} baris terbaca. ${note}` });
    });
  };

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
      if (file) {
        // Editor membaca ini sekali saat dibuka, lalu membuka dialog import
        // dengan isi berkas — bahan yang belum ada di master bisa ditambahkan
        // di sana.
        try {
          sessionStorage.setItem(
            `${PENDING_IMPORT_PREFIX}${result.data.formulaId}`,
            JSON.stringify({ rows: file.rows, fileName: file.name }),
          );
        } catch {}
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
            {/* Opsional: mulai dari template yang sudah diisi (biasanya AI). */}
            <div className="rounded-lg border border-dashed border-[var(--border-strong)] p-3">
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) readFile(f);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reading}
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="size-4" />
                  {reading ? "Membaca…" : file ? "Ganti berkas" : "Mulai dari file .xlsx"}
                </Button>
                {file ? (
                  <>
                    <span className="truncate text-[12px] font-medium">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-[12px] text-[var(--text-muted)] underline"
                    >
                      batal
                    </button>
                  </>
                ) : (
                  <span className="text-[12px] text-[var(--text-subtle)]">
                    Opsional — template formula yang sudah diisi. Piramidanya ikut
                    berkas.
                  </span>
                )}
              </div>
              {file && (
                <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">{file.note}</p>
              )}
            </div>

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
