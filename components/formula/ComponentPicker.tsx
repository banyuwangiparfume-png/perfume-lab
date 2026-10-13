"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { ImpactBadge } from "@/components/shared/ImpactBadge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fmtIdr, fmtNum } from "@/lib/calc/format";
import type { LineType } from "@/lib/legacy/calc/types";
import { FUNCTION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PickerData } from "./editor-types";

/**
 * Picker komponen, isinya mengikuti jenis baris.
 *
 * Tab Bahan menampilkan impact dan kategori fungsi di tiap opsi supaya user
 * belajar sambil memilih — itu salah satu cara aplikasi ini mengajar tanpa
 * membuat halaman tutorial.
 *
 * Tab Formula tetap menampilkan versi yang tidak boleh dipakai, tapi
 * non-aktif dengan alasannya. Menyembunyikannya hanya membuat user
 * mencari-cari.
 */
export function ComponentPicker({
  lineType,
  value,
  data,
  usedIds,
  onSelect,
  disabled,
  invalid,
}: {
  lineType: LineType;
  value: string | null;
  data: PickerData;
  usedIds: Set<string>;
  onSelect: (id: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const label = useMemo(() => {
    if (!value) return null;
    if (lineType === "raw_material")
      return data.materials.find((m) => m.id === value)?.name ?? null;
    if (lineType === "fo")
      return data.fos.find((f) => f.id === value)?.name ?? null;
    return data.subFormulas.find((s) => s.versionId === value)?.label ?? null;
  }, [value, lineType, data]);

  const placeholder =
    lineType === "raw_material"
      ? "Pilih bahan…"
      : lineType === "fo"
        ? "Pilih FO…"
        : "Pilih formula…";

  const isEmpty =
    lineType === "raw_material"
      ? data.materials.length === 0
      : lineType === "fo"
        ? data.fos.length === 0
        : data.subFormulas.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between bg-white px-2.5 font-normal",
            !label && "text-[var(--text-subtle)]",
            invalid && "border-[var(--danger)]",
          )}
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(440px,calc(100vw-2rem))] p-0" align="start">
        {isEmpty ? (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
            {lineType === "raw_material"
              ? "Master bahan masih kosong. Impor pricelist dulu di Admin → Raw Materials."
              : lineType === "fo"
                ? "Belum ada FO terdaftar. Tambahkan bibit yang kamu pakai di menu FO."
                : "Belum ada versi formula lain yang bisa dipakai sebagai komponen."}
          </p>
        ) : (
          <Command
            filter={(itemValue, search, keywords) => {
              const haystack = [itemValue, ...(keywords ?? [])]
                .join(" ")
                .toLowerCase();
              return haystack.includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput
              placeholder={
                lineType === "raw_material"
                  ? "Cari nama, sinonim, atau CAS…"
                  : "Cari…"
              }
            />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>Tidak ada yang cocok.</CommandEmpty>

              {lineType === "raw_material" && (
                <CommandGroup>
                  {data.materials.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={m.id}
                      keywords={[
                        m.name,
                        m.synonym ?? "",
                        m.cas_number ?? "",
                        m.family ?? "",
                      ]}
                      onSelect={() => {
                        onSelect(m.id);
                        setOpen(false);
                      }}
                      className="flex-col items-stretch gap-0.5 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate font-medium">
                          {m.name}
                        </span>
                        <ImpactBadge
                          value={m.effectiveImpact}
                          supplierValue={m.odor_impact}
                        />
                        {m.function_category && (
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {FUNCTION_LABELS[m.function_category]}
                          </span>
                        )}
                        {usedIds.has(m.id) && (
                          <Check className="size-3.5 text-[var(--ok)]" />
                        )}
                      </div>
                      <p className="truncate text-[11px] text-[var(--text-subtle)]">
                        {[m.synonym, m.cas_number ? `CAS ${m.cas_number}` : null]
                          .filter(Boolean)
                          .join(" · ") || m.family || " "}
                      </p>
                      <div className="flex items-baseline gap-2 text-[11px] text-[var(--text-subtle)]">
                        <span className="flex-1 truncate">
                          {m.odour_profile ?? ""}
                        </span>
                        {m.pricePerGram != null && (
                          <span className="numeric shrink-0">
                            {fmtIdr(m.pricePerGram)}/g
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {lineType === "fo" && (
                <CommandGroup>
                  {data.fos.map((f) => (
                    <CommandItem
                      key={f.id}
                      value={f.id}
                      keywords={[f.name, f.inspired_by ?? "", f.family]}
                      onSelect={() => {
                        onSelect(f.id);
                        setOpen(false);
                      }}
                      className="flex-col items-stretch gap-0.5 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate font-medium">
                          {f.name}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {f.family}
                        </span>
                        {usedIds.has(f.id) && (
                          <Check className="size-3.5 text-[var(--ok)]" />
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 text-[11px] text-[var(--text-subtle)]">
                        <span className="flex-1 truncate">
                          {f.inspired_by ? `inspired by ${f.inspired_by}` : ""}
                        </span>
                        {f.price_per_gram != null && (
                          <span className="numeric shrink-0">
                            {fmtIdr(f.price_per_gram)}/g
                          </span>
                        )}
                      </div>
                      {/* Tidak ada kolom impact di sini — badge abu ini
                          menjelaskan kenapa, daripada membiarkan user mengira
                          datanya belum diisi. */}
                      <ImpactBadge value={null} isFo className="self-start" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {lineType === "sub_formula" && (
                <CommandGroup>
                  {data.subFormulas.map((s) => (
                    <CommandItem
                      key={s.versionId}
                      value={s.versionId}
                      keywords={[s.label, s.formulaType]}
                      disabled={!!s.disabledReason}
                      title={s.disabledReason ?? undefined}
                      onSelect={() => {
                        if (s.disabledReason) return;
                        onSelect(s.versionId);
                        setOpen(false);
                      }}
                      className="flex-col items-stretch gap-0.5 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate font-medium">
                          {s.label}
                        </span>
                        <span className="numeric text-[11px] text-[var(--text-muted)]">
                          {s.materialCount} bahan
                          {s.averageImpact != null && (
                            <> · impact rata² {fmtNum(s.averageImpact)}</>
                          )}
                        </span>
                        {usedIds.has(s.versionId) && (
                          <Check className="size-3.5 text-[var(--ok)]" />
                        )}
                      </div>
                      {s.disabledReason && (
                        <p className="text-[11px] text-[var(--warn)]">
                          {s.disabledReason}
                        </p>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
