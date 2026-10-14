import Link from "next/link";
import { Beaker, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockManager } from "@/components/materials/StockManager";
import { EmptyState, PageHeader } from "@/components/shared/primitives";
import { listFragranceOils } from "@/lib/data/fragrance-oils";
import { listMaterials } from "@/lib/data/materials";
import { listStock, stockOnHand } from "@/lib/data/stock";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const [materials, fos, stock, onHand] = await Promise.all([
    listMaterials(),
    listFragranceOils(),
    listStock(),
    stockOnHand(),
  ]);

  // FO ikut: pertanyaannya sama saja — apakah botolnya ada di rak saya.
  const rows = [
    ...materials.map((m) => ({
      kind: "rm" as const,
      id: m.id,
      name: m.name,
      synonym: m.synonym,
      family: m.family,
      functionCategory: m.effectiveFunctionCategory,
      impact: m.effectiveImpact,
      pricePerGram: m.pricePerGram,
      inStock: stock.materials.has(m.id),
      onHand: onHand.materials.get(m.id) ?? null,
    })),
    ...fos.map((f) => ({
      kind: "fo" as const,
      id: f.id,
      name: f.name,
      synonym: f.inspired_by,
      family: f.family,
      functionCategory: null,
      impact: null,
      pricePerGram: f.price_per_gram == null ? null : Number(f.price_per_gram),
      inStock: stock.fos.has(f.id),
      onHand: onHand.fos.get(f.id) ?? null,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, "id"));

  return (
    <>
      <PageHeader
        title="Stok saya"
        subtitle="Tandai bahan yang benar-benar ada di rak, catat pembelian, dan kurangi lewat produksi."
      >
        <Button asChild>
          <Link href="/stock/produksi">
            <Factory className="size-4" />
            Catat produksi
          </Link>
        </Button>
      </PageHeader>

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
