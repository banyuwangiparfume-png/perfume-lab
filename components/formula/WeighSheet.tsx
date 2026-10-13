"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtGram, fmtNum, fmtPct } from "@/lib/calc/format";
import type { LineTable } from "@/lib/calc/lines";
import type { Tier } from "@/lib/calc/types";
import { BATCH_PRESETS, parseDecimal, TIER_META } from "@/lib/tiers";
import { cn } from "@/lib/utils";

/**
 * Batas praktis timbangan 0,01 g. Di bawah ini, satu klik tombol tare saja
 * sudah menggeser hasilnya belasan persen.
 */
const MIN_WEIGHABLE_G = 0.05;

/** Base dulu, Top terakhir — urutan menimbang yang umum di meja kerja. */
const WEIGH_ORDER: Tier[] = ["base", "mid", "top"];

type Props = {
  table: LineTable;
  initialBatchG: number;
  /** false = formula tanpa piramida; semua baris jadi satu kelompok */
  grouped: boolean;
};

export function WeighSheet({ table, initialBatchG, grouped }: Props) {
  const [batchG, setBatchG] = useState(initialBatchG);
  const [batchText, setBatchText] = useState(String(initialBatchG));
  const [done, setDone] = useState<Set<string>>(new Set());

  const applyBatch = (value: number) => {
    setBatchG(value);
    setBatchText(String(value));
    // URL ikut berubah supaya lembar ini bisa dibagikan dan dicetak ulang
    // dengan ukuran batch yang sama, tanpa memuat ulang halaman.
    const url = new URL(window.location.href);
    url.searchParams.set("batch", String(value));
    window.history.replaceState(null, "", url.toString());
  };

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Baris diurut ulang untuk menimbang, lalu kumulatifnya dihitung MENGIKUTI
  // urutan itu — bukan urutan di editor. Kumulatif yang tidak sesuai urutan
  // kerja tidak ada gunanya untuk mengecek timbangan berjalan.
  const rows = useMemo(() => {
    const ordered = grouped
      ? WEIGH_ORDER.flatMap((tier) =>
          table.rows.filter((r) => r.tier === tier),
        )
      : table.rows;

    const out: { row: (typeof ordered)[number]; gram: number; cumulative: number }[] =
      [];
    let running = 0;
    for (const row of ordered) {
      const gram = (row.pct / 100) * batchG;
      running += gram;
      out.push({ row, gram, cumulative: running });
    }
    return out;
  }, [table.rows, batchG, grouped]);

  const tooSmall = rows.filter((r) => r.gram > 0 && r.gram < MIN_WEIGHABLE_G);
  const totalG = rows.reduce((a, r) => a + r.gram, 0);

  return (
    <div className="space-y-4">
      {/* ------------------------------- kendali ------------------------- */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 print:hidden">
        <div>
          <Label htmlFor="batch" className="mb-1.5 text-[13px]">
            Ukuran batch (g)
          </Label>
          <Input
            id="batch"
            inputMode="decimal"
            className="w-28"
            value={batchText}
            onChange={(e) => {
              setBatchText(e.target.value);
              const parsed = parseDecimal(e.target.value);
              if (parsed != null && parsed > 0) applyBatch(parsed);
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
              onClick={() => applyBatch(preset)}
            >
              {preset} g
            </Button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          Cetak
        </Button>
      </div>

      {/* Peringatan ini lebih penting dari tabelnya sendiri: menimbang 0,03 g
          di timbangan 0,01 g menghasilkan formula yang tidak bisa diulang. */}
      {tooSmall.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-[var(--warn-soft)] px-3.5 py-3 text-[13px]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {tooSmall.length} bahan beratnya di bawah {fmtNum(MIN_WEIGHABLE_G)} g
            ({tooSmall.map((r) => r.row.name).join(", ")}). Di timbangan 0,01 g
            ketelitiannya tidak cukup — buat dilusinya dulu, atau naikkan ukuran
            batch.
          </span>
        </p>
      )}

      {/* -------------------------------- tabel -------------------------- */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] print:rounded-none print:border-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)] print:bg-transparent">
              <th className="w-10 px-3 py-2.5 print:w-8">
                <span className="sr-only">Sudah ditimbang</span>
              </th>
              <th className="px-3 py-2.5 text-left font-medium">Bahan</th>
              <th className="px-3 py-2.5 text-left font-medium">Bentuk</th>
              <th className="px-3 py-2.5 text-right font-medium">Timbang (g)</th>
              <th className="px-3 py-2.5 text-right font-medium">Kumulatif</th>
            </tr>
          </thead>

          {(grouped ? WEIGH_ORDER : [null]).map((tier) => {
            const group = rows.filter((r) => tier == null || r.row.tier === tier);
            if (!group.length) return null;

            return (
              <tbody key={tier ?? "all"}>
                {tier && (
                  <tr>
                    <td colSpan={5} className="px-3 pb-1 pt-3">
                      <span
                        className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                        style={{ color: TIER_META[tier].color }}
                      >
                        {TIER_META[tier].label}
                      </span>
                    </td>
                  </tr>
                )}

                {group.map(({ row, gram, cumulative }) => {
                  const checked = done.has(row.lineId);
                  const small = gram > 0 && gram < MIN_WEIGHABLE_G;

                  return (
                    <tr
                      key={row.lineId}
                      className={cn(
                        "border-b border-[var(--border)]",
                        checked && "text-[var(--text-subtle)] print:text-inherit",
                      )}
                    >
                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(row.lineId)}
                          aria-label={`Tandai ${row.name} sudah ditimbang`}
                          className="size-4 accent-[var(--brand)]"
                        />
                      </td>

                      <td className="px-3 py-2.5 align-top">
                        <span
                          className={cn(
                            "font-medium",
                            checked && "line-through print:no-underline",
                          )}
                        >
                          {row.name}
                        </span>
                        {row.kind === "accord" && (
                          <>
                            <span className="ml-1.5 rounded bg-[var(--brand-soft)] px-1 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                              ACCORD
                            </span>
                            {/* Ditimbang dari botol accord-nya, jadi tetap satu
                                baris. Isinya dicantumkan supaya ketahuan kalau
                                botolnya habis. */}
                            {row.sub.length > 0 && (
                              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-subtle)]">
                                isi:{" "}
                                {row.sub
                                  .map(
                                    (s) =>
                                      `${s.name} ${fmtPct(
                                        (s.productPct / row.pct) * 100,
                                      )}`,
                                  )
                                  .join(" · ")}
                              </p>
                            )}
                          </>
                        )}
                        {row.kind === "fo" && (
                          <span className="ml-1.5 rounded bg-[#f0ece2] px-1 py-0.5 text-[10px] font-semibold text-[#8a6d2f]">
                            FO
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 align-top text-[13px] text-[var(--text-muted)]">
                        {row.userDilutionPct < 100
                          ? `${fmtNum(row.userDilutionPct)}% dalam ${
                              row.userSolventName ?? "?"
                            }`
                          : "neat"}
                        {row.supplierDilutionPct !== null && (
                          <span className="block text-[11px] text-[var(--text-subtle)]">
                            bawaan {fmtNum(row.supplierDilutionPct)}%
                            {row.supplierSolventName
                              ? ` ${row.supplierSolventName}`
                              : ""}
                          </span>
                        )}
                      </td>

                      <td className="numeric px-3 py-2.5 text-right align-top font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {small && (
                            <AlertTriangle
                              className="size-3.5 text-[var(--warn)]"
                              aria-label="di bawah ketelitian timbangan"
                            />
                          )}
                          {fmtGram(gram)}
                        </span>
                      </td>

                      <td className="numeric px-3 py-2.5 text-right align-top text-[var(--text-muted)]">
                        {fmtGram(cumulative)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}

          <tfoot>
            <tr className="bg-[var(--surface-muted)] font-semibold print:bg-transparent">
              <td />
              <td className="px-3 py-2.5" colSpan={2}>
                Total
              </td>
              <td className="numeric px-3 py-2.5 text-right">
                {fmtGram(totalG)}
              </td>
              <td className="numeric px-3 py-2.5 text-right">
                {fmtGram(totalG)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[12px] leading-relaxed text-[var(--text-subtle)]">
        Timbangan 0,01 g: bahan di bawah {fmtNum(MIN_WEIGHABLE_G)} g sebaiknya
        dibuat dilusi dulu. Urutannya Base → Mid → Top: yang berat dan kental
        duluan, citrus terakhir supaya tidak lama terpapar udara.
      </p>
    </div>
  );
}
