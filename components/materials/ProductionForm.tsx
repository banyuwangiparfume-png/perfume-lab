"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Factory } from "lucide-react";
import { toast } from "sonner";
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
import { recordProduction, type Plan } from "@/app/actions/stock";
import { fmtGram } from "@/lib/calc/format";
import { BATCH_PRESETS, parseDecimal } from "@/lib/tiers";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string; batchG: number };

export function ProductionForm({
  options,
  selectedId,
  batchG,
  plan,
  error,
}: {
  options: Option[];
  selectedId: string | null;
  batchG: number;
  plan: Plan | null;
  error: string | null;
}) {
  const router = useRouter();
  const [batchText, setBatchText] = useState(String(batchG));
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const go = (versionId: string | null, batch: number) => {
    const params = new URLSearchParams();
    if (versionId) params.set("v", versionId);
    params.set("batch", String(batch));
    router.push(`/stock/produksi?${params}`);
  };

  const shortages = plan?.rows.filter((r) => r.shortG > 0) ?? [];

  const submit = () => {
    if (!selectedId) return;
    start(async () => {
      const result = await recordProduction({
        versionId: selectedId,
        batchG,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success(
          `Tercatat — ${result.data.consumed} bahan dikurangi, hasilnya masuk stok sebagai FO.`,
        );
        setNote("");
        router.push("/stock");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="min-w-[260px] flex-1">
          <Label className="mb-1.5 text-[13px]">Versi yang diracik</Label>
          <Select
            value={selectedId ?? ""}
            onValueChange={(id) => go(id, batchG)}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Pilih versi…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="batch" className="mb-1.5 text-[13px]">
            Mau buat berapa (g)
          </Label>
          <Input
            id="batch"
            inputMode="decimal"
            className="w-28"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            onBlur={() => {
              const parsed = parseDecimal(batchText);
              if (parsed != null && parsed > 0 && parsed !== batchG) {
                go(selectedId, parsed);
              }
            }}
          />
        </div>

        <div className="flex gap-1.5">
          {BATCH_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={batchG === preset ? "default" : "outline"}
              onClick={() => {
                setBatchText(String(preset));
                go(selectedId, preset);
              }}
            >
              {preset} g
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--danger-soft)] px-3.5 py-3 text-[13px]">
          {error}
        </p>
      )}

      {!selectedId && (
        <p className="text-[13px] text-[var(--text-muted)]">
          Pilih versinya dulu, nanti kebutuhan tiap bahannya dijabarkan di sini
          beserta sisa stok yang kamu punya.
        </p>
      )}

      {plan && (
        <>
          {/* Ringkasan kekurangan ditaruh DI ATAS tabel: kalau ada yang kurang,
              itu hal pertama yang perlu diketahui — bukan sesuatu yang harus
              ditemukan sendiri dengan menyisir kolom. */}
          {shortages.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg bg-[var(--warn-soft)] px-3.5 py-3 text-[13px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {shortages.length} bahan tidak cukup untuk batch {fmtGram(batchG)}{" "}
                  g.
                </p>
                <p className="mt-0.5 leading-relaxed">
                  {shortages
                    .map((r) => `${r.name} kurang ${fmtGram(r.shortG)} g`)
                    .join(" · ")}
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--ok-soft)] px-3.5 py-3 text-[13px]">
              Semua bahan cukup untuk batch {fmtGram(batchG)} g.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  <th className="px-3 py-2.5 text-left font-medium">Bahan</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Dibutuhkan (g)
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Stok saya (g)
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">Kurang (g)</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-3 py-2">
                      {r.name}
                      {r.kind === "fo" && (
                        <span className="ml-1.5 rounded bg-[#f0ece2] px-1 py-0.5 text-[10px] font-semibold text-[#8a6d2f]">
                          FO
                        </span>
                      )}
                    </td>
                    <td className="numeric px-3 py-2 text-right font-medium">
                      {fmtGram(r.needG)}
                    </td>
                    <td className="numeric px-3 py-2 text-right text-[var(--text-muted)]">
                      {/* Belum pernah dicatat berbeda dari pernah ada lalu
                          habis. Yang pertama cuma berarti catatannya belum
                          dibuat. */}
                      {r.onHandG == null ? (
                        <span
                          className="text-[var(--text-subtle)]"
                          title="Belum pernah dicatat pembeliannya"
                        >
                          belum dicatat
                        </span>
                      ) : (
                        fmtGram(r.onHandG)
                      )}
                    </td>
                    <td
                      className={cn(
                        "numeric px-3 py-2 text-right",
                        r.shortG > 0
                          ? "font-semibold text-[var(--danger)]"
                          : "text-[var(--text-subtle)]",
                      )}
                    >
                      {r.shortG > 0 ? fmtGram(r.shortG) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div>
              <Label htmlFor="note" className="mb-1.5 text-[13px]">
                Catatan produksi
              </Label>
              <Textarea
                id="note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="batch ke berapa, buat siapa"
              />
            </div>

            <p className="text-[12px] leading-relaxed text-[var(--text-subtle)]">
              Hasilnya masuk kembali ke stok sebagai FO bernama{" "}
              <strong className="font-medium">{plan.label}</strong>. Kekurangan
              tidak menghalangi pencatatan — sisanya akan jadi minus, dan itu
              justru menandai catatan pembelian mana yang perlu disusulkan.
            </p>

            <Button type="button" onClick={submit} disabled={pending}>
              <Factory className="size-4" />
              {pending
                ? "Mencatat…"
                : `Catat produksi ${fmtGram(batchG)} g`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
