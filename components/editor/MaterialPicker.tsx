"use client";

import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtIdr, fmtNum } from "@/lib/calc/format";
import { pickTier, pricePerUnit } from "@/lib/calc/price";
import type { Material, Settings, Tier } from "@/lib/calc/types";
import type { AccordOption } from "@/lib/data/versions";
import type { MaterialMeta } from "@/lib/data/loadEditorData";
import { TIER_META, facetColor } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export type PickResult =
  | { kind: "raw_material"; refId: string }
  | { kind: "accord"; refId: string }
  | { kind: "fo"; refId: string };

/** Tiga facet terkuat sebagai titik warna — cukup untuk menangkap arahnya. */
function FacetDots({ facets }: { facets: Record<string, number> }) {
  const top = Object.entries(facets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (!top.length) return null;
  return (
    <span className="flex items-center gap-2">
      {top.map(([key, w]) => (
        <span key={key} className="flex items-center gap-1 text-[11px]">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: facetColor(key) }}
          />
          <span className="capitalize text-[var(--text-subtle)]">{key}</span>
          <span className="numeric text-[var(--text-subtle)]">
            {Math.round(w * 100)}
          </span>
        </span>
      ))}
    </span>
  );
}

export function MaterialPicker({
  open,
  onOpenChange,
  tier,
  materials,
  meta,
  accords,
  fos,
  usedIds,
  stock,
  settings,
  batchG,
  priceTierOverride,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: Tier;
  materials: Material[];
  meta: Map<string, MaterialMeta>;
  accords: AccordOption[];
  fos: { id: string; name: string; pricePerGram: number | null }[];
  usedIds: Set<string>;
  stock: Set<string>;
  settings: Settings;
  batchG: number;
  priceTierOverride: number | null;
  onPick: (pick: PickResult) => void;
}) {
  const [tab, setTab] = useState<"material" | "accord" | "fo">("material");
  const [onlyStock, setOnlyStock] = useState(false);

  const tierKey = pickTier(batchG, settings, priceTierOverride);

  const rows = useMemo(() => {
    const list = onlyStock
      ? materials.filter((m) => stock.has(m.id))
      : materials;
    return list.map((m) => {
      const price = pricePerUnit(m, tierKey);
      return { m, info: meta.get(m.id), pricePerG: price.pricePerUnit };
    });
  }, [materials, meta, onlyStock, stock, tierKey]);

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-[680px] gap-3 overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>
            Tambah ke {TIER_META[tier].label}
          </DialogTitle>
          <DialogDescription>{TIER_META[tier].hint}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 px-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="material">Bahan</TabsTrigger>
              <TabsTrigger value="accord">
                Accord saya
                {accords.length > 0 && (
                  <span className="ml-1 text-[11px] text-[var(--text-subtle)]">
                    {accords.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="fo">FO</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "material" && (
            <button
              type="button"
              onClick={() => setOnlyStock((v) => !v)}
              className={cn(
                "ml-auto rounded-md border px-2 py-1 text-[12px] font-medium",
                onlyStock
                  ? "border-[var(--cta)] bg-[var(--cta)] text-white"
                  : "border-[var(--border-strong)] text-[var(--text-muted)]",
              )}
            >
              ☆ Stok saya
            </button>
          )}
        </div>

        <Command
          className="border-t border-[var(--border)]"
          filter={(value, search, keywords) =>
            [value, ...(keywords ?? [])]
              .join(" ")
              .toLowerCase()
              .includes(search.toLowerCase())
              ? 1
              : 0
          }
        >
          <CommandInput
            placeholder={
              tab === "material"
                ? "Cari nama, sinonim, atau CAS…"
                : tab === "accord"
                  ? "Cari accord…"
                  : "Cari FO…"
            }
            autoFocus
          />
          <CommandList className="max-h-[48vh]">
            <CommandEmpty>
              {tab === "material"
                ? "Tidak ada bahan yang cocok. Kalau master bahan masih kosong, impor pricelist dulu di Admin."
                : tab === "accord"
                  ? "Belum ada accord tersimpan. Buat formula berkategori Accord, simpan versinya, lalu dia muncul di sini."
                  : "Belum ada FO terdaftar."}
            </CommandEmpty>

            {tab === "material" && (
              <CommandGroup>
                {rows.map(({ m, info, pricePerG }) => (
                  <CommandItem
                    key={m.id}
                    value={m.id}
                    keywords={[
                      m.name,
                      info?.synonym ?? "",
                      info?.casNumber ?? "",
                      info?.family ?? "",
                      info?.odourProfile ?? "",
                    ]}
                    onSelect={() => {
                      onPick({ kind: "raw_material", refId: m.id });
                      close();
                    }}
                    className="flex-col items-stretch gap-1 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate font-medium">
                        {m.name}
                      </span>
                      <ImpactBadge value={m.impact} />
                      {m.functionCategory && (
                        <span className="text-[11px] capitalize text-[var(--text-muted)]">
                          {m.functionCategory}
                        </span>
                      )}
                      {stock.has(m.id) && (
                        <span className="text-[12px] text-[var(--warn)]">★</span>
                      )}
                      {usedIds.has(m.id) && (
                        <Check className="size-3.5 text-[var(--ok)]" />
                      )}
                    </div>

                    <p className="truncate text-[11px] text-[var(--text-subtle)]">
                      {[
                        info?.casNumber ? `CAS ${info.casNumber}` : null,
                        info?.family,
                        m.noteTierHint && m.noteTierHint !== tier
                          ? `biasanya ${TIER_META[m.noteTierHint].label.toLowerCase()}`
                          : null,
                        m.supplierDilutionPct < 100
                          ? `bawaan ${fmtNum(m.supplierDilutionPct)}%`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || " "}
                    </p>

                    <div className="flex items-center gap-2">
                      <FacetDots facets={m.facets} />
                      {pricePerG != null && (
                        <span className="numeric ml-auto text-[11px] text-[var(--text-subtle)]">
                          {fmtIdr(pricePerG)}/g
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {tab === "accord" && (
              <CommandGroup>
                {accords.map((a) => (
                  <CommandItem
                    key={a.versionId}
                    value={a.versionId}
                    keywords={[a.label]}
                    disabled={!!a.disabledReason}
                    title={a.disabledReason ?? undefined}
                    onSelect={() => {
                      if (a.disabledReason) return;
                      onPick({ kind: "accord", refId: a.versionId });
                      close();
                    }}
                    className="flex-col items-stretch gap-0.5 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate font-medium">
                        {a.label}
                      </span>
                      <span className="numeric text-[11px] text-[var(--text-muted)]">
                        {a.materialCount} bahan
                      </span>
                      {usedIds.has(a.versionId) && (
                        <Check className="size-3.5 text-[var(--ok)]" />
                      )}
                    </div>
                    {a.disabledReason && (
                      <p className="text-[11px] text-[var(--warn)]">
                        {a.disabledReason}
                      </p>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {tab === "fo" && (
              <CommandGroup>
                {fos.map((f) => (
                  <CommandItem
                    key={f.id}
                    value={f.id}
                    keywords={[f.name]}
                    onSelect={() => {
                      onPick({ kind: "fo", refId: f.id });
                      close();
                    }}
                    className="flex-col items-stretch gap-0.5 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate font-medium">{f.name}</span>
                      {f.pricePerGram != null && (
                        <span className="numeric text-[11px] text-[var(--text-subtle)]">
                          {fmtIdr(f.pricePerGram)}/g
                        </span>
                      )}
                      {usedIds.has(f.id) && (
                        <Check className="size-3.5 text-[var(--ok)]" />
                      )}
                    </div>
                    {/* FO tidak punya impact maupun facet — dia dihitung
                        beratnya dan harganya, tapi dikeluarkan dari kekuatan
                        dan pie. */}
                    <ImpactBadge value={null} isFo className="self-start" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-2.5 text-[11px] text-[var(--text-subtle)]">
          <span>↑↓ pilih · Enter tambah · Esc tutup</span>
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { Plus };
