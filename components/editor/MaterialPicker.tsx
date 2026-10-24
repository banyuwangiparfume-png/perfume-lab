"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { NewMaterialForm } from "@/components/materials/NewMaterialForm";
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
import { dominantFacet } from "@/lib/calc/aroma";
import { pickTier, pricePerUnit } from "@/lib/calc/price";
import type { Material, Settings, Tier } from "@/lib/calc/types";
import type { CreatedMaterial } from "@/app/actions/materials";
import type { AccordOption } from "@/lib/data/versions";
import type { MaterialMeta } from "@/lib/data/loadEditorData";
import { TIER_META, facetColor, facetLabel } from "@/lib/tiers";
import { cn } from "@/lib/utils";

const ALL = "__all";
const NO_FACET = "__none";
const NO_ROLE = "__none";
const ROLE_ORDER = ["modifier", "diffuser", "fixative", "bridger", NO_ROLE];
const ROLE_LABEL: Record<string, string> = {
  modifier: "Modifier",
  diffuser: "Diffuser",
  fixative: "Fixative",
  bridger: "Bridger",
  [NO_ROLE]: "Belum ada peran",
};

/** Satu baris chip yang bisa digeser ke samping kalau tidak muat. */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] text-[var(--text-subtle)]">{label}</span>
      <div className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 pb-0.5">
        {children}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        active
          ? "border-[var(--cta)] bg-[var(--cta)] text-white"
          : "border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text)]",
      )}
    >
      {children}
    </button>
  );
}

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
          <span className="text-[var(--text-subtle)]">{facetLabel(key)}</span>
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
  onCreated,
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
  /**
   * Bahan baru dibuat dari sini. Editor perlu bahan itu di daftarnya SEBELUM
   * baris ditambahkan — kalau tidak, analisa menghitung baris yang bahannya
   * belum dikenal.
   */
  onCreated?: (created: CreatedMaterial) => void;
}) {
  const [tab, setTab] = useState<"material" | "accord" | "fo">("material");
  const [onlyStock, setOnlyStock] = useState(false);
  const [query, setQuery] = useState("");
  // Nama awal bahan yang sedang dibuat; null = mode cari biasa.
  const [creating, setCreating] = useState<string | null>(null);

  const tierKey = pickTier(batchG, settings, priceTierOverride);

  // Pengelompokan: aroma dulu (facet paling menentukan), lalu peran. Bebas
  // dipilih — beda dari Tingkatkan yang MENYARANKAN sesuai arah formula; di
  // sini daftarnya cuma dirapikan supaya mudah disisir.
  const [aroma, setAroma] = useState<string>(ALL);
  const [role, setRole] = useState<string>(ALL);

  const base = useMemo(
    () =>
      (onlyStock ? materials.filter((m) => stock.has(m.id)) : materials).map(
        (m) => ({
          m,
          aroma: dominantFacet(m.facets) ?? NO_FACET,
          role: (m.functionCategory ?? "").toLowerCase() || NO_ROLE,
        }),
      ),
    [materials, onlyStock, stock],
  );

  // Hitungan tiap chip mengikuti pilihan di baris LAIN, supaya angka di chip
  // peran menjawab "berapa diffuser yang woody", bukan "berapa diffuser".
  const aromaCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of base) {
      if (role !== ALL && r.role !== role) continue;
      c.set(r.aroma, (c.get(r.aroma) ?? 0) + 1);
    }
    // Pilihan yang sedang aktif tetap tampil walau isinya nol — kalau
    // chip-nya hilang, daftar kosong tanpa ada yang bisa diklik untuk keluar.
    if (aroma !== ALL && !c.has(aroma)) c.set(aroma, 0);
    return [...c.entries()].sort(
      (a, b) =>
        Number(a[0] === NO_FACET) - Number(b[0] === NO_FACET) || b[1] - a[1],
    );
  }, [base, role, aroma]);
  const roleCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of base) {
      if (aroma !== ALL && r.aroma !== aroma) continue;
      c.set(r.role, (c.get(r.role) ?? 0) + 1);
    }
    if (role !== ALL && !c.has(role)) c.set(role, 0);
    return ROLE_ORDER.filter((k) => c.has(k)).map((k) => [k, c.get(k)!] as const);
  }, [base, aroma, role]);

  const rows = useMemo(
    () =>
      base
        .filter(
          (r) =>
            (aroma === ALL || r.aroma === aroma) &&
            (role === ALL || r.role === role),
        )
        .map(({ m }) => ({
          m,
          info: meta.get(m.id),
          pricePerG: pricePerUnit(m, tierKey).pricePerUnit,
        })),
    [base, aroma, role, meta, tierKey],
  );

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-[680px] gap-3 overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>
            {creating != null
              ? "Bahan baru"
              : `Tambah ke ${TIER_META[tier].label}`}
          </DialogTitle>
          <DialogDescription>
            {creating != null
              ? `Masuk ke master bahan, lalu langsung ditambahkan ke ${TIER_META[tier].label}.`
              : TIER_META[tier].hint}
          </DialogDescription>
        </DialogHeader>

        {creating != null && onCreated ? (
          // Tinggi dibatasi sendiri: DialogContent memotong isinya
          // (overflow-hidden) dan tidak memberi tinggi ke anaknya, jadi tanpa
          // ini bagian bawah form — harga dan tombol simpan — terpotong.
          <div className="max-h-[calc(85dvh-8rem)] overflow-y-auto px-5">
            <button
              type="button"
              onClick={() => setCreating(null)}
              className="mb-3 flex items-center gap-1 text-[12px] font-medium text-[var(--text-muted)]"
            >
              <ArrowLeft className="size-3.5" />
              Kembali ke pencarian
            </button>
            <NewMaterialForm
              initialName={creating}
              submitLabel={`Simpan & tambah ke ${TIER_META[tier].label}`}
              onCancel={() => setCreating(null)}
              onCreated={(created) => {
                onCreated(created);
                onPick({ kind: "raw_material", refId: created.id });
                setCreating(null);
                close();
              }}
            />
          </div>
        ) : (
          <>

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

        {tab === "material" && (
          <div className="space-y-1.5 px-5">
            <ChipRow label="Aroma">
              <Chip active={aroma === ALL} onClick={() => setAroma(ALL)}>
                Semua
              </Chip>
              {aromaCounts.map(([key, n]) => (
                <Chip key={key} active={aroma === key} onClick={() => setAroma(aroma === key ? ALL : key)}>
                  {key !== NO_FACET && (
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: facetColor(key) }}
                    />
                  )}
                  {key === NO_FACET ? "Tanpa facet" : facetLabel(key)}
                  <span className="text-[10px] opacity-70">{n}</span>
                </Chip>
              ))}
            </ChipRow>
            <ChipRow label="Peran">
              <Chip active={role === ALL} onClick={() => setRole(ALL)}>
                Semua
              </Chip>
              {roleCounts.map(([key, n]) => (
                <Chip key={key} active={role === key} onClick={() => setRole(role === key ? ALL : key)}>
                  {ROLE_LABEL[key] ?? key}
                  <span className="text-[10px] opacity-70">{n}</span>
                </Chip>
              ))}
            </ChipRow>
          </div>
        )}

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
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              // Enter saat tidak ada hasil sama sekali = buat bahan baru.
              // Kalau ada hasil, Enter tetap memilih yang disorot.
              if (
                e.key === "Enter" &&
                tab === "material" &&
                onCreated &&
                query.trim() &&
                !e.currentTarget
                  .closest("[cmdk-root]")
                  ?.querySelector("[cmdk-item]")
              ) {
                e.preventDefault();
                setCreating(query.trim());
              }
            }}
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
                ? "Tidak ada bahan yang cocok."
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

                    {/* Facet adalah ringkasan hasil hitung; odour profile
                        adalah kata-kata supplier yang jadi sumbernya. Dua
                        baris cukup untuk menangkap wataknya tanpa membuat
                        daftar panjang jadi sulit disisir. */}
                    {info?.odourProfile && (
                      <p className="line-clamp-2 text-[11px] leading-snug text-[var(--text-muted)]">
                        {info.odourProfile}
                      </p>
                    )}
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

        {/*
          Tombol biasa di LUAR daftar hasil, bukan baris di dalamnya. Sebagai
          baris, dia ikut disaring pencarian — dan cmdk mengunci kata kuncinya
          saat baris pertama muncul (kolom cari masih kosong), jadi begitu
          nama diketik, barisnya hilang tepat saat dibutuhkan.

          Selalu tampil, bukan cuma saat hasil kosong: nama yang mirip bisa
          muncul padahal bahan yang dicari memang belum ada.
        */}
        {tab === "material" && onCreated && (
          <div className="border-t border-[var(--border)] px-5 py-2.5">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setCreating(query.trim())}
            >
              <Plus className="size-4" />
              <span className="truncate">
                {query.trim()
                  ? `Buat bahan baru “${query.trim()}”`
                  : "Buat bahan baru"}
              </span>
            </Button>
          </div>
        )}
          </>
        )}

        {creating == null && (
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-2.5 text-[11px] text-[var(--text-subtle)]">
          <span>↑↓ pilih · Enter tambah · Esc tutup</span>
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Tutup
          </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { Plus };
