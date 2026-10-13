"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setMaterialRoleOverride } from "@/app/actions/materials";
import { FUNCTION_HINTS, FUNCTION_LABELS } from "@/lib/calc/functions";
import { TIER_META } from "@/lib/tiers";
import { cn } from "@/lib/utils";

const CATEGORIES = ["diffuser", "modifier", "bridger", "fixative"] as const;
const TIERS = ["top", "mid", "base"] as const;

type Category = (typeof CATEGORIES)[number];
type TierKey = (typeof TIERS)[number];

/**
 * Koreksi peran bahan: kategori fungsi dan tier kebiasaannya.
 *
 * Keduanya datang dari pricelist supplier dan sering tidak cocok untuk yang
 * memakainya — Ecofragrantica menaruh Linalool di family Citrus, sehingga tier
 * hint-nya jadi "top". Tanpa kolom ini, satu-satunya cara memperbaikinya adalah
 * mengubah data supplier, yang akan tertimpa saat import berikutnya.
 *
 * "Ikut supplier" sengaja jadi pilihan tersendiri, bukan sekadar tidak memilih:
 * mengembalikan ke data supplier adalah keputusan, dan harus bisa dilakukan.
 */
export function RoleOverrideForm({
  materialId,
  supplierCategory,
  categoryOverride,
  supplierTier,
  tierOverride,
  note,
}: {
  materialId: string;
  supplierCategory: string | null;
  categoryOverride: string | null;
  supplierTier: string | null;
  tierOverride: string | null;
  note: string | null;
}) {
  const [category, setCategory] = useState<Category | null>(
    (categoryOverride as Category | null) ?? null,
  );
  const [tier, setTier] = useState<TierKey | null>(
    (tierOverride as TierKey | null) ?? null,
  );
  const [reason, setReason] = useState(note ?? "");
  const [pending, start] = useTransition();

  const dirty =
    category !== ((categoryOverride as Category | null) ?? null) ||
    tier !== ((tierOverride as TierKey | null) ?? null) ||
    reason.trim() !== (note ?? "").trim();

  const save = () =>
    start(async () => {
      const result = await setMaterialRoleOverride(materialId, {
        functionCategory: category,
        noteTierHint: tier,
        note: reason,
      });
      if (result.ok) toast.success("Koreksi tersimpan.");
      else toast.error(result.error);
    });

  const supplierLabel = (value: string | null, map: Record<string, string>) =>
    value ? (map[value] ?? value) : "tidak diisi supplier";

  return (
    <div className="space-y-4">
      <fieldset>
        <Label className="mb-1.5 text-[13px]">Kategori fungsi</Label>
        <p className="mb-2 text-[12px] text-[var(--text-subtle)]">
          Supplier: {supplierLabel(supplierCategory, FUNCTION_LABELS)}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <Chip active={category === null} onClick={() => setCategory(null)}>
            Ikut supplier
          </Chip>
          {CATEGORIES.map((key) => (
            <Chip
              key={key}
              active={category === key}
              onClick={() => setCategory(key)}
              title={FUNCTION_HINTS[key]}
            >
              {FUNCTION_LABELS[key]}
            </Chip>
          ))}
        </div>

        {category && (
          <p className="mt-1.5 text-[12px] text-[var(--text-subtle)]">
            {FUNCTION_HINTS[category]}
          </p>
        )}
      </fieldset>

      <fieldset>
        <Label className="mb-1.5 text-[13px]">Tier kebiasaannya</Label>
        <p className="mb-2 text-[12px] text-[var(--text-subtle)]">
          Supplier:{" "}
          {supplierTier
            ? (TIER_META[supplierTier as TierKey]?.label ?? supplierTier)
            : "tidak diisi supplier"}{" "}
          — dipakai untuk menentukan tier tujuan saat bridger ditambahkan.
        </p>

        <div className="flex flex-wrap gap-1.5">
          <Chip active={tier === null} onClick={() => setTier(null)}>
            Ikut supplier
          </Chip>
          {TIERS.map((key) => (
            <Chip
              key={key}
              active={tier === key}
              onClick={() => setTier(key)}
            >
              {TIER_META[key].label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="role-note" className="mb-1.5 text-[13px]">
          Alasan
        </Label>
        <Textarea
          id="role-note"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="misal: dipakai sebagai heart note, bukan top — meski supplier menaruhnya di Citrus"
        />
      </div>

      <Button type="button" onClick={save} disabled={pending || !dirty}>
        {pending ? "Menyimpan…" : "Simpan koreksi"}
      </Button>
    </div>
  );
}

function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-[13px] transition-colors",
        active
          ? "border-[var(--brand)] bg-[var(--brand-soft)] font-medium text-[var(--brand)]"
          : "border-[var(--border)] hover:bg-[var(--surface-muted)]",
      )}
    >
      {children}
    </button>
  );
}
