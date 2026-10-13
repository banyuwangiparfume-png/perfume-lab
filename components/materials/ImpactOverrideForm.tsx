"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Notice } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setImpactOverride } from "@/app/actions/materials";
import { fmtNum } from "@/lib/calc/format";

/**
 * Koreksi nilai impact dari hasil penciuman sendiri.
 *
 * Alasan koreksinya wajib. Angka tanpa alasan tidak bisa dinilai ulang nanti,
 * dan kolom inilah yang perlahan membuat database ini jadi milik sendiri —
 * bukan jiplakan supplier.
 */
export function ImpactOverrideForm({
  materialId,
  supplierValue,
  override,
  note,
}: {
  materialId: string;
  supplierValue: number | null;
  override: number | null;
  note: string | null;
}) {
  const [value, setValue] = useState(override != null ? String(override) : "");
  const [reason, setReason] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = value.trim().replace(",", ".");
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Nilai impact harus angka 0 atau lebih.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await setImpactOverride(materialId, parsed, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        parsed == null ? "Koreksi dihapus." : "Koreksi impact tersimpan.",
      );
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[120px]">
          <Label htmlFor="override" className="mb-1.5">
            Nilai kamu
          </Label>
          <Input
            id="override"
            inputMode="decimal"
            className="numeric"
            value={value}
            placeholder={supplierValue != null ? fmtNum(supplierValue) : "—"}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <p className="pb-2 text-[13px] text-[var(--text-muted)]">
          Nilai supplier{" "}
          <strong className="text-[var(--text)]">
            {supplierValue != null ? fmtNum(supplierValue) : "belum ada"}
          </strong>
          . Kosongkan kolom ini untuk kembali memakai nilai supplier.
        </p>
      </div>

      <div>
        <Label htmlFor="override-note" className="mb-1.5">
          Alasan koreksi
        </Label>
        <Textarea
          id="override-note"
          rows={2}
          value={reason}
          placeholder='misal: "terasa jauh lebih kuat dari angka supplier, tes blotter 2026-10-04"'
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      <Button type="button" onClick={submit} disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan koreksi"}
      </Button>
    </div>
  );
}
