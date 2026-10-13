"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtGram } from "@/lib/calc/format";
import { round } from "@/lib/legacy/calc/scale";

export type ScaleRow = { key: string; label: string; weightG: number };

/**
 * "Skalakan ke __ gram". Hasilnya ditampilkan DULU sebelum diterapkan —
 * menskalakan formula adalah operasi yang mengubah semua baris sekaligus,
 * dan user harus bisa melihat angkanya sebelum menyetujui.
 */
export function ScaleDialog({
  rows,
  onApply,
  disabled,
}: {
  rows: ScaleRow[];
  onApply: (factor: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = rows.reduce((a, r) => a + r.weightG, 0);
  const [target, setTarget] = useState("");

  const targetG = Number(target.replace(",", "."));
  const valid = Number.isFinite(targetG) && targetG > 0 && current > 0;
  const factor = valid ? targetG / current : 1;

  const preview = rows.map((r) => ({
    ...r,
    scaled: round(r.weightG * factor, 3),
  }));
  const previewTotal = preview.reduce((a, r) => a + r.scaled, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTarget(current ? String(round(current, 3)) : "");
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !rows.length}
        >
          <Scale className="size-3.5" />
          Skalakan
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Skalakan formula</DialogTitle>
          <DialogDescription>
            Total sekarang {fmtGram(current)} g. Semua berat timbang dikalikan
            proporsional, dilusinya tidak disentuh.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="scale-target">Total target (gram)</Label>
          <Input
            id="scale-target"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="numeric"
            autoFocus
          />
        </div>

        <div className="max-h-[240px] overflow-y-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Komponen</th>
                <th className="px-3 py-1.5 text-right font-medium">Sekarang</th>
                <th className="px-3 py-1.5 text-right font-medium">Jadi</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.key} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5">{r.label}</td>
                  <td className="numeric px-3 py-1.5 text-[var(--text-muted)]">
                    {fmtGram(r.weightG)}
                  </td>
                  <td className="numeric px-3 py-1.5 font-medium">
                    {fmtGram(r.scaled)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[var(--surface-muted)] font-semibold">
              <tr className="border-t border-[var(--border)]">
                <td className="px-3 py-1.5">Total</td>
                <td className="numeric px-3 py-1.5">{fmtGram(current)}</td>
                <td className="numeric px-3 py-1.5">
                  {fmtGram(previewTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {valid && Math.abs(previewTotal - targetG) > 0.0005 && (
          <p className="text-[12px] text-[var(--text-subtle)]">
            Total hasil {fmtGram(previewTotal)} g, bukan persis{" "}
            {fmtGram(targetG)} g — tiap berat dibulatkan ke 3 desimal supaya
            angkanya benar-benar bisa ditimbang.
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Batal
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={!valid}
            onClick={() => {
              onApply(factor);
              setOpen(false);
            }}
          >
            Terapkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
