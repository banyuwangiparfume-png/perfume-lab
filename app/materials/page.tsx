import { Beaker } from "lucide-react";
import { MaterialsTable } from "@/components/materials/MaterialsTable";
import { EmptyState, PageHeader } from "@/components/shared/primitives";
import { listFamilies, listMaterials } from "@/lib/data/materials";

export const dynamic = "force-dynamic";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ impact?: string }>;
}) {
  const { impact } = await searchParams;
  const [materials, families] = await Promise.all([
    listMaterials(),
    listFamilies(),
  ]);

  return (
    <>
      <PageHeader
        title="Raw material"
        subtitle="Referensi bahan. Angka impact di sini bucketed dari supplier — bagus untuk mendeteksi kelebihan dosis, tidak untuk presisi. Koreksi sendiri lewat halaman detail tiap bahan."
      />

      {materials.length === 0 ? (
        <EmptyState
          icon={Beaker}
          title="Master bahan belum diisi"
          description="Import pricelist dulu supaya bahan bisa dipanggil di formula beserta nilai impact dan harganya."
          action={{ href: "/admin/materials", label: "Import pricelist" }}
        />
      ) : (
        <MaterialsTable
          rows={materials.map((m) => ({
            id: m.id,
            name: m.name,
            synonym: m.synonym,
            cas_number: m.cas_number,
            family: m.family,
            function_category: m.function_category,
            odour_profile: m.odour_profile,
            effectiveImpact: m.effectiveImpact,
            odor_impact: m.odor_impact,
            odor_impact_note: m.odor_impact_note,
            pricePerGram: m.pricePerGram,
            priceTierG: m.priceTierG,
            isGlobal: m.owner_id == null,
          }))}
          families={families}
          initialImpactFilter={
            impact === "no" ? "no" : impact === "yes" ? "yes" : undefined
          }
        />
      )}
    </>
  );
}
