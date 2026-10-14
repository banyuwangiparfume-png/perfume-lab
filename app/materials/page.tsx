import { Beaker } from "lucide-react";
import { MaterialsTable } from "@/components/materials/MaterialsTable";
import { EmptyState, PageHeader } from "@/components/shared/primitives";
import { listFragranceOils } from "@/lib/data/fragrance-oils";
import { listFamilies, listMaterials } from "@/lib/data/materials";
import { listStock } from "@/lib/data/stock";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ impact?: string }>;
}) {
  const { impact } = await searchParams;

  // FO ikut ditampilkan di sini supaya master bahan cuma satu daftar. Keduanya
  // sama-sama "sesuatu yang bisa dimasukkan ke formula"; memisahkannya ke dua
  // halaman memaksa user mengingat di mana sebuah nama disimpan.
  const [materials, fos, families, stock] = await Promise.all([
    listMaterials(),
    listFragranceOils(),
    listFamilies(),
    listStock(),
  ]);

  const rows = [
    ...materials.map((m) => ({
      kind: "rm" as const,
      id: m.id,
      name: m.name,
      synonym: m.synonym,
      cas_number: m.cas_number,
      family: m.family,
      function_category: m.effectiveFunctionCategory as never,
      functionIsGuess: m.functionSource === "derived",
      odour_profile: m.odour_profile,
      effectiveImpact: m.effectiveImpact,
      odor_impact: m.odor_impact,
      odor_impact_note: m.odor_impact_note,
      pricePerGram: m.pricePerGram,
      priceTierG: m.priceTierG,
      isGlobal: m.owner_id == null,
      inStock: stock.has(m.id),
    })),
    ...fos.map((f) => ({
      kind: "fo" as const,
      id: f.id,
      name: f.name,
      // Yang paling berguna dicari dari sebuah FO adalah "ini mirip apa".
      synonym: f.inspired_by,
      cas_number: null,
      family: f.family,
      // FO tidak punya kategori fungsi maupun impact: isinya tidak diketahui,
      // dan menebaknya akan membuat analisa percaya pada angka karangan.
      function_category: null as never,
      odour_profile: f.note_pyramid,
      effectiveImpact: null,
      odor_impact: null,
      odor_impact_note: null,
      pricePerGram: f.price_per_gram == null ? null : Number(f.price_per_gram),
      priceTierG: null,
      isGlobal: false,
      inStock: false,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, "id"));

  const foFamilies = fos.map((f) => f.family).filter(Boolean) as string[];
  const allFamilies = [...new Set([...families, ...foFamilies])].sort();

  return (
    <>
      <PageHeader
        title="Master bahan"
        subtitle="Raw material dan FO dalam satu daftar. Angka impact bucketed dari supplier — bagus untuk mendeteksi kelebihan dosis, tidak untuk presisi. Koreksi sendiri lewat halaman detail tiap bahan."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Beaker}
          title="Master bahan belum diisi"
          description="Import pricelist dulu supaya bahan bisa dipanggil di formula beserta nilai impact dan harganya."
          action={{ href: "/admin/materials", label: "Import pricelist" }}
        />
      ) : (
        <MaterialsTable
          rows={rows}
          families={allFamilies}
          initialImpactFilter={
            impact === "no" ? "no" : impact === "yes" ? "yes" : undefined
          }
        />
      )}
    </>
  );
}
