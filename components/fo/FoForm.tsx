"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImpactBadge } from "@/components/shared/ImpactBadge";
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
import {
  createFragranceOil,
  updateFragranceOil,
} from "@/app/actions/fragrance-oils";
import { FO_FAMILIES } from "@/lib/constants";

export type FoFormValues = {
  name: string;
  inspired_by: string;
  supplier: string;
  family: string;
  sub_family: string;
  note_pyramid: string;
  price_per_gram: string;
  dep_pct: string;
  personal_note: string;
};

const EMPTY: FoFormValues = {
  name: "",
  inspired_by: "",
  supplier: "",
  family: "",
  sub_family: "",
  note_pyramid: "",
  price_per_gram: "",
  dep_pct: "0",
  personal_note: "",
};

const num = (s: string): number | null => {
  const v = s.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Form FO.
 *
 * Yang sengaja TIDAK ADA di sini: kolom odor impact dan kategori fungsi.
 * FO tidak punya nilai itu, dan mengisinya dengan tebakan akan merusak seluruh
 * analisa formula. Teks penjelasnya ada di bawah form — bukan disembunyikan,
 * karena pertanyaan "kok nggak ada kolom impact?" pasti muncul.
 */
export function FoForm({
  id,
  initial,
  onDone,
}: {
  id?: string;
  initial?: Partial<FoFormValues>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FoFormValues>({
    ...EMPTY,
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const set = (key: keyof FoFormValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const submit = () => {
    setError(null);
    setField(undefined);

    const payload = {
      name: values.name,
      inspired_by: values.inspired_by || null,
      supplier: values.supplier || null,
      family: values.family,
      sub_family: values.sub_family || null,
      note_pyramid: values.note_pyramid || null,
      price_per_gram: num(values.price_per_gram),
      dep_pct: num(values.dep_pct) ?? 0,
      personal_note: values.personal_note || null,
    };

    startTransition(async () => {
      const result = id
        ? await updateFragranceOil(id, payload)
        : await createFragranceOil(payload);

      if (!result.ok) {
        setError(result.error);
        setField(result.field);
        return;
      }
      toast.success(id ? "FO diperbarui." : "FO tersimpan.");
      onDone?.();
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="fo-name" className="mb-1.5">
            Nama <span className="text-[var(--danger)]">*</span>
          </Label>
          <Input
            id="fo-name"
            value={values.name}
            placeholder="Tabbac 28"
            onChange={(e) => set("name")(e.target.value)}
            aria-invalid={field === "name"}
          />
        </div>

        <div>
          <Label htmlFor="fo-inspired" className="mb-1.5">
            Inspired by
          </Label>
          <Input
            id="fo-inspired"
            value={values.inspired_by}
            placeholder="Maison Alhambra Tabac"
            onChange={(e) => set("inspired_by")(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="fo-supplier" className="mb-1.5">
            Supplier
          </Label>
          <Input
            id="fo-supplier"
            value={values.supplier}
            onChange={(e) => set("supplier")(e.target.value)}
          />
        </div>

        <div>
          <Label className="mb-1.5">
            Family <span className="text-[var(--danger)]">*</span>
          </Label>
          <Select value={values.family} onValueChange={set("family")}>
            <SelectTrigger
              className="w-full"
              aria-invalid={field === "family"}
            >
              <SelectValue placeholder="Pilih family" />
            </SelectTrigger>
            <SelectContent>
              {FO_FAMILIES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
            Wajib — dipakai untuk memeriksa jarak antar FO kalau satu formula
            memakai lebih dari satu bibit.
          </p>
        </div>

        <div>
          <Label htmlFor="fo-subfamily" className="mb-1.5">
            Sub-family
          </Label>
          <Input
            id="fo-subfamily"
            value={values.sub_family}
            onChange={(e) => set("sub_family")(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="fo-price" className="mb-1.5">
            Harga per gram (Rp)
          </Label>
          <Input
            id="fo-price"
            inputMode="decimal"
            className="numeric"
            value={values.price_per_gram}
            onChange={(e) => set("price_per_gram")(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="fo-dep" className="mb-1.5">
            DEP %
          </Label>
          <Input
            id="fo-dep"
            inputMode="decimal"
            className="numeric"
            value={values.dep_pct}
            onChange={(e) => set("dep_pct")(e.target.value)}
          />
          <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
            Fixative yang sudah ditambahkan ke bibit oleh supplier.
          </p>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="fo-pyramid" className="mb-1.5">
            Catatan piramida notes
          </Label>
          <Textarea
            id="fo-pyramid"
            rows={3}
            value={values.note_pyramid}
            placeholder="Top: bergamot, spice — Heart: tobacco, honey — Base: vanilla, tonka"
            onChange={(e) => set("note_pyramid")(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="fo-note" className="mb-1.5">
            Catatan pribadi
          </Label>
          <Textarea
            id="fo-note"
            rows={2}
            value={values.personal_note}
            onChange={(e) => set("personal_note")(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-[var(--surface-muted)] p-3">
        <ImpactBadge value={null} isFo />
        <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
          FO berisi puluhan bahan yang komposisinya tidak kita ketahui, jadi dia
          tidak bisa diberi satu nilai kekuatan. Di analisa formula, bagian FO
          dihitung beratnya tapi tidak ikut dinilai kekuatannya — dan app akan
          menyebutkan berapa persen formula yang sebenarnya ikut dinilai.
        </p>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Menyimpan…" : id ? "Simpan perubahan" : "Simpan FO"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Batal
          </Button>
        )}
      </div>
    </div>
  );
}
