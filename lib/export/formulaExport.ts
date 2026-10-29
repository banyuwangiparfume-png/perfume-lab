import ExcelJS from "exceljs";
import type { Analysis } from "../calc/analyze";
import type { Pyramid } from "../calc/types";
import { TEMPLATE_COLUMNS } from "../import/formulaImport";
import { FACET_LABELS, TIER_META } from "../tiers";
import { formatFacets } from "./stockExport";

/**
 * Ekspor satu versi formula — fragrance maupun accord — ke Excel.
 *
 * Lembar "Formula" sengaja memakai kolom template import di depan (tier,
 * bahan, cas, persen, dilusi_pct, pelarut, catatan): berkas ekspor bisa
 * langsung diimpor balik, ke formula lain atau setelah diedit AI. Kolom
 * sisanya dibaca manusia dan diabaikan import.
 *
 * Tidak menghitung ulang apa pun. Semua angka datang dari analyze() — jalur
 * yang sama dengan editor — kecuali gram, yang memang cuma persen × batch.
 */

export type FormulaExportInput = {
  name: string;
  category: string;
  versionLabel: string;
  changeNote: string | null;
  batchG: number;
  pyramid: Pyramid | null;
  analysis: Pick<
    Analysis,
    "lines" | "strength" | "realPyramid" | "spl" | "aroma" | "cost" | "warnings"
  >;
  /** data bahan yang tidak dibawa analyze: CAS, peran, facet */
  meta: Map<
    string,
    { cas: string | null; functionCategory: string | null; facets: Record<string, number> }
  >;
  includeCost: boolean;
  exportedAt: Date;
};

const gram = (pct: number, batchG: number) => (pct / 100) * batchG;
const RP = '"Rp"#,##0';
const PCT = '0.0##"%"';
const G = "0.000";

const header = (ws: ExcelJS.Worksheet) => {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0ECE2" } };
};

export function buildFormulaWorkbook(input: FormulaExportInput): ExcelJS.Workbook {
  const { analysis: a, batchG } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Perfumer's Notebook";
  wb.created = input.exportedAt;

  // ------------------------------------------------------------ Formula
  const ws = wb.addWorksheet("Formula", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "tier", key: "tier", width: 7 },
    { header: "bahan", key: "bahan", width: 40 },
    { header: "cas", key: "cas", width: 13 },
    { header: "persen", key: "persen", width: 9, style: { numFmt: "0.0####" } },
    { header: "dilusi_pct", key: "dilusi_pct", width: 9 },
    { header: "pelarut", key: "pelarut", width: 24 },
    { header: "catatan", key: "catatan", width: 22 },
    { header: "gram", key: "gram", width: 10, style: { numFmt: G } },
    { header: "murni_g", key: "murni_g", width: 10, style: { numFmt: G } },
    { header: "persen_murni", key: "persen_murni", width: 11, style: { numFmt: "0.0##" } },
    { header: "impact", key: "impact", width: 8 },
    { header: "persen_kekuatan", key: "persen_kekuatan", width: 13, style: { numFmt: "0.0#" } },
    { header: "fungsi", key: "fungsi", width: 11 },
    { header: "facet", key: "facet", width: 36 },
    { header: "dilusi_supplier_pct", key: "dilusi_supplier_pct", width: 14 },
  ];
  header(ws);

  for (const r of a.lines.rows) {
    const m = r.kind === "raw_material" ? input.meta.get(r.refId) : undefined;
    const note =
      r.kind === "accord"
        ? `accord · ${r.sub.length} bahan`
        : r.kind === "fo"
          ? "FO"
          : null;
    ws.addRow({
      tier: r.tier === "all" ? null : r.tier,
      bahan: r.name,
      cas: m?.cas ?? null,
      persen: r.pct,
      dilusi_pct: r.userDilutionPct < 100 ? r.userDilutionPct : null,
      pelarut: r.userDilutionPct < 100 ? r.userSolventName : null,
      catatan: note,
      gram: gram(r.pct, batchG),
      murni_g: gram(r.activePct, batchG),
      persen_murni: r.activePct,
      impact: r.impact == null ? null : Math.round(r.impact),
      persen_kekuatan: r.strengthPct,
      fungsi: m?.functionCategory ?? null,
      facet: m ? formatFacets(m.facets) || null : null,
      dilusi_supplier_pct: r.supplierDilutionPct,
    });
  }
  // Kolom template ditandai supaya jelas mana yang dibaca import.
  // Hanya kolom resep (tier … catatan) — kolom bahan-baru template tidak
  // ada di lembar ekspor ini.
  for (let c = 1; c <= TEMPLATE_COLUMNS.indexOf("catatan") + 1; c++) {
    ws.getRow(1).getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE3EEDB" },
    };
  }

  // ------------------------------------------------- Komposisi nyata
  // Isi accord dan pelarut dilusi dibentangkan. Hanya kalau memang ada yang
  // dibentangkan — kalau tidak, lembar ini cuma salinan lembar Formula.
  const expanded =
    a.lines.rows.some((r) => r.kind === "accord") ||
    a.strength.rows.length !== a.lines.rows.length;
  if (expanded) {
    const ks = wb.addWorksheet("Komposisi nyata", { views: [{ state: "frozen", ySplit: 1 }] });
    ks.columns = [
      { header: "bahan", key: "bahan", width: 40 },
      { header: "persen", key: "persen", width: 9, style: { numFmt: "0.0####" } },
      { header: "gram", key: "gram", width: 10, style: { numFmt: G } },
      { header: "persen_kekuatan", key: "kekuatan", width: 13, style: { numFmt: "0.0#" } },
      { header: "pelarut", key: "pelarut", width: 8 },
      { header: "lewat", key: "lewat", width: 30 },
    ];
    header(ks);
    for (const r of a.strength.rows) {
      ks.addRow({
        bahan: r.name,
        persen: r.productPct,
        gram: gram(r.productPct, batchG),
        kekuatan: r.strengthPct,
        pelarut: r.isSolvent ? "ya" : null,
        lewat: r.via.length ? r.via.join(" → ") : null,
      });
    }
  }

  // ------------------------------------------------------------ Ringkasan
  const rs = wb.addWorksheet("Ringkasan");
  rs.columns = [
    { header: "", key: "k", width: 26 },
    { header: "", key: "v", width: 60 },
  ];
  const kv = (k: string, v: string | number | null) => rs.addRow({ k, v });
  const section = (t: string) => {
    rs.addRow({});
    const row = rs.addRow({ k: t });
    row.font = { bold: true };
  };
  rs.getRow(1).values = ["Formula", input.name];
  rs.getRow(1).font = { bold: true };
  kv("Jenis", input.category === "accord" ? "Accord" : "Fragrance");
  kv("Versi", input.versionLabel);
  if (input.changeNote) kv("Catatan versi", input.changeNote);
  kv("Batch (g)", batchG);
  kv("Diekspor", input.exportedAt.toISOString().slice(0, 10));

  if (input.pyramid) {
    section("Piramida (% formula)");
    rs.addRow({ k: "tier", v: "target · terisi · aktif" }).font = { italic: true };
    for (const p of a.realPyramid) {
      if (p.tier === "all") continue;
      kv(TIER_META[p.tier].label, `${fmt(p.target)} · ${fmt(p.filled)} · ${fmt(p.active)}`);
    }
  }

  section("SPL (perkiraan, 0–10)");
  kv("Sillage", a.spl.sillage);
  kv("Projection", a.spl.projection);
  kv("Longevity", a.spl.longevity);
  kv("Catatan", "Perkiraan dari susunan formula, bukan pengukuran. Untuk membandingkan versi pada konsentrasi yang sama.");

  section("Aroma (% dari pie seluruh formula)");
  for (const s of a.aroma.all.slices) {
    const lean = s.leaning.map((l) => `${FACET_LABELS[l.facet] ?? l.facet} ${Math.round(l.pct)}%`).join(", ");
    kv(`${FACET_LABELS[s.facet] ?? s.facet} ${fmt(s.pct)}`, lean ? `condong ke ${lean}` : null);
  }

  if (a.warnings.length) {
    section("Peringatan");
    for (const w of a.warnings) kv(`${w.code} (${w.level})`, w.message);
  }

  if (input.includeCost) {
    section("HPP");
    kv("Tier harga (g)", a.cost.tier);
    rs.addRow({ k: "Per gram", v: a.cost.perGram }).getCell("v").numFmt = RP;
    rs.addRow({ k: "Per 100 g", v: a.cost.per100g }).getCell("v").numFmt = RP;
    rs.addRow({ k: `Satu batch (${batchG} g)`, v: a.cost.total }).getCell("v").numFmt = RP;
    if (a.cost.missing.length) {
      kv("Belum punya harga", a.cost.missing.join(", "));
    }
  }
  rs.getColumn("v").alignment = { wrapText: true, vertical: "top" };

  // ------------------------------------------------------------ HPP
  if (input.includeCost) {
    const hs = wb.addWorksheet("HPP", { views: [{ state: "frozen", ySplit: 1 }] });
    hs.columns = [
      { header: "bahan", key: "bahan", width: 40 },
      { header: "gram", key: "gram", width: 10, style: { numFmt: G } },
      { header: "harga_per_g", key: "harga", width: 12, style: { numFmt: RP } },
      { header: "biaya", key: "biaya", width: 12, style: { numFmt: RP } },
      { header: "porsi_biaya", key: "porsi", width: 11, style: { numFmt: PCT } },
      { header: "tier_harga_g", key: "tier", width: 11 },
      { header: "catatan", key: "catatan", width: 34 },
    ];
    header(hs);
    for (const r of a.cost.rows) {
      hs.addRow({
        bahan: r.name,
        gram: r.grams,
        harga: r.pricePerG,
        biaya: r.cost,
        porsi: r.sharePct,
        tier: r.usedTier,
        catatan:
          r.cost == null
            ? "belum ada harga"
            : r.fallback
              ? "harga dari tier lain"
              : null,
      });
    }
    const total = hs.addRow({ bahan: "Total", biaya: a.cost.total });
    total.font = { bold: true };
  }

  return wb;
}

const fmt = (n: number) => `${Math.round(n * 10) / 10}%`;

export async function formulaXlsxBuffer(input: FormulaExportInput): Promise<ArrayBuffer> {
  return (await buildFormulaWorkbook(input).xlsx.writeBuffer()) as ArrayBuffer;
}
