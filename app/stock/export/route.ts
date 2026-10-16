import { listFragranceOils } from "@/lib/data/fragrance-oils";
import { listMaterials } from "@/lib/data/materials";
import { listStock, stockOnHand } from "@/lib/data/stock";
import {
  currentPrices,
  stockXlsxBuffer,
  type StockExportRow,
} from "@/lib/export/stockExport";
import { getDb } from "@/lib/supabase/db";

export const dynamic = "force-dynamic";

/**
 * Unduhan Excel seluruh bahan dan FO yang ditandai ada di stok.
 *
 * Hanya yang ditandai "punya" — tujuannya merancang formula dari yang ada di
 * rak, dan bahan yang harus dibeli dulu justru mengaburkan itu.
 */
export async function GET() {
  const [stock, onHand, materials, fos] = await Promise.all([
    listStock(),
    stockOnHand(),
    listMaterials(),
    listFragranceOils(),
  ]);

  const owned = materials.filter((m) => stock.materials.has(m.id));
  const facets = await fetchFacets(owned.map((m) => m.id));

  const rows: StockExportRow[] = [
    ...owned.map(
      (m): StockExportRow => ({
        type: "bahan",
        name: m.name,
        synonym: m.synonym,
        casNumber: m.cas_number,
        family: m.family,
        category: m.category,
        odourProfile: m.odour_profile,
        functionCategory: m.effectiveFunctionCategory,
        functionSource: m.functionSource,
        impact: m.effectiveImpact,
        impactNote: m.odor_impact_note,
        noteTier: m.effectiveNoteTierHint,
        facets: facets.get(m.id) ?? {},
        supplierDilutionPct:
          m.supplier_dilution_pct == null ? null : Number(m.supplier_dilution_pct),
        onHandG: onHand.materials.get(m.id) ?? null,
        prices: currentPrices(
          (m.prices ?? []).map((p) => ({
            tier_size: Number(p.tier_size),
            price_idr: Number(p.price_idr),
            effective_date: String(p.effective_date),
          })),
        ),
        pricePerGram: m.pricePerGram,
        personalNote: m.personal_note,
      }),
    ),
    ...fos
      .filter((f) => stock.fos.has(f.id))
      .map(
        (f): StockExportRow => ({
          type: "FO",
          name: f.name,
          // Untuk FO, "mirip apa" adalah informasi paling berguna.
          synonym: f.inspired_by,
          casNumber: null,
          family: f.family,
          category: "Fragrance Oil",
          odourProfile: f.note_pyramid,
          // FO tidak punya kategori fungsi, impact, maupun facet: isinya tidak
          // diketahui, dan mengarangnya akan menyesatkan siapa pun yang
          // membaca berkas ini.
          functionCategory: null,
          functionSource: null,
          impact: null,
          impactNote: null,
          noteTier: null,
          facets: {},
          supplierDilutionPct: null,
          onHandG: onHand.fos.get(f.id) ?? null,
          prices: {},
          pricePerGram:
            f.price_per_gram == null ? null : Number(f.price_per_gram),
          personalNote: f.personal_note,
        }),
      ),
  ].sort((a, b) => a.name.localeCompare(b.name, "id"));

  const today = new Date().toISOString().slice(0, 10);
  return new Response(await stockXlsxBuffer(rows), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stok-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

async function fetchFacets(
  ids: string[],
): Promise<Map<string, Record<string, number>>> {
  const out = new Map<string, Record<string, number>>();
  const db = getDb();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("raw_material_facets")
      .select("raw_material_id, facet_key, weight")
      .in("raw_material_id", ids.slice(i, i + 200));
    if (error) throw new Error(`Gagal memuat facet: ${error.message}`);
    for (const r of data ?? []) {
      const bucket = out.get(r.raw_material_id) ?? {};
      bucket[r.facet_key] = Number(r.weight);
      out.set(r.raw_material_id, bucket);
    }
  }
  return out;
}
