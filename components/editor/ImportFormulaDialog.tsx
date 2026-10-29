"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Download, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseFormulaFile } from "@/app/actions/formulaImport";
import { createMaterialsBulk, type CreatedMaterial } from "@/app/actions/materials";
import { toast } from "sonner";
import { fmtPct } from "@/lib/calc/format";
import type { Line, Pyramid } from "@/lib/calc/types";
import {
  isImportable,
  matchFormulaRows,
  missingMaterials,
  pyramidFrom,
  toLines,
  type ImportCatalog,
} from "@/lib/import/formulaImport";
import { TIER_META } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export type RawRow = { row: number; values: Record<string, unknown> };

/**
 * Import formula dari template Excel, dengan pratinjau sebelum apa pun
 * berubah.
 *
 * Pratinjau wajib, bukan pelengkap: berkasnya biasanya hasil AI, dan AI bisa
 * menulis nama yang tidak ada atau persen yang tidak berjumlah 100. Yang
 * bermasalah ditunjukkan per baris dengan nomor baris Excel-nya, supaya bisa
 * dibetulkan di berkas lalu diunggah ulang — bukan ditebak diam-diam.
 */
export function ImportFormulaDialog({
  open,
  onOpenChange,
  catalog,
  pyramidMode,
  currentLineCount,
  newId,
  onImport,
  onMaterialsCreated,
  initialRaw,
  initialFileName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: ImportCatalog;
  pyramidMode: boolean;
  currentLineCount: number;
  newId: () => string;
  onImport: (lines: Line[], pyramid: Pyramid | null) => void;
  /** bahan baru yang dibuat dari berkas — editor menambahkannya ke katalog */
  onMaterialsCreated?: (created: CreatedMaterial[]) => void;
  /** berkas yang sudah dibaca di halaman Formula baru */
  initialRaw?: RawRow[];
  initialFileName?: string;
}) {
  const [raw, setRaw] = useState<RawRow[] | null>(initialRaw ?? null);
  const [fileName, setFileName] = useState(initialFileName ?? "");
  const [creating, startCreating] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Dicocokkan ulang tiap katalog berubah — misalnya setelah bahan yang
  // belum ada dibuat — tanpa harus mengunggah ulang.
  const result = useMemo(
    () => (raw ? matchFormulaRows(raw, catalog, { pyramid: pyramidMode }) : null),
    [raw, catalog, pyramidMode],
  );

  const reset = () => {
    setRaw(null);
    setFileName("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = (file: File) => {
    setError(null);
    setFileName(file.name);
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const res = await parseFormulaFile(form);
      if (res.ok) setRaw(res.data);
      else {
        setRaw(null);
        setError(res.error);
      }
    });
  };

  const errors = result?.rows.filter((r) => !isImportable(r)).length ?? 0;
  const missing = result ? missingMaterials(result) : [];

  const createMissing = () =>
    startCreating(async () => {
      const res = await createMaterialsBulk(
        missing.map((m) => ({
          name: m.name,
          cas_number: m.cas,
          family: m.family,
          odour_profile: m.odourProfile,
          odor_impact: m.impact,
          category: m.category,
        })),
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Katalog editor bertambah → baris yang tadinya merah dicocokkan ulang
      // otomatis (matchFormulaRows bergantung pada katalog).
      if (res.data.created.length) onMaterialsCreated?.(res.data.created);
      if (res.data.created.length) {
        toast.success(`${res.data.created.length} bahan baru masuk master.`);
      }
      for (const f of res.data.failed) toast.error(`${f.name}: ${f.error}`);
    });
  const totalOff = result ? Math.abs(result.totalPct - 100) > 0.01 : false;
  const pyramid = result && pyramidMode ? pyramidFrom(result) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90dvh] sm:max-w-[760px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import formula</DialogTitle>
          <DialogDescription>
            Unggah template yang sudah diisi. Isinya diperiksa dulu — draf baru
            berubah setelah kamu menekan Import.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
          >
            <Upload className="size-4" />
            {pending ? "Membaca…" : raw ? "Ganti berkas" : "Pilih berkas .xlsx"}
          </Button>
          {fileName && (
            <span className="truncate text-[12px] text-[var(--text-muted)]">
              {fileName}
            </span>
          )}
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <a href="/formulas/template" download>
              <Download className="size-4" />
              Unduh template
            </a>
          </Button>
        </div>

        {error && (
          <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[13px]">
            {error}
          </p>
        )}

        {/*
          Bahan yang belum ada di master dibuat dari berkasnya sendiri —
          lengkap dengan family dan odour profile kalau AI mengisinya, supaya
          bahan baru langsung ikut pie aroma dan saran, bukan nama kosong.
        */}
        {missing.length > 0 && onMaterialsCreated && (
          <div className="space-y-2 rounded-lg border border-[var(--warn)] bg-[var(--warn-soft)] p-3">
            <p className="text-[13px] font-medium">
              {missing.length} bahan belum ada di master
            </p>
            <ul className="space-y-0.5 text-[12px]">
              {missing.map((m) => (
                <li key={m.name}>
                  <span className="font-medium">{m.name}</span>{" "}
                  <span className="text-[var(--text-muted)]">
                    {m.odourProfile
                      ? `— ${[m.family, m.odourProfile].filter(Boolean).join(" · ")}${m.impact != null ? ` · impact ${m.impact}` : ""}`
                      : "— nama saja; tidak akan ikut pie aroma sampai odour profile-nya dilengkapi"}
                  </span>
                </li>
              ))}
            </ul>
            <Button type="button" size="sm" onClick={createMissing} disabled={creating}>
              {creating ? "Menambahkan…" : `Tambahkan ${missing.length} bahan ke master`}
            </Button>
          </div>
        )}

        {result && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="baris terbaca" value={String(result.rows.length)} />
              <Stat label="siap masuk" value={String(result.importable)} />
              <Stat
                label="bermasalah"
                value={String(errors)}
                tone={errors ? "danger" : undefined}
              />
              <Stat
                label="total persen"
                value={fmtPct(result.totalPct)}
                tone={totalOff ? "warn" : undefined}
              />
            </div>

            {pyramidMode && (
              <p className="text-[12px] text-[var(--text-muted)]">
                {pyramid
                  ? `Target piramida jadi Top ${fmtPct(pyramid.top)} · Mid ${fmtPct(pyramid.mid)} · Base ${fmtPct(pyramid.base)}, mengikuti isi resep.`
                  : "Totalnya bukan 100%, jadi target piramida lama dipertahankan — editor akan menandai selisihnya."}
              </p>
            )}

            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[560px] text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-left text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    <th className="px-2 py-1.5 font-medium">#</th>
                    {pyramidMode && <th className="px-2 py-1.5 font-medium">Tier</th>}
                    <th className="px-2 py-1.5 font-medium">Di berkas</th>
                    <th className="px-2 py-1.5 font-medium">Jadi</th>
                    <th className="px-2 py-1.5 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => {
                    const okRow = isImportable(r);
                    const warn = r.issues.some((i) => i.level === "warn");
                    return (
                      <tr
                        key={r.row}
                        className={cn(
                          "border-b border-[var(--border)] align-top last:border-0",
                          !okRow && "bg-[var(--danger-soft)]/50",
                        )}
                      >
                        <td className="px-2 py-1.5 text-[var(--text-subtle)]">{r.row}</td>
                        {pyramidMode && (
                          <td className="px-2 py-1.5">
                            {r.tier !== "all" && TIER_META[r.tier].label}
                          </td>
                        )}
                        <td className="px-2 py-1.5">{r.rawName || "—"}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-start gap-1.5">
                            {okRow ? (
                              warn ? (
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--warn)]" />
                              ) : (
                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--ok)]" />
                              )
                            ) : (
                              <XCircle className="mt-0.5 size-3.5 shrink-0 text-[var(--danger)]" />
                            )}
                            <div>
                              {r.match && <p className="font-medium">{r.match.name}</p>}
                              {r.dilutionPct < 100 && r.solvent && (
                                <p className="text-[var(--text-muted)]">
                                  {r.dilutionPct}% dalam {r.solvent.name}
                                </p>
                              )}
                              {r.issues.map((i, k) => (
                                <p
                                  key={k}
                                  className={
                                    i.level === "error"
                                      ? "text-[var(--danger)]"
                                      : "text-[var(--text-muted)]"
                                  }
                                >
                                  {i.message}
                                </p>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="numeric px-2 py-1.5 text-right">
                          {r.pct == null ? "—" : fmtPct(r.pct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {errors > 0 && (
              <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                Baris merah tidak ikut masuk. Betulkan di berkasnya lalu unggah
                ulang — atau import yang sudah cocok dulu, dan tambahkan
                sisanya dari editor.
              </p>
            )}
          </>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-[12px] text-[var(--text-subtle)]">
            {currentLineCount > 0
              ? `Isi draf sekarang (${currentLineCount} baris) akan diganti. Bisa dibatalkan dengan Undo.`
              : "Draf masih kosong."}
          </p>
          <Button
            type="button"
            disabled={!result || result.importable === 0}
            onClick={() => {
              if (!result) return;
              onImport(toLines(result, newId), pyramid);
              reset();
              onOpenChange(false);
            }}
          >
            Import {result ? `${result.importable} bahan` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "danger";
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
      <p
        className={cn(
          "numeric text-[16px] font-semibold",
          tone === "danger" && "text-[var(--danger)]",
          tone === "warn" && "text-[var(--warn)]",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
