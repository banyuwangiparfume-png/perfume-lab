"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Notice } from "@/components/shared/primitives";
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
import {
  createVersion,
  saveLines,
  updateVersionMeta,
} from "@/app/actions/versions";
import { analyze } from "@/lib/legacy/calc/analyze";
import { dilutionHint, fmtGram, fmtIdr, fmtPct } from "@/lib/calc/format";
import { round } from "@/lib/legacy/calc/scale";
import type { LineType } from "@/lib/legacy/calc/types";
import { VERSION_STATUSES } from "@/lib/constants";
import type { LineInput } from "@/app/actions/versions";
import type { VersionStatusEnum } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { ComponentPicker } from "./ComponentPicker";
import { DilutionSelect } from "./DilutionSelect";
import {
  labelFor,
  newLine,
  parseWeight,
  toCalcLines,
  type EditorLine,
  type PickerData,
} from "./editor-types";
import { LineTypeToggle } from "./LineTypeToggle";
import { RulesPanel, type BridgerCandidate } from "./RulesPanel";
import { ScaleDialog } from "./ScaleDialog";
import { StrengthChart } from "./StrengthChart";

export type LineEditorProps = {
  formulaId: string;
  versionId: string;
  versionNo: number;
  status: VersionStatusEnum;
  batchSizeG: number;
  label: string | null;
  changeNote: string | null;
  initialLines: EditorLine[];
  data: PickerData;
  bridgerCandidates: BridgerCandidate[];
};

export function LineEditor(props: LineEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [lines, setLines] = useState<EditorLine[]>(
    props.initialLines.length ? props.initialLines : [newLine()],
  );
  const [label, setLabel] = useState(props.label ?? "");
  const [changeNote, setChangeNote] = useState(props.changeNote ?? "");
  const [batchSize, setBatchSize] = useState(String(props.batchSizeG));
  const [status, setStatus] = useState<VersionStatusEnum>(props.status);
  const [error, setError] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);

  const frozen = props.status === "evaluated" || props.status === "locked";

  const update = (key: string, patch: Partial<EditorLine>) =>
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );

  const addLine = () => setLines((prev) => [...prev, newLine()]);

  const removeLine = (key: string) =>
    setLines((prev) => {
      const next = prev.filter((l) => l.key !== key);
      return next.length ? next : [newLine()];
    });

  const move = (from: number, to: number) =>
    setLines((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const changeType = (line: EditorLine, nextType: LineType) => {
    if (nextType === line.lineType) return;
    // Mengubah jenis mengosongkan komponen yang sudah dipilih — konfirmasi
    // dulu supaya pilihan yang susah dicari tidak hilang karena salah klik.
    if (
      line.refId &&
      !window.confirm(
        "Ganti jenis baris ini? Komponen yang sudah dipilih akan dikosongkan.",
      )
    ) {
      return;
    }
    update(line.key, { lineType: nextType, refId: null, solvent: null });
  };

  // --- kalkulasi live: rumus yang sama persis dengan yang dipakai server ---
  const calcLines = useMemo(
    () => toCalcLines(lines, props.data),
    [lines, props.data],
  );
  const analysis = useMemo(() => analyze(calcLines), [calcLines]);

  const strengthByKey = useMemo(
    () =>
      new Map(
        analysis.display.rows.map((r) => [r.id, r] as const),
      ),
    [analysis],
  );

  const usedIds = useMemo(
    () => new Set(lines.map((l) => l.refId).filter((x): x is string => !!x)),
    [lines],
  );

  // --- validasi ---
  const problems = useMemo(() => {
    const blocking: { key: string; message: string }[] = [];
    const warnings: string[] = [];
    const seen = new Map<string, number>();

    lines.forEach((line, i) => {
      if (!line.refId) {
        blocking.push({
          key: line.key,
          message: `Baris ${i + 1} belum dipilih komponennya.`,
        });
      }
      if (parseWeight(line.weightInput) == null) {
        blocking.push({
          key: line.key,
          message: `Baris ${i + 1} beratnya masih kosong atau 0.`,
        });
      }
      if (line.refId) {
        const previous = seen.get(line.refId);
        if (previous != null) {
          warnings.push(
            `${labelFor(line, props.data) ?? "Komponen ini"} sudah ada di baris ${previous + 1} — gabungkan?`,
          );
        } else {
          seen.set(line.refId, i);
        }
      }
      if (line.dilutionPct < 100 && !line.solvent) {
        warnings.push(
          `Baris ${i + 1} diencerkan tapi pelarutnya belum diisi. Tanpa itu formulanya tidak bisa dibuat ulang persis.`,
        );
      }
    });

    return { blocking, warnings };
  }, [lines, props.data]);

  const blockingKeys = new Set(problems.blocking.map((p) => p.key));
  const needsChangeNote = props.versionNo > 1 && !changeNote.trim();

  const payload = (): LineInput[] =>
    lines.map((line, i) => ({
      line_type: line.lineType,
      raw_material_id: line.lineType === "raw_material" ? line.refId : null,
      fo_id: line.lineType === "fo" ? line.refId : null,
      sub_formula_version_id:
        line.lineType === "sub_formula" ? line.refId : null,
      weight_g: parseWeight(line.weightInput)!,
      dilution_pct: line.dilutionPct,
      solvent: line.solvent,
      note: line.note.trim() || null,
      sort_order: i,
    }));

  const guard = (): boolean => {
    if (problems.blocking.length) {
      setError(problems.blocking[0].message);
      return false;
    }
    if (needsChangeNote) {
      setError(
        "Catatan perubahan ini yang bikin kamu belajar. Tulis singkat saja.",
      );
      return false;
    }
    setError(null);
    return true;
  };

  const saveRevision = () => {
    if (!guard()) return;
    startTransition(async () => {
      const meta = await updateVersionMeta(props.versionId, {
        label: label.trim() || null,
        ...(props.versionNo > 1 ? { change_note: changeNote.trim() } : {}),
        batch_size_g: Number(batchSize.replace(",", ".")) || props.batchSizeG,
        status,
      });
      if (!meta.ok) {
        setError(meta.error ?? "Gagal menyimpan data versi.");
        return;
      }
      const result = await saveLines(props.versionId, payload());
      if (!result.ok) {
        setError(result.error ?? "Gagal menyimpan baris.");
        return;
      }
      toast.success("Versi tersimpan.");
      router.push(`/formulas/${props.formulaId}?v=${props.versionId}`);
    });
  };

  const saveAsNewVersion = () => {
    if (problems.blocking.length) {
      setError(problems.blocking[0].message);
      return;
    }
    if (!changeNote.trim()) {
      setError(
        "Versi baru wajib punya catatan perubahan — tulis apa yang berbeda dari versi sebelumnya.",
      );
      return;
    }
    setError(null);

    startTransition(async () => {
      const created = await createVersion(props.formulaId, {
        label: label.trim() || null,
        change_note: changeNote.trim(),
        parent_version_id: props.versionId,
        batch_size_g: Number(batchSize.replace(",", ".")) || props.batchSizeG,
      });
      if (!created.ok) {
        setError(created.error);
        return;
      }
      const result = await saveLines(
        created.data.versionId,
        payload(),
      );
      if (!result.ok) {
        setError(
          `Versi barunya terbuat, tapi barisnya gagal tersimpan: ${result.error ?? "alasan tidak diketahui"}`,
        );
        return;
      }
      toast.success("Versi baru tersimpan.");
      router.push(
        `/formulas/${props.formulaId}?v=${created.data.versionId}`,
      );
    });
  };

  const applyScale = (factor: number) =>
    setLines((prev) =>
      prev.map((l) => {
        const w = parseWeight(l.weightInput);
        return w == null
          ? l
          : { ...l, weightInput: String(round(w * factor, 3)) };
      }),
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ------------------------------- kolom kiri: baris ------------------- */}
      <div className="space-y-4">
        {frozen && (
          <Notice tone="warn">
            Versi v{props.versionNo} sudah dinilai, jadi barisnya tidak bisa
            ditimpa. Ubah sesukamu di sini, lalu simpan sebagai{" "}
            <strong>versi baru</strong> — catatan penciuman yang lama tetap
            nyambung ke formula yang benar.
          </Notice>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="version-label" className="mb-1.5">
              Label versi
            </Label>
            <Input
              id="version-label"
              value={label}
              placeholder={`v${props.versionNo} — misal "Ambroxan turun ke 2%"`}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="w-[120px]">
            <Label htmlFor="batch-size" className="mb-1.5">
              Target batch (g)
            </Label>
            <Input
              id="batch-size"
              inputMode="decimal"
              className="numeric"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
            />
          </div>
          <div className="w-[170px]">
            <Label className="mb-1.5">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as VersionStatusEnum)}
              disabled={frozen}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERSION_STATUSES.filter(
                  (s) => s.value !== "evaluated" || status === "evaluated",
                ).map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScaleDialog
            rows={lines
              .filter((l) => parseWeight(l.weightInput) != null)
              .map((l) => ({
                key: l.key,
                label: labelFor(l, props.data) ?? "(belum dipilih)",
                weightG: parseWeight(l.weightInput)!,
              }))}
            onApply={applyScale}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                <th className="w-8 px-2 py-2" />
                <th className="w-[140px] px-2 py-2 text-left font-medium">
                  Jenis
                </th>
                <th className="px-2 py-2 text-left font-medium">Komponen</th>
                <th className="w-[120px] px-2 py-2 text-right font-medium">
                  Timbang (g)
                </th>
                <th className="w-[120px] px-2 py-2 text-left font-medium">
                  Dilusi
                </th>
                <th className="w-[150px] px-2 py-2 text-left font-medium">
                  Catatan
                </th>
                <th className="w-[92px] px-2 py-2 text-right font-medium">
                  Kekuatan
                </th>
                <th className="w-9 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const row = strengthByKey.get(line.key);
                const weight = parseWeight(line.weightInput);
                const invalid = blockingKeys.has(line.key);
                return (
                  <tr
                    key={line.key}
                    draggable
                    onDragStart={() => {
                      dragFrom.current = i;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragFrom.current != null)
                        move(dragFrom.current, i);
                      dragFrom.current = null;
                    }}
                    className={cn(
                      "border-b border-[var(--border)] align-top",
                      line.lineType === "fo" && "bg-[var(--row-fo)]",
                      line.lineType === "sub_formula" &&
                        "bg-[var(--row-subformula)]",
                      invalid && "bg-[var(--danger-soft)]",
                    )}
                  >
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        aria-label={`Urutkan baris ${i + 1}. Pakai panah atas dan bawah untuk memindahkan.`}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            move(i, i - 1);
                          }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            move(i, i + 1);
                          }
                        }}
                        className="cursor-grab text-[var(--text-subtle)] hover:text-[var(--text)]"
                      >
                        <GripVertical className="size-4" />
                      </button>
                    </td>

                    <td className="px-2 py-2">
                      <LineTypeToggle
                        value={line.lineType}
                        onChange={(next) => changeType(line, next)}
                      />
                    </td>

                    <td className="px-2 py-2">
                      <ComponentPicker
                        lineType={line.lineType}
                        value={line.refId}
                        data={props.data}
                        usedIds={usedIds}
                        invalid={invalid && !line.refId}
                        onSelect={(id) => {
                          // Dilusi default bahan dipakai sebagai nilai awal —
                          // itu bentuk yang biasanya ada di rak.
                          if (line.lineType === "raw_material") {
                            const m = props.data.materials.find(
                              (x) => x.id === id,
                            );
                            update(line.key, {
                              refId: id,
                              dilutionPct:
                                line.dilutionPct === 100 && m
                                  ? Number(m.default_dilution_pct)
                                  : line.dilutionPct,
                              solvent:
                                line.solvent ?? m?.default_solvent ?? null,
                            });
                          } else {
                            update(line.key, { refId: id });
                          }
                        }}
                      />
                    </td>

                    <td className="px-2 py-2">
                      <Input
                        inputMode="decimal"
                        aria-label={`Berat timbang baris ${i + 1}`}
                        className="numeric"
                        value={line.weightInput}
                        placeholder="0,000"
                        onChange={(e) =>
                          update(line.key, { weightInput: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (i === lines.length - 1) addLine();
                          }
                          if (e.key === "Escape") e.currentTarget.blur();
                        }}
                      />
                      {weight != null && line.dilutionPct < 100 && (
                        <p className="mt-1 text-[12px] font-medium text-[var(--brand)]">
                          {dilutionHint(weight, line.dilutionPct)}
                        </p>
                      )}
                    </td>

                    <td className="px-2 py-2">
                      <DilutionSelect
                        value={line.dilutionPct}
                        solvent={line.solvent}
                        onChange={(next) => update(line.key, next)}
                      />
                    </td>

                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Catatan baris ${i + 1}`}
                        value={line.note}
                        onChange={(e) =>
                          update(line.key, { note: e.target.value })
                        }
                      />
                    </td>

                    <td className="numeric px-2 py-2 pt-4 text-[13px]">
                      {row?.strengthPct != null ? (
                        <span className="font-medium">
                          {fmtPct(row.strengthPct)}
                        </span>
                      ) : line.lineType === "fo" ? (
                        <span className="text-[11px] text-[var(--text-subtle)]">
                          tidak dinilai
                        </span>
                      ) : (
                        <span className="text-[var(--text-subtle)]">
                          &mdash;
                        </span>
                      )}
                    </td>

                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Hapus baris ${i + 1}`}
                        onClick={() => removeLine(line.key)}
                      >
                        <Trash2 className="size-4 text-[var(--text-subtle)]" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={addLine}>
            <Plus className="size-4" />
            Tambah bahan
          </Button>
          <span className="text-[13px] text-[var(--text-muted)]">
            Total timbang{" "}
            <strong className="numeric text-[var(--text)]">
              {fmtGram(analysis.display.totals.weighedG)} g
            </strong>
            {analysis.display.totals.costPerGram != null && (
              <>
                {" "}
                &middot; {fmtIdr(analysis.display.totals.costPerGram)}/g
              </>
            )}
          </span>
          <span className="text-[12px] text-[var(--text-subtle)]">
            Enter di kolom berat = baris baru
          </span>
        </div>

        {problems.warnings.length > 0 && (
          <div className="space-y-1.5">
            {problems.warnings.map((w, i) => (
              <Notice key={i} tone="warn">
                {w}
              </Notice>
            ))}
          </div>
        )}

        <div>
          <Label htmlFor="change-note" className="mb-1.5">
            Apa yang diubah dari versi sebelumnya?
            {props.versionNo > 1 && (
              <span className="text-[var(--danger)]"> *</span>
            )}
          </Label>
          <Textarea
            id="change-note"
            value={changeNote}
            rows={2}
            placeholder='misal: "Bacdanol naik 2% — drydown lebih creamy tapi bergamot ketutup"'
            onChange={(e) => setChangeNote(e.target.value)}
            className={cn(needsChangeNote && "border-[var(--warn)]")}
          />
          <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
            Catatan ini bukan metadata — di sini letak pelajarannya. Tiga bulan
            lagi kamu tidak akan ingat kenapa angkanya diubah.
          </p>
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          <Button
            type="button"
            onClick={saveRevision}
            disabled={pending || frozen}
            title={
              frozen
                ? "Versi yang sudah dinilai tidak bisa ditimpa"
                : undefined
            }
          >
            {pending ? "Menyimpan…" : `Simpan revisi v${props.versionNo}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={saveAsNewVersion}
            disabled={pending}
          >
            Simpan sebagai versi baru
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link href={`/formulas/${props.formulaId}?v=${props.versionId}`}>
              Batal
            </Link>
          </Button>
        </div>
      </div>

      {/* --------------------------- kolom kanan: analisa live --------------- */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-[15px] font-semibold">Kalkulasi live</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
            <dt className="text-[var(--text-muted)]">Jumlah komponen</dt>
            <dd className="numeric font-medium">
              {analysis.display.rows.length}
            </dd>
            <dt className="text-[var(--text-muted)]">Setelah dibentangkan</dt>
            <dd className="numeric font-medium">{analysis.expanded.length}</dd>
            <dt className="text-[var(--text-muted)]">Total timbang</dt>
            <dd className="numeric font-medium">
              {fmtGram(analysis.display.totals.weighedG)} g
            </dd>
            <dt className="text-[var(--text-muted)]">Total murni</dt>
            <dd className="numeric font-medium">
              {fmtGram(analysis.display.totals.neatG)} g
            </dd>
            <dt className="text-[var(--text-muted)]">Dinilai dari</dt>
            <dd className="numeric font-medium">
              {fmtPct(analysis.display.strengthBasis)}
            </dd>
          </dl>

          {analysis.display.rows.length > 0 && (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <StrengthChart result={analysis.display} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-[15px] font-semibold">Pemeriksaan</h2>
          <RulesPanel
            findings={analysis.findings}
            bridgerCandidates={props.bridgerCandidates}
          />
        </div>
      </aside>
    </div>
  );
}
