import { MaterialImport } from "@/components/materials/MaterialImport";
import { MaterialsTable } from "@/components/materials/MaterialsTable";
import {
  Card,
  CardTitle,
  Notice,
  PageHeader,
  StatTile,
} from "@/components/shared/primitives";
import { listFamilies, listMaterials, materialStats } from "@/lib/data/materials";

export const dynamic = "force-dynamic";

export default async function AdminMaterialsPage() {
  const [materials, families, stats] = await Promise.all([
    listMaterials({ includeInactive: true }),
    listFamilies(),
    materialStats(),
  ]);

  return (
    <>
      <PageHeader
        title="Admin — Raw material"
        subtitle="Kelola master bahan dan masukkan pricelist supplier."
      />

      <Notice tone="info" className="mb-5">
        Halaman ini belum dijaga autentikasi — gate admin dipasang di fase auth.
        Sampai saat itu, jangan buka aplikasi ini ke jaringan publik.
      </Notice>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile value={stats.total} label="Total bahan aktif" />
        <StatTile
          value={stats.withoutImpact}
          label="Tanpa data impact"
          tone={stats.withoutImpact ? "warn" : "default"}
        />
        <StatTile value={stats.overridden} label="Impact di-override" />
        <StatTile value={families.length} label="Family terdata" />
      </div>

      <Card className="mb-6">
        <CardTitle hint="Kunci pencocokan utama CAS number, nama jadi cadangan. Harga masuk sebagai baris baru dengan tanggal hari ini — harga lama tetap tersimpan sebagai riwayat.">
          Import pricelist
        </CardTitle>
        <MaterialImport />
      </Card>

      <Card>
        <CardTitle>Master bahan</CardTitle>
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
        />
      </Card>
    </>
  );
}
