import { getFormula, pickVersion } from "@/lib/data/formulas";
import { getVersionDetail } from "@/lib/data/versions";
import { formulaXlsxBuffer } from "@/lib/export/formulaExport";
import { getDb } from "@/lib/supabase/db";

export const dynamic = "force-dynamic";

/**
 * Unduhan Excel satu versi formula. `?v=` memilih versinya (default: versi
 * tersimpan terbaru, sama dengan halaman detail); `?hpp=1` menyertakan harga.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);

  const formula = await getFormula(id);
  if (!formula) return new Response("Formula tidak ditemukan.", { status: 404 });
  const version = pickVersion(formula.versions, url.searchParams.get("v") ?? undefined);
  if (!version) return new Response("Versi tidak ditemukan.", { status: 404 });

  const detail = await getVersionDetail(version.id);
  if (!detail) return new Response("Versi tidak ditemukan.", { status: 404 });
  const { context, analysis } = detail;

  // CAS tidak ikut di konteks kalkulasi; diambil terpisah untuk bahan yang
  // memang ada di formula ini saja.
  const ids = [...context.materials.keys()];
  const cas = new Map<string, string | null>();
  if (ids.length) {
    const { data } = await getDb()
      .from("raw_materials")
      .select("id, cas_number")
      .in("id", ids);
    for (const r of data ?? []) cas.set(r.id, r.cas_number);
  }

  const versionLabel =
    version.version_no === 0 ? "draf" : `v${version.version_no}`;
  const buf = await formulaXlsxBuffer({
    name: formula.name,
    category: formula.category,
    versionLabel,
    changeNote: version.change_note,
    batchG: context.version.batchG,
    pyramid: context.version.pyramid,
    analysis,
    meta: new Map(
      [...context.materials.values()].map((m) => [
        m.id,
        {
          cas: cas.get(m.id) ?? null,
          functionCategory: m.functionCategory,
          facets: m.facets,
        },
      ]),
    ),
    includeCost: url.searchParams.get("hpp") === "1",
    exportedAt: new Date(),
  });

  // Nama berkas dari nama formula, tanpa karakter yang ditolak sistem berkas.
  const safe = formula.name.replace(/[\/:*?"<>|]+/g, "").trim() || "formula";
  const filename = `${safe} ${versionLabel}.xlsx`;
  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^ -~]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
