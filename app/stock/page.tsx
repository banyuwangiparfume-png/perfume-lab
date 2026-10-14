import { Beaker } from "lucide-react";
import { StockManager } from "@/components/materials/StockManager";
import { EmptyState, PageHeader } from "@/components/shared/primitives";
import { listMaterials } from "@/lib/data/materials";
import { listStock } from "@/lib/data/stock";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const [materials, stock] = await Promise.all([listMaterials(), listStock()]);

  // FO sengaja tidak ikut: tabel user_stock menyimpan raw_material_id, dan FO
  // hidup di tabel lain. Memaksakannya butuh perubahan skema sendiri.
  const rows = materials.map((m) => ({
    id: m.id,
    name: m.name,
    synonym: m.synonym,
    family: m.family,
    functionCategory: m.effectiveFunctionCategory,
    impact: m.effectiveImpact,
    pricePerGram: m.pricePerGram,
    inStock: stock.has(m.id),
  }));

  return (
    <>
      <PageHeader
        title="Stok saya"
        subtitle="Tandai bahan yang benar-benar ada di rak. Saran yang bahannya harus dibeli dulu tidak bisa dicoba malam itu juga."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Beaker}
          title="Master bahan belum diisi"
          description="Import pricelist dulu, baru stoknya bisa ditandai."
          action={{ href: "/admin/materials", label: "Import pricelist" }}
        />
      ) : (
        <StockManager rows={rows} />
      )}
    </>
  );
}
