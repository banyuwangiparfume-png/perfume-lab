"use client";

import { useState } from "react";
import { Lock, LockOpen, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { ImpactBadge } from "@/components/shared/ImpactBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtGram, fmtIdr, fmtNum, fmtPct } from "@/lib/calc/format";
import type { Line, Material, Tier } from "@/lib/calc/types";
import { PYRAMID_TIERS, TIER_META, parseDecimal } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export type LineView = {
  line: Line;
  label: string;
  material: Material | null;
  /** jumlah bahan di dalamnya, kalau baris ini accord */
  accordSize?: number;
  productPct: number;
  strengthPct: number | null;
  cost: number | null;
  /** R5 terpicu — kekuatannya jauh melebihi porsinya */
  dominant: boolean;
};

const DILUTION_CHIPS = [100, 50, 25, 10, 5, 1];

/**
 * Gembok: terbuka = ikut dibagi otomatis, terkunci = dipatok user.
 *
 * Mengetik persen otomatis mengunci barisnya. Itu yang membuat "atur satu
 * angka, sisanya menyesuaikan" terasa wajar tanpa user harus memikirkan
 * mekanismenya.
 */
function LockToggle({
  locked,
  onToggle,
}: {
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-label={locked ? "Buka kunci baris" : "Kunci baris"}
          aria-pressed={locked}
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md transition-colors",
            locked
              ? "text-[var(--text)] hover:bg-[var(--surface-muted)]"
              : "text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]",
          )}
        >
          {locked ? (
            <Lock className="size-4" />
          ) : (
            <LockOpen className="size-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px]">
        {locked
          ? "Terkunci: angka ini tidak ikut dibagi otomatis."
          : "Terbuka: angka ini menyesuaikan sisa target tier."}
      </TooltipContent>
    </Tooltip>
  );
}

function DilutionPopover({
  line,
  material,
  solvents,
  onChange,
}: {
  line: Line;
  material: Material | null;
  solvents: { id: string; name: string }[];
  onChange: (pct: number, solventId: string | null) => void;
}) {
  const [draft, setDraft] = useState(String(line.userDilutionPct));
  const diluted = line.userDilutionPct < 100;
  const solventName =
    solvents.find((s) => s.id === line.userSolventId)?.name ?? "";

  const active = parseDecimal(draft) ?? line.userDilutionPct;
  const activePct = (line.pct * active) / 100;
  const solventPct = line.pct - activePct;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
            diluted
              ? "border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand)]"
              : "border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]",
          )}
        >
          {diluted
            ? `${fmtNum(line.userDilutionPct)}%${solventName ? ` ${solventName}` : ""}`
            : "neat"}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] space-y-3" align="start">
        <div>
          <Label className="mb-1.5 text-[13px]">Dilusi yang kamu buat</Label>
          <div className="flex gap-1.5">
            <Input
              inputMode="decimal"
              className="numeric h-8"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                const n = parseDecimal(e.target.value);
                if (n != null && n > 0 && n <= 100) {
                  onChange(n, n >= 100 ? null : line.userSolventId);
                }
              }}
            />
            <span className="self-center text-[13px] text-[var(--text-subtle)]">
              %
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {DILUTION_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setDraft(String(c));
                  onChange(c, c >= 100 ? null : line.userSolventId);
                }}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[11px] font-medium",
                  line.userDilutionPct === c
                    ? "border-[var(--cta)] bg-[var(--cta)] text-white"
                    : "border-[var(--border)] text-[var(--text-muted)]",
                )}
              >
                {c === 100 ? "neat" : `${c}%`}
              </button>
            ))}
          </div>
        </div>

        {active < 100 && (
          <div>
            <Label className="mb-1.5 text-[13px]">
              Pelarut <span className="text-[var(--danger)]">*</span>
            </Label>
            <Select
              value={line.userSolventId ?? ""}
              onValueChange={(v) => onChange(active, v)}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Pilih pelarut" />
              </SelectTrigger>
              <SelectContent>
                {solvents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!line.userSolventId && (
              <p className="mt-1 text-[11px] text-[var(--warn)]">
                Wajib diisi — tanpa ini formulanya tidak bisa dibuat ulang, dan
                pelarutnya tidak ikut terhitung.
              </p>
            )}
          </div>
        )}

        {material && material.supplierDilutionPct < 100 && (
          <p className="rounded bg-[var(--surface-muted)] p-2 text-[11px] text-[var(--text-muted)]">
            Produk ini <strong>sudah {fmtNum(material.supplierDilutionPct)}%</strong>{" "}
            dari supplier. Pelarut bawaannya ikut masuk formula dan terhitung di
            tab Pelarut.
          </p>
        )}

        {/* Teks hasil hitung — bukan hiasan. Tertukarnya persen timbang dengan
            persen aktif adalah kesalahan termahal di aplikasi jenis ini. */}
        <p className="border-t border-[var(--border)] pt-2 text-[13px] font-medium">
          {fmtPct(line.pct)} @ {fmtNum(active)}% ={" "}
          <span className="text-[var(--brand)]">{fmtPct(activePct)} bahan</span>
          {solventPct > 0 && (
            <>
              {" · "}
              {fmtPct(solventPct)} pelarut masuk formula
            </>
          )}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function LineRow({
  view,
  batchG,
  solvents,
  highlighted,
  currentTier,
  onEditPct,
  onToggleLock,
  onRemove,
  onDilution,
  onMove,
}: {
  view: LineView;
  batchG: number;
  solvents: { id: string; name: string }[];
  highlighted: boolean;
  currentTier: Tier;
  onEditPct: (pct: number) => void;
  onToggleLock: () => void;
  onRemove: () => void;
  onDilution: (pct: number, solventId: string | null) => void;
  onMove: (tier: Tier) => void;
}) {
  const { line, material } = view;
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(line.pct);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 transition-colors sm:flex-nowrap",
        highlighted && "bg-[var(--warn-soft)]",
      )}
    >
      <LockToggle locked={line.locked} onToggle={onToggleLock} />

      <div className="min-w-[160px] flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium">{view.label}</span>
          {line.kind === "accord" && (
            <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
              ACCORD{view.accordSize ? ` · ${view.accordSize}` : ""}
            </span>
          )}
          {line.kind === "fo" && (
            <span className="rounded bg-[#f0ece2] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6d2f]">
              FO
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {line.kind === "raw_material" && (
            <>
              <ImpactBadge value={material?.impact ?? null} />
              {material?.functionCategory && (
                <span className="text-[11px] capitalize text-[var(--text-subtle)]">
                  {material.functionCategory}
                </span>
              )}
            </>
          )}
          {line.kind !== "accord" && (
            <DilutionPopover
              line={line}
              material={material}
              solvents={solvents}
              onChange={onDilution}
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Input
          inputMode="decimal"
          aria-label={`Persen ${view.label}`}
          className="numeric h-8 w-[88px]"
          value={shown}
          onFocus={() => setDraft(String(line.pct))}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseDecimal(e.target.value);
            if (n != null && n >= 0) onEditPct(n);
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="text-[12px] text-[var(--text-subtle)]">%</span>
      </div>

      <span className="numeric w-[76px] shrink-0 text-[13px] text-[var(--text-muted)]">
        {fmtGram((line.pct / 100) * batchG)} g
      </span>

      <span className="numeric w-[86px] shrink-0 text-[13px] text-[var(--text-muted)]">
        {view.cost == null ? "—" : fmtIdr(view.cost)}
      </span>

      <span
        className={cn(
          "numeric w-[76px] shrink-0 text-[13px] font-medium",
          view.dominant && "text-[var(--danger)]",
        )}
        title={
          view.dominant
            ? "Kekuatannya jauh melebihi porsinya — kemungkinan mendominasi"
            : undefined
        }
      >
        {view.strengthPct == null ? "—" : fmtPct(view.strengthPct)}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Aksi baris">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {PYRAMID_TIERS.filter((t) => t !== currentTier).map((t) => (
            <DropdownMenuItem key={t} onClick={() => onMove(t)}>
              Pindah ke {TIER_META[t].label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onRemove}>
            <Trash2 className="size-4" />
            Hapus baris
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function TierCard({
  tier,
  target,
  filled,
  diff,
  ok,
  batchG,
  views,
  solvents,
  highlighted,
  pyramidMode,
  onAdd,
  onEditPct,
  onToggleLock,
  onRemove,
  onDilution,
  onMove,
  onNormalize,
  onRetarget,
  onSpread,
}: {
  tier: Tier;
  target: number;
  filled: number;
  diff: number;
  ok: boolean;
  batchG: number;
  views: LineView[];
  solvents: { id: string; name: string }[];
  highlighted: string[];
  pyramidMode: boolean;
  onAdd: () => void;
  onEditPct: (lineId: string, pct: number) => void;
  onToggleLock: (lineId: string) => void;
  onRemove: (lineId: string) => void;
  onDilution: (lineId: string, pct: number, solventId: string | null) => void;
  onMove: (lineId: string, tier: Tier) => void;
  onNormalize: () => void;
  onRetarget: (target: number) => void;
  onSpread: () => void;
}) {
  const meta = TIER_META[tier];

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <header
        className="flex flex-wrap items-center gap-2 border-l-4 px-4 py-3"
        style={{ borderLeftColor: meta.color, backgroundColor: meta.soft }}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold uppercase tracking-[0.04em]">
            {meta.label}
            {pyramidMode && (
              <span className="ml-2 font-normal normal-case text-[var(--text-muted)]">
                target {fmtPct(target)} · {fmtGram((target / 100) * batchG)} g
              </span>
            )}
          </h2>
          <p
            className={cn(
              "mt-0.5 text-[12px]",
              ok ? "text-[var(--text-muted)]" : "font-medium text-[var(--warn)]",
            )}
          >
            terisi {fmtPct(filled)}
            {ok ? " ✓" : ` · ${diff > 0 ? "+" : "−"}${fmtPct(Math.abs(diff))}`}
          </p>
        </div>

        <div className="flex gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={onSpread}>
            Ratakan
          </Button>
          {!ok && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-white"
                onClick={onNormalize}
              >
                Normalisasi ke {fmtPct(target)}
              </Button>
              {pyramidMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-white"
                  onClick={() => onRetarget(filled)}
                >
                  Jadikan target {fmtPct(filled)}
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="divide-y divide-[var(--border)] px-2 py-1">
        {views.length === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-[var(--text-muted)]">
            Belum ada bahan di {meta.label}. {meta.hint}
          </p>
        ) : (
          views.map((v) => (
            <LineRow
              key={v.line.id}
              view={v}
              batchG={batchG}
              solvents={solvents}
              currentTier={tier}
              highlighted={highlighted.includes(v.line.id)}
              onEditPct={(pct) => onEditPct(v.line.id, pct)}
              onToggleLock={() => onToggleLock(v.line.id)}
              onRemove={() => onRemove(v.line.id)}
              onDilution={(pct, solventId) =>
                onDilution(v.line.id, pct, solventId)
              }
              onMove={(t) => onMove(v.line.id, t)}
            />
          ))
        )}
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-strong)] py-2 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
        >
          <Plus className="size-4" />
          Tambah bahan
        </button>
      </div>
    </section>
  );
}
