"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { ImpactBadge } from "@/components/shared/ImpactBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtIdr } from "@/lib/calc/format";
import { FUNCTION_LABELS } from "@/lib/constants";
import type { FunctionCategoryEnum } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export type MaterialRow = {
  id: string;
  name: string;
  synonym: string | null;
  cas_number: string | null;
  family: string | null;
  function_category: FunctionCategoryEnum | null;
  /** kategorinya ditebak dari family, bukan data supplier */
  functionIsGuess?: boolean;
  odour_profile: string | null;
  effectiveImpact: number | null;
  odor_impact: number | null;
  odor_impact_note: string | null;
  pricePerGram: number | null;
  priceTierG: number | null;
  isGlobal: boolean;
};

const ALL = "all";

export function MaterialsTable({
  rows,
  families,
  initialImpactFilter,
}: {
  rows: MaterialRow[];
  families: string[];
  initialImpactFilter?: "yes" | "no";
}) {
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState(ALL);
  const [fn, setFn] = useState(ALL);
  const [impact, setImpact] = useState<string>(initialImpactFilter ?? ALL);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (family !== ALL && r.family !== family) return false;
      if (fn !== ALL && r.function_category !== fn) return false;
      if (impact === "yes" && r.effectiveImpact == null) return false;
      if (impact === "no" && r.effectiveImpact != null) return false;
      if (!q) return true;
      return [r.name, r.synonym, r.cas_number, r.odour_profile]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [rows, search, family, fn, impact]);

  const columns = useMemo<ColumnDef<MaterialRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/materials/${row.original.id}`}
              className="font-medium hover:text-[var(--brand)]"
            >
              {row.original.name}
            </Link>
            {row.original.synonym && (
              <p className="truncate text-[12px] text-[var(--text-subtle)]">
                {row.original.synonym}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "family",
        header: "Family",
        cell: ({ row }) => (
          <span className="text-[13px] text-[var(--text-muted)]">
            {row.original.family ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "function_category",
        header: "Kategori fungsi",
        cell: ({ row }) => (
          <span className="text-[13px] text-[var(--text-muted)]">
            {row.original.function_category
              ? FUNCTION_LABELS[row.original.function_category]
              : "—"}
            {/* Tebakan harus bisa dibedakan dari data, kalau tidak dia
                menyamar jadi fakta begitu ditulis di tabel. */}
            {row.original.functionIsGuess && row.original.function_category && (
              <span
                className="ml-1 text-[11px] text-[var(--text-subtle)]"
                title="Ditebak dari family bahannya, bukan data supplier"
              >
                ?
              </span>
            )}
          </span>
        ),
      },
      {
        id: "impact",
        accessorFn: (r) => r.effectiveImpact ?? -1,
        header: "Impact",
        cell: ({ row }) => (
          <ImpactBadge
            value={row.original.effectiveImpact}
            supplierValue={row.original.odor_impact}
            overrideNote={row.original.odor_impact_note}
          />
        ),
      },
      {
        id: "price",
        accessorFn: (r) => r.pricePerGram ?? -1,
        header: "Harga/g",
        cell: ({ row }) =>
          row.original.pricePerGram == null ? (
            <span className="text-[13px] text-[var(--text-subtle)]">
              belum ada
            </span>
          ) : (
            <span className="numeric text-[13px]">
              {fmtIdr(row.original.pricePerGram)}
              <span className="ml-1 text-[11px] text-[var(--text-subtle)]">
                tier {row.original.priceTierG}g
              </span>
            </span>
          ),
      },
      {
        accessorKey: "odour_profile",
        header: "Odour profile",
        enableSorting: false,
        cell: ({ row }) => (
          <p className="line-clamp-2 max-w-[260px] text-[12px] text-[var(--text-muted)]">
            {row.original.odour_profile ?? "—"}
          </p>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const missingCount = filtered.filter((r) => r.effectiveImpact == null).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, sinonim, CAS, atau deskriptor…"
            className="bg-white pl-8"
            aria-label="Cari bahan"
          />
        </div>

        <Select value={family} onValueChange={setFamily}>
          <SelectTrigger className="w-[150px] bg-white" aria-label="Filter family">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua family</SelectItem>
            {families.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={fn} onValueChange={setFn}>
          <SelectTrigger
            className="w-[160px] bg-white"
            aria-label="Filter kategori fungsi"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua kategori</SelectItem>
            {(
              Object.keys(FUNCTION_LABELS) as FunctionCategoryEnum[]
            ).map((k) => (
              <SelectItem key={k} value={k}>
                {FUNCTION_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={impact} onValueChange={setImpact}>
          <SelectTrigger
            className="w-[170px] bg-white"
            aria-label="Filter data impact"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Impact: semua</SelectItem>
            <SelectItem value="yes">Punya data impact</SelectItem>
            <SelectItem value="no">Belum ada impact</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-[13px] text-[var(--text-muted)]">
        {filtered.length} bahan
        {missingCount > 0 && (
          <span className="text-[var(--warn)]">
            {" "}
            &middot; {missingCount} belum punya nilai impact, dan formula yang
            memakainya tidak akan bisa dinilai lengkap
          </span>
        )}
      </p>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr
                key={group.id}
                className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]"
              >
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const dir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-3 py-2 text-left font-medium"
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-[var(--text)]"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {dir === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : dir === "desc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-[var(--border)] hover:bg-[var(--surface-muted)]",
                  row.original.effectiveImpact == null &&
                    "bg-[var(--warn-soft)]/40",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-[13px] text-[var(--text-muted)]"
                >
                  Tidak ada bahan yang cocok dengan filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
