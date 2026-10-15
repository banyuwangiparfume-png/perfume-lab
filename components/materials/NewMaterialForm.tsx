"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
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
  createMaterial,
  type CreatedMaterial,
} from "@/app/actions/materials";
import { deriveMaterial, knownFamilies } from "@/lib/calc/deriveMaterial";
import type { FacetKeywordConfig } from "@/lib/calc/facetize";
import { fmtNum } from "@/lib/calc/format";
import { TIER_META, facetColor, facetLabel, parseDecimal } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import facetKeywords from "@/seed/facet-keywords.json";

const CONFIG = facetKeywords as unknown as FacetKeywordConfig;
const FAMILIES = knownFamilies(CONFIG);

/** Kategori yang dipakai pricelist; menentukan juga kelayakan kandidat bridger. */
const CATEGORIES = [
  "Aromachemical",
  "Essential Oil",
  "Natural Isolate",
  "Absolu",
  "Ekstrak",
  "Aldehyde",
  "Accord",
  "Base",
  "Single Notes",
  "Solvent",
];

const FUNCTIONS = ["diffuser", "modifier", "bridger", "fixative"] as const;
const PRICE_SIZES = [5, 10, 50, 100, 500];
const NONE = "__none";

type TierChoice = "auto" | "top" | "mid" | "base";

/**
 * Form bahan baru, dipakai di dua tempat: halaman master bahan, dan langsung
 * dari pencarian di editor saat bahannya belum ada.
 *
 * Yang wajib cuma nama. Sisanya membuat analisa lebih tajam, dan form
 * menunjukkan langsung apa yang terbaca dari isiannya — facet dari odour
 * profile, kebiasaan tier dari family, dilusi bawaan dari nama — supaya
 * kelihatan kenapa sebuah kolom layak diisi, bukan cuma disuruh.
 */
export function NewMaterialForm({
  initialName = "",
  onCreated,
  onCancel,
  submitLabel = "Simpan bahan",
}: {
  initialName?: string;
  onCreated: (created: CreatedMaterial) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initialName);
  const [family, setFamily] = useState<string>(NONE);
  const [category, setCategory] = useState<string>(NONE);
  const [profile, setProfile] = useState("");
  const [impact, setImpact] = useState("");
  const [tier, setTier] = useState<TierChoice>("auto");
  const [fn, setFn] = useState<string>(NONE);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [synonym, setSynonym] = useState("");
  const [cas, setCas] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [more, setMore] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  const impactValue = parseDecimal(impact);
  const derived = useMemo(
    () =>
      deriveMaterial(
        {
          name: name || " ",
          synonym: synonym || null,
          family: family === NONE ? null : family,
          category: category === NONE ? null : category,
          odourProfile: profile || null,
          impact: impactValue,
        },
        CONFIG,
      ),
    [name, synonym, family, category, profile, impactValue],
  );

  const topFacets = Object.entries(derived.facets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const autoTier = derived.noteTierHint;

  const submit = () => {
    setError(null);
    if (!name.trim()) {
      setError({ message: "Nama bahan wajib diisi.", field: "name" });
      return;
    }
    if (impact.trim() && (impactValue == null || impactValue < 0)) {
      setError({ message: "Impact harus angka 0 atau lebih.", field: "odor_impact" });
      return;
    }

    const priceRows: { tier_size: number; price_idr: number }[] = [];
    for (const size of PRICE_SIZES) {
      const raw = prices[size]?.replace(/[.\s]/g, "") ?? "";
      if (!raw) continue;
      const v = Number(raw.replace(",", "."));
      if (!Number.isFinite(v) || v < 0) {
        setError({ message: `Harga ${size} g bukan angka.`, field: "prices" });
        return;
      }
      priceRows.push({ tier_size: size, price_idr: v });
    }

    start(async () => {
      const result = await createMaterial({
        name: name.trim(),
        synonym: synonym || null,
        cas_number: cas || null,
        family: family === NONE ? null : family,
        category: category === NONE ? null : category,
        odour_profile: profile || null,
        function_category:
          fn === NONE ? null : (fn as (typeof FUNCTIONS)[number]),
        odor_impact: impactValue,
        supplier: supplier || null,
        personal_note: note || null,
        note_tier_hint: tier === "auto" ? null : tier,
        prices: priceRows,
      });
      if (result.ok) onCreated(result.data);
      else setError({ message: result.error, field: result.field });
    });
  };

  const fieldError = (f: string) =>
    error?.field === f ? "border-[var(--danger)]" : undefined;

  return (
    <div className="space-y-3.5">
      <div>
        <Label htmlFor="nm-name" className="mb-1.5 text-[13px]">
          Nama <span className="text-[var(--danger)]">*</span>
        </Label>
        <Input
          id="nm-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="misal: Nagarmotha Oil"
          className={fieldError("name")}
          autoFocus={!initialName}
        />
        {derived.supplierDilutionPct < 100 && (
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Terbaca encer dari pabrik: {fmtNum(derived.supplierDilutionPct)}%
            {derived.solventToken ? ` dalam ${derived.solventToken}` : ""}.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 text-[13px]">Family</Label>
          <Select value={family} onValueChange={setFamily}>
            <SelectTrigger className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {FAMILIES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 text-[13px]">Kategori</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="nm-profile" className="mb-1.5 text-[13px]">
          Odour profile
        </Label>
        <Textarea
          id="nm-profile"
          rows={2}
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          placeholder="woody, earthy, smoky, leathery — yang paling dominan duluan"
        />
        {/* Facet dihitung dari kolom ini. Menunjukkannya langsung membuat
            jelas kenapa urutan kata berpengaruh: yang disebut duluan dibobot
            paling berat. */}
        <p className="mt-1 min-h-[16px] text-[11px] leading-relaxed text-[var(--text-subtle)]">
          {topFacets.length ? (
            <>
              terbaca:{" "}
              {topFacets.map(([key], i) => (
                <span key={key}>
                  {i > 0 && " · "}
                  <span
                    className="font-medium"
                    style={{
                      color: `color-mix(in oklab, ${facetColor(key)} 78%, var(--text))`,
                    }}
                  >
                    {facetLabel(key)}
                  </span>
                </span>
              ))}
            </>
          ) : (
            "Tanpa facet, bahan ini tidak ikut pie aroma maupun saran bridger."
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="nm-impact" className="mb-1.5 text-[13px]">
            Impact
          </Label>
          <Input
            id="nm-impact"
            inputMode="decimal"
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="kosong = belum tahu"
            className={fieldError("odor_impact")}
          />
          <p className="mt-1 text-[11px] text-[var(--text-subtle)]">
            Kosong dihitung 100 dan ditandai, bukan disembunyikan.
          </p>
        </div>
        <div>
          <Label className="mb-1.5 text-[13px]">Fungsi</Label>
          <Select value={fn} onValueChange={setFn}>
            <SelectTrigger className="w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— ditebak dari family</SelectItem>
              {FUNCTIONS.map((f) => (
                <SelectItem key={f} value={f} className="capitalize">
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 text-[13px]">Kebiasaan tier</Label>
        <div className="flex flex-wrap gap-1.5">
          {(["auto", "top", "mid", "base"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[12px] font-medium",
                tier === t
                  ? "border-[var(--cta)] bg-[var(--cta)] text-white"
                  : "border-[var(--border-strong)] text-[var(--text-muted)]",
              )}
            >
              {t === "auto"
                ? `Otomatis${autoTier ? ` · ${TIER_META[autoTier].label}` : ""}`
                : TIER_META[t].label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-subtle)]">
          Dipakai untuk saran penempatan dan kekuatan per fase.
          {tier === "auto" && !autoTier && " Pilih family supaya bisa ditebak."}
        </p>
      </div>

      <div>
        <Label className="mb-1.5 text-[13px]">Harga (Rp per kemasan)</Label>
        <div className="grid grid-cols-5 gap-1.5">
          {PRICE_SIZES.map((size) => (
            <div key={size}>
              <Input
                inputMode="numeric"
                value={prices[size] ?? ""}
                onChange={(e) =>
                  setPrices((p) => ({ ...p, [size]: e.target.value }))
                }
                className={cn("h-8 px-2 text-[12px]", fieldError("prices"))}
                aria-label={`Harga ${size} g`}
              />
              <p className="mt-0.5 text-center text-[10px] text-[var(--text-subtle)]">
                {size} g
              </p>
            </div>
          ))}
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--text-subtle)]">
          Boleh diisi sebagian. Tanpa harga, HPP baris ini tampil kosong.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        className="flex items-center gap-1 text-[12px] font-medium text-[var(--text-muted)]"
      >
        <ChevronDown
          className={cn("size-3.5 transition-transform", more && "rotate-180")}
        />
        Detail lain
      </button>
      {more && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nm-syn" className="mb-1.5 text-[13px]">
              Sinonim
            </Label>
            <Input id="nm-syn" value={synonym} onChange={(e) => setSynonym(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="nm-cas" className="mb-1.5 text-[13px]">
              CAS
            </Label>
            <Input id="nm-cas" value={cas} onChange={(e) => setCas(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="nm-sup" className="mb-1.5 text-[13px]">
              Supplier
            </Label>
            <Input id="nm-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="nm-note" className="mb-1.5 text-[13px]">
              Catatan pribadi
            </Label>
            <Input id="nm-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[13px]">
          {error.message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Batal
          </Button>
        )}
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Menyimpan…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
