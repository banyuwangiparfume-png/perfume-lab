"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toggleStock } from "@/app/actions/versions";
import { fmtIdr, fmtNum } from "@/lib/calc/format";
import { FUNCTION_LABELS } from "@/lib/calc/functions";
import { cn } from "@/lib/utils";

export type StockRow = {
  id: string;
  name: string;
  synonym: string | null;
  family: string | null;
  functionCategory: string | null;
  impact: number | null;
  pricePerGram: number | null;
  inStock: boolean;
};

type Filter = "all" | "in" | "out";

/**
 * Daftar stok: satu klik bintang per bahan.
 *
 * Perubahannya optimistik. Menandai stok itu pekerjaan berulang — kalau tiap
 * klik menunggu server, menandai lima puluh bahan jadi pekerjaan yang
 * ditinggalkan di tengah jalan.
 */
export function StockManager({ rows }: { rows: StockRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [, start] = useTransition();

  const [stock, setStock] = useOptimistic(
    new Set(rows.filter((r) => r.inStock).map((r) => r.id)),
    (current: Set<string>, id: string) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    },
  );

  const toggle = (row: StockRow) => {
    const willBeInStock = !stock.has(row.id);
    start(async () => {
      setStock(row.id);
      const result = await toggleStock(row.id, willBeInStock);
      if (!result.ok) toast.error(result.error);
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const has = stock.has(r.id);
      if (filter === "in" && !has) return false;
      if (filter === "out" && has) return false;
      if (!q) return true;
      return [r.name, r.synonym, r.family]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [rows, search, filter, stock]);

  const count = stock.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          <Input
            className="pl-8"
            placeholder="Cari nama, sinonim, atau family…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1.5">
          {(
            [
              ["all", "Semua"],
              ["in", "Punya"],
              ["out", "Belum punya"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-[13px] text-[var(--text-muted)]">
        <strong className="font-semibold text-[var(--text)]">{count}</strong>{" "}
        bahan ditandai punya, dari {rows.length}. Yang ditandai muncul dengan ★
        di picker dan bisa dipakai menyaring saran bridger.
      </p>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
              <th className="w-12 px-3 py-2.5 text-left font-medium">Punya</th>
              <th className="px-3 py-2.5 text-left font-medium">Bahan</th>
              <th className="px-3 py-2.5 text-left font-medium">Family</th>
              <th className="px-3 py-2.5 text-left font-medium">Fungsi</th>
              <th className="px-3 py-2.5 text-right font-medium">Impact</th>
              <th className="px-3 py-2.5 text-right font-medium">Harga/g</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const has = stock.has(row.id);
              return (
                <tr
                  key={row.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      aria-pressed={has}
                      aria-label={`${has ? "Hapus" : "Tandai"} ${row.name} dari stok`}
                      className={cn(
                        "rounded p-1 transition-colors",
                        has
                          ? "text-[var(--warn)]"
                          : "text-[var(--text-subtle)] hover:text-[var(--text)]",
                      )}
                    >
                      <Star
                        className="size-4"
                        fill={has ? "currentColor" : "none"}
                      />
                    </button>
                  </td>

                  <td className="px-3 py-2">
                    <span className="font-medium">{row.name}</span>
                    {row.synonym && (
                      <p className="truncate text-[12px] text-[var(--text-subtle)]">
                        {row.synonym}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                    {row.family ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                    {row.functionCategory
                      ? (FUNCTION_LABELS[row.functionCategory] ??
                        row.functionCategory)
                      : "—"}
                  </td>
                  <td className="numeric px-3 py-2 text-right text-[13px]">
                    {row.impact == null ? "—" : fmtNum(row.impact)}
                  </td>
                  <td className="numeric px-3 py-2 text-right text-[13px] text-[var(--text-muted)]">
                    {row.pricePerGram == null
                      ? "—"
                      : `${fmtIdr(row.pricePerGram)}/g`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-[13px] text-[var(--text-muted)]">
          Tidak ada bahan yang cocok.
        </p>
      )}
    </div>
  );
}
