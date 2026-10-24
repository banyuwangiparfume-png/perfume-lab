"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileUp, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { CreatedMaterial } from "@/app/actions/materials";
import { saveDraft, saveVersion } from "@/app/actions/versions";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import { Notice } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyze } from "@/lib/calc/analyze";
import { fmtGram, fmtPct } from "@/lib/calc/format";
import type { Warning } from "@/lib/calc/rules";
import type {
  FormulaContext,
  Line,
  Tier,
  Version,
} from "@/lib/calc/types";
import type { EditorData } from "@/lib/data/loadEditorData";
import type { MaterialMeta } from "@/lib/data/loadEditorData";
import { PYRAMID_TIERS, TIER_META, parseDecimal } from "@/lib/tiers";
import { targetOf, tierSummary, useEditorStore } from "@/stores/editorStore";
import { ImportFormulaDialog } from "./ImportFormulaDialog";
import { MaterialPicker, type PickResult } from "./MaterialPicker";
import type { ImportCatalog } from "@/lib/import/formulaImport";
import { PyramidInput } from "./PyramidInput";
import { TierCard, type LineView } from "./TierCard";
import { dominantFacet } from "@/lib/calc/aroma";

const AUTOSAVE_MS = 2000;
const ANALYZE_DEBOUNCE_MS = 150;
const ONLY_STOCK_KEY = "pn:saran-hanya-stok";

const newId = () => `line-${Math.random().toString(36).slice(2, 10)}`;

export type FormulaEditorProps = {
  formulaId: string;
  formulaName: string;
  versionId: string;
  pyramidMode: boolean;
  initial: {
    lines: Line[];
    pyramid: { top: number; mid: number; base: number } | null;
    batchG: number;
    priceTierOverride: number | null;
  };
  data: EditorData;
  meta: Record<string, MaterialMeta>;
  savedVersionCount: number;
  /** nomor versi tersimpan terakhir; 0 kalau belum ada */
  latestVersionNo: number;
};

export function FormulaEditor(props: FormulaEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const store = useEditorStore();
  const [pickerTier, setPickerTier] = useState<Tier | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [batchInput, setBatchInput] = useState(String(props.initial.batchG));

  // ---- muat sekali ----
  // Mengisi store adalah efek samping; melakukannya saat render membuat
  // React merender dengan state yang berubah di tengah jalan.
  useEffect(() => {
    if (useEditorStore.getState().versionId === props.versionId) return;
    useEditorStore.setState({
      versionId: props.versionId,
      formulaId: props.formulaId,
      pyramidMode: props.pyramidMode,
      lines: props.initial.lines,
      pyramid: props.initial.pyramid,
      batchG: props.initial.batchG,
      priceTierOverride: props.initial.priceTierOverride,
      dirty: false,
      savedAt: Date.now(),
      past: [],
      highlighted: [],
    });
  }, [props]);

  const ready = store.versionId === props.versionId;

  // Bahan yang baru dibuat dari picker. Ditahan di sini supaya baris yang
  // memakainya langsung terhitung, tanpa menunggu muat ulang data server —
  // dan tetap aman setelah muat ulang itu datang, karena id-nya sama.
  const [created, setCreated] = useState<CreatedMaterial[]>([]);
  const allMaterials = useMemo(() => {
    const known = new Set(props.data.materials.map((m) => m.id));
    return [
      ...props.data.materials,
      ...created.filter((c) => !known.has(c.id)).map((c) => c.material),
    ];
  }, [props.data.materials, created]);

  const materialMap = useMemo(
    () => new Map(allMaterials.map((m) => [m.id, m] as const)),
    [allMaterials],
  );
  const metaMap = useMemo(
    () =>
      new Map([
        ...Object.entries(props.meta),
        ...created.map((c) => [c.id, c.meta] as const),
      ]),
    [props.meta, created],
  );
  // Katalog untuk import: semua yang bisa jadi baris formula, dengan nama
  // lain dan CAS supaya nama yang ditulis AI bisa dicocokkan.
  const importCatalog: ImportCatalog = useMemo(
    () => ({
      entries: [
        ...allMaterials.map((m) => ({
          id: m.id,
          kind: "raw_material" as const,
          name: m.name,
          synonym: metaMap.get(m.id)?.synonym ?? null,
          cas: metaMap.get(m.id)?.casNumber ?? null,
          tierHint: m.noteTierHint,
        })),
        // Accord yang tidak bisa dipakai (memakai formula ini sendiri) tidak
        // ditawarkan — sama dengan picker.
        ...props.data.accords
          .filter((a) => !a.disabledReason)
          .map((a) => ({ id: a.versionId, kind: "accord" as const, name: a.label })),
        ...props.data.fos.map((f) => ({ id: f.id, kind: "fo" as const, name: f.name })),
      ],
      solvents: props.data.solvents,
    }),
    [allMaterials, metaMap, props.data.accords, props.data.fos, props.data.solvents],
  );

  const stockSet = useMemo(
    () => new Set(props.data.stock),
    [props.data.stock],
  );

  // ---- konteks kalkulasi: dibangun dari state, bukan dari server ----
  const context: FormulaContext = useMemo(
    () => ({
      version: {
        id: props.versionId,
        name: props.formulaName,
        batchG: store.batchG,
        pyramid: props.pyramidMode ? store.pyramid : null,
        priceTierOverride: store.priceTierOverride,
        lines: store.lines,
      },
      materials: materialMap,
      accords: new Map(
        props.data.accords.map((a) => [
          a.versionId,
          {
            id: a.versionId,
            name: a.label,
            batchG: 100,
            pyramid: null,
            priceTierOverride: null,
            lines: a.lines,
          } satisfies Version,
        ]),
      ),
      fos: new Map(
        props.data.fos.map((f) => [
          f.id,
          { id: f.id, name: f.name, pricePerGram: f.pricePerGram },
        ]),
      ),
      bridgeRules: props.data.bridgeRules,
      stock: stockSet,
      settings: props.data.settings,
    }),
    [
      store.batchG,
      store.pyramid,
      store.priceTierOverride,
      store.lines,
      materialMap,
      stockSet,
      props,
    ],
  );

  // Analisa di-debounce: mengetik persen memicu banyak perubahan beruntun, dan
  // menghitung bridger tiap ketikan membuat input terasa berat.
  const [analysis, setAnalysis] = useState(() =>
    analyze(context, { skipBridges: true }),
  );

  // Filter "hanya dari stok" untuk saran. Diingat per browser — pilihan
  // kebiasaan, bukan data formula. Dibaca setelah mount supaya render server
  // dan klien sama.
  const [onlyStock, setOnlyStock] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron sekali dari localStorage
      setOnlyStock(localStorage.getItem(ONLY_STOCK_KEY) === "1");
    } catch {}
  }, []);
  const changeOnlyStock = (value: boolean) => {
    setOnlyStock(value);
    try {
      localStorage.setItem(ONLY_STOCK_KEY, value ? "1" : "0");
    } catch {}
  };

  useEffect(() => {
    const t = setTimeout(
      () => setAnalysis(analyze(context, { onlyStockBridges: onlyStock })),
      ANALYZE_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [context, onlyStock]);

  // ---- autosave draf ----
  useEffect(() => {
    if (!store.dirty) return;
    const t = setTimeout(() => {
      void saveDraft(props.versionId, {
        batch_g: store.batchG,
        top_pct: store.pyramid?.top ?? null,
        mid_pct: store.pyramid?.mid ?? null,
        base_pct: store.pyramid?.base ?? null,
        price_tier_override: store.priceTierOverride,
        lines: store.lines.map((l) => ({
          tier: l.tier,
          line_type: l.kind,
          raw_material_id: l.kind === "raw_material" ? l.refId : null,
          accord_version_id: l.kind === "accord" ? l.refId : null,
          fo_id: l.kind === "fo" ? l.refId : null,
          pct: l.pct,
          is_locked: l.locked,
          user_dilution_pct: l.userDilutionPct,
          user_solvent_id: l.userSolventId,
        })),
      }).then((r) => {
        if (r.ok) useEditorStore.getState().markSaved();
        else setError(r.error);
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [
    store.dirty,
    store.lines,
    store.batchG,
    store.pyramid,
    store.priceTierOverride,
    props.versionId,
  ]);

  // Sorotan kuning pada angka yang berubah otomatis — supaya user melihat
  // bahwa mengetik satu baris menggeser baris lain.
  useEffect(() => {
    if (!store.highlighted.length) return;
    const t = setTimeout(() => useEditorStore.getState().clearHighlight(), 600);
    return () => clearTimeout(t);
  }, [store.highlighted]);

  // Undo: pembagian otomatis bisa mengubah banyak angka sekaligus, jadi ini
  // bukan kemewahan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        useEditorStore.getState().undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- turunan untuk tampilan ----
  const perLine = useMemo(() => {
    const out = new Map<
      string,
      { productPct: number; strengthPct: number | null; cost: number | null }
    >();
    for (const item of analysis.items) {
      const prev = out.get(item.sourceLineId) ?? {
        productPct: 0,
        strengthPct: null,
        cost: null,
      };
      prev.productPct += item.productPct;
      out.set(item.sourceLineId, prev);
    }
    // Kekuatan dan biaya sebuah bahan dibagi balik ke baris-baris yang
    // menyumbangkannya, proporsional terhadap porsinya. Satu bahan bisa datang
    // dari dua baris sekaligus — langsung dan lewat accord.
    for (const row of analysis.strength.rows) {
      const owners = analysis.items.filter((i) => i.refId === row.refId);
      const total = owners.reduce((a, i) => a + i.productPct, 0) || 1;
      for (const o of owners) {
        const cur = out.get(o.sourceLineId);
        if (!cur || row.strengthPct == null) continue;
        cur.strengthPct =
          (cur.strengthPct ?? 0) + (row.strengthPct * o.productPct) / total;
      }
    }
    for (const r of analysis.cost.rows) {
      const owners = analysis.items.filter((i) => i.refId === r.refId);
      const total = owners.reduce((a, i) => a + i.productPct, 0) || 1;
      for (const o of owners) {
        const cur = out.get(o.sourceLineId);
        if (!cur || r.cost == null) continue;
        cur.cost = (cur.cost ?? 0) + (r.cost * o.productPct) / total;
      }
    }
    return out;
  }, [analysis]);

  const dominantRefs = useMemo(
    () =>
      new Set(
        analysis.warnings
          .filter((w) => w.code === "R5")
          .flatMap((w) => w.lineIds ?? []),
      ),
    [analysis.warnings],
  );

  // Label facet dipakai dari tabel `facets`, bukan dari kunci mentahnya:
  // "Musk / Animalic" lebih terbaca daripada "musk", dan labelnya hidup di satu
  // tempat bersama pie aroma.
  const facetLabelOf = new Map(
    props.data.facets.map((f) => [f.key, f.label] as const),
  );

  const facetLabel = (v: Record<string, number>) => {
    const key = dominantFacet(v);
    if (!key) return null;
    return { key, label: facetLabelOf.get(key) ?? key };
  };

  const sumFacets = (lines: { refId: string }[]) => {
    const out: Record<string, number> = {};
    for (const l of lines) {
      const m = materialMap.get(l.refId);
      if (!m) continue;
      for (const [f, w] of Object.entries(m.facets)) {
        out[f] = (out[f] ?? 0) + w;
      }
    }
    return out;
  };

  const viewFor = (line: Line): LineView => {
    const material =
      line.kind === "raw_material" ? (materialMap.get(line.refId) ?? null) : null;
    const accord = props.data.accords.find((a) => a.versionId === line.refId);
    const fo = props.data.fos.find((f) => f.id === line.refId);
    const calc = perLine.get(line.id);
    return {
      line,
      label:
        material?.name ??
        accord?.label ??
        fo?.name ??
        "(komponen tidak ditemukan)",
      material,
      accordSize: accord?.materialCount,
      inStock: stockSet.has(line.refId),
      // Accord tidak punya facet sendiri — arahnya dijumlahkan dari isinya.
      // FO sengaja tidak diberi label: isinya tidak diketahui, dan menebaknya
      // akan membuat label itu berbohong.
      facet: facetLabel(
        material
          ? material.facets
          : accord
            ? sumFacets(accord.lines)
            : {},
      ),
      productPct: calc?.productPct ?? 0,
      strengthPct: calc?.strengthPct ?? null,
      cost: calc?.cost ?? null,
      dominant: dominantRefs.has(line.id),
    };
  };

  const tiers: Tier[] = props.pyramidMode ? PYRAMID_TIERS : ["all"];
  const usedIds = new Set(store.lines.map((l) => l.refId));

  const pyramidTotal = store.pyramid
    ? store.pyramid.top + store.pyramid.mid + store.pyramid.base
    : 100;
  const pyramidOk = Math.abs(pyramidTotal - 100) < 0.001;

  const addPick = (tier: Tier) => (pick: PickResult) => {
    const material =
      pick.kind === "raw_material" ? materialMap.get(pick.refId) : null;
    useEditorStore.getState().addLine(tier, {
      id: newId(),
      kind: pick.kind,
      refId: pick.refId,
      // Bahan yang sudah encer dari supplier tidak otomatis diencerkan lagi —
      // dilusi supplier beda urusan dengan dilusi yang user buat sendiri.
      userDilutionPct: 100,
      userSolventId: null,
      sortOrder: store.lines.length,
    } as Omit<Line, "tier" | "pct" | "locked">);
    if (material?.noteTierHint && material.noteTierHint !== tier) {
      toast.info(
        `${material.name} biasanya ${TIER_META[material.noteTierHint].label.toLowerCase()} — bukan larangan, tier itu label penempatan.`,
      );
    }
  };

  const handleWarning = (w: Warning) => {
    if (!w.action) return;
    const state = useEditorStore.getState();
    if (w.action.kind === "normalize_tier") state.normalizeTier(w.action.tier);
    else if (w.action.kind === "retarget_tier")
      state.retargetTier(w.action.tier, w.action.target);
    else if (w.action.kind === "adjust_solvent")
      applySolvent(w.action.solventId, w.action.newDirectPct);
    else if (w.action.kind === "move_line")
      state.moveLine(w.action.lineId, w.action.tier);
  };

  const applySolvent = (solventId: string, newDirectPct: number) => {
    const line = store.lines.find(
      (l) => l.kind === "raw_material" && l.refId === solventId,
    );
    if (!line) return;
    useEditorStore.getState().editPct(line.id, newDirectPct);
  };

  const addBridge = (materialId: string, tier: Tier, dose: number) => {
    const state = useEditorStore.getState();
    state.addLine(tier, {
      id: newId(),
      kind: "raw_material",
      refId: materialId,
      userDilutionPct: 100,
      userSolventId: null,
    } as Omit<Line, "tier" | "pct" | "locked">);
    // Dosis awal dipatok supaya tidak langsung ikut dibagi rata dan hilang.
    const added = useEditorStore
      .getState()
      .lines.filter((l) => l.refId === materialId && l.tier === tier)
      .at(-1);
    if (added) useEditorStore.getState().editPct(added.id, dose);
  };

  const doSaveVersion = () => {
    setError(null);
    startTransition(async () => {
      // Draf disimpan dulu, supaya versi yang dibekukan benar-benar berisi apa
      // yang terlihat di layar.
      const draft = await saveDraft(props.versionId, {
        batch_g: store.batchG,
        top_pct: store.pyramid?.top ?? null,
        mid_pct: store.pyramid?.mid ?? null,
        base_pct: store.pyramid?.base ?? null,
        price_tier_override: store.priceTierOverride,
        lines: store.lines.map((l) => ({
          tier: l.tier,
          line_type: l.kind,
          raw_material_id: l.kind === "raw_material" ? l.refId : null,
          accord_version_id: l.kind === "accord" ? l.refId : null,
          fo_id: l.kind === "fo" ? l.refId : null,
          pct: l.pct,
          is_locked: l.locked,
          user_dilution_pct: l.userDilutionPct,
          user_solvent_id: l.userSolventId,
        })),
      });
      if (!draft.ok) {
        setError(draft.error);
        return;
      }
      useEditorStore.getState().markSaved();

      const result = await saveVersion(props.formulaId, changeNote);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`v${result.data.versionNo} tersimpan.`);
      setSaveOpen(false);
      setChangeNote("");
      router.push(`/formulas/${props.formulaId}?v=${result.data.versionId}`);
    });
  };

  const blocked = analysis.warnings.some(
    (w) => w.code === "R2" || w.code === "R12",
  );

  if (!ready) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        <div className="h-64 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---------------- header ---------------- */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
        <div className="w-[120px]">
          <Label htmlFor="batch" className="mb-1.5 text-[12px]">
            Ukuran batch (g)
          </Label>
          <Input
            id="batch"
            inputMode="decimal"
            className="numeric h-8"
            value={batchInput}
            onChange={(e) => {
              setBatchInput(e.target.value);
              const n = parseDecimal(e.target.value);
              if (n != null && n > 0) useEditorStore.getState().setBatchG(n);
            }}
          />
        </div>

        <div className="rounded-md bg-[var(--surface-muted)] px-2.5 py-1.5 text-[12px]">
          <span className="text-[var(--text-muted)]">Harga</span>{" "}
          <strong>tier {analysis.cost.tier} g</strong>
        </div>

        {props.pyramidMode && store.pyramid && (
          <div className="flex items-center gap-2 text-[12px]">
            {PYRAMID_TIERS.map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: TIER_META[t].color }}
                />
                {TIER_META[t].label} {fmtPct(targetOf(store.pyramid, t))}
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-subtle)]">
            {store.dirty
              ? "menyimpan draf…"
              : store.savedAt
                ? `draf tersimpan ${new Date(store.savedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setImportOpen(true)}
            title="Isi draf dari template Excel — misalnya hasil isian AI"
          >
            <FileUp className="size-4" />
            Import
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!store.past.length}
            onClick={() => useEditorStore.getState().undo()}
          >
            <Undo2 className="size-4" />
            Undo
          </Button>
          <Button
            type="button"
            onClick={() => setSaveOpen(true)}
            disabled={blocked}
            title={
              blocked
                ? "Perbaiki dulu peringatan merah di panel analisa"
                : undefined
            }
          >
            <Save className="size-4" />
            Simpan versi
          </Button>
        </div>
      </div>

      {props.pyramidMode && !pyramidOk && (
        <Notice tone="danger">
          Piramida {fmtPct(pyramidTotal)} — harus tepat 100% sebelum bisa
          disimpan sebagai versi. Sesuaikan salah satu tier.
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}

      {/*
        ---------------- dua kolom ----------------
        Dulu baru jadi dua kolom di xl (1280px). Laptop dengan skala Windows
        150% punya lebar 1280 dikurangi scrollbar — selisih belasan piksel itu
        membuat panel analisa jatuh ke bawah piramida, dan setiap ubah persen
        harus discroll untuk melihat efeknya. Sekarang mulai dari lg (1024px).
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {props.pyramidMode && store.pyramid && (
            <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <summary className="cursor-pointer text-[13px] font-medium">
                Ubah target piramida
              </summary>
              <div className="mt-3">
                <PyramidInput
                  value={store.pyramid}
                  batchG={store.batchG}
                  onChange={(p) => useEditorStore.getState().setPyramid(p)}
                />
              </div>
            </details>
          )}

          {tiers.map((tier) => {
            const s = tierSummary(store.lines, store.pyramid, tier);
            const views = store.lines
              .filter((l) => l.tier === tier)
              .map(viewFor);
            return (
              <TierCard
                key={tier}
                tier={tier}
                target={s.target}
                filled={s.filled}
                diff={s.diff}
                ok={s.ok}
                batchG={store.batchG}
                views={views}
                solvents={props.data.solvents}
                highlighted={store.highlighted}
                pyramidMode={props.pyramidMode}
                onAdd={() => setPickerTier(tier)}
                onEditPct={(id, pct) => useEditorStore.getState().editPct(id, pct)}
                onToggleLock={(id) => useEditorStore.getState().toggleLock(id)}
                onRemove={(id) => useEditorStore.getState().removeLine(id)}
                onDilution={(id, pct, solventId) =>
                  useEditorStore.getState().setDilution(id, pct, solventId)
                }
                onMove={(id, t) => useEditorStore.getState().moveLine(id, t)}
                onNormalize={() => useEditorStore.getState().normalizeTier(tier)}
                onRetarget={(t) => useEditorStore.getState().retargetTier(tier, t)}
                onSpread={() => useEditorStore.getState().spreadTier(tier)}
              />
            );
          })}

          <p className="text-[12px] text-[var(--text-muted)]">
            Total terisi{" "}
            <strong className="numeric text-[var(--text)]">
              {fmtPct(store.lines.reduce((a, l) => a + l.pct, 0))}
            </strong>{" "}
            · {fmtGram(store.batchG)} g per batch
          </p>
        </div>

        {/*
          Panel menempel di layar dan punya scroll sendiri. Tanpa batas tinggi,
          tab yang panjang (Bridger, Per fase) membuat ujung bawahnya tidak
          pernah bisa dicapai selama dia menempel — dan halaman harus discroll
          jauh melewati piramida.
        */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain">
            <AnalysisPanel
              analysis={analysis}
              context={context}
              onWarningAction={handleWarning}
              onAddBridge={addBridge}
              onlyStock={onlyStock}
              onOnlyStockChange={changeOnlyStock}
              onReduceLine={(lineId, pct) => {
                // Lewat aksi store yang sama dengan mengetik persen atau
                // menghapus baris — jadi pembagian ulangnya persis seperti
                // pratinjau, dan bisa di-Undo.
                const st = useEditorStore.getState();
                if (pct <= 0) st.removeLine(lineId);
                else st.editPct(lineId, pct);
              }}
              onSetPyramid={(p) => useEditorStore.getState().setPyramid(p)}
            />
          </div>
        </aside>
      </div>

      <ImportFormulaDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        catalog={importCatalog}
        pyramidMode={props.pyramidMode}
        currentLineCount={store.lines.length}
        newId={newId}
        onImport={(lines, pyramid) => {
          useEditorStore.getState().importLines(lines, pyramid);
          toast.success(`${lines.length} bahan masuk ke draf.`);
        }}
      />

      {pickerTier && (
        <MaterialPicker
          open
          onOpenChange={(o) => !o && setPickerTier(null)}
          tier={pickerTier}
          materials={allMaterials}
          meta={metaMap}
          accords={props.data.accords}
          fos={props.data.fos}
          usedIds={usedIds}
          stock={stockSet}
          settings={props.data.settings}
          batchG={store.batchG}
          priceTierOverride={store.priceTierOverride}
          onPick={addPick(pickerTier)}
          onCreated={(c) => {
            setCreated((list) => [...list, c]);
            toast.success(`${c.material.name} masuk master bahan.`);
            // Halaman Bahan dan picker di formula lain ikut tahu.
            router.refresh();
          }}
        />
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Simpan sebagai versi</DialogTitle>
            <DialogDescription>
              Ini akan jadi <strong className="font-medium">v{props.latestVersionNo + 1}</strong>
              {props.latestVersionNo > 0 &&
                ` — ${props.latestVersionNo === 1 ? "v1" : `v1–v${props.latestVersionNo}`} tetap tercatat dan bisa dibandingkan`}
              . Versi tersimpan dibekukan: dia yang nanti dirujuk catatan
              penciuman, lembar timbang, dan formula lain yang memakainya.
            </DialogDescription>
          </DialogHeader>

          {props.savedVersionCount >= 1 && (
            <div>
              <Label htmlFor="note" className="mb-1.5">
                Apa yang berubah? <span className="text-[var(--danger)]">*</span>
              </Label>
              <Textarea
                id="note"
                rows={3}
                autoFocus
                value={changeNote}
                placeholder='misal: "Indole turun ke 3% — naphthyl-nya terlalu maju di menit 30"'
                onChange={(e) => setChangeNote(e.target.value)}
              />
              <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                Di sini letak pelajarannya, bukan di angkanya.
              </p>
            </div>
          )}

          {error && <Notice tone="danger">{error}</Notice>}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Batal
            </Button>
            <Button onClick={doSaveVersion} disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan versi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { Link };
