import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { productionPlan } from "@/app/actions/stock";
import { ProductionForm } from "@/components/materials/ProductionForm";
import { Notice, PageHeader } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { listProducibleVersions } from "@/lib/data/versions";

export const dynamic = "force-dynamic";

export default async function ProduksiPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; batch?: string }>;
}) {
  const { v, batch } = await searchParams;

  const options = await listProducibleVersions();

  const requested = Number(String(batch ?? "").replace(",", "."));
  const selected = options.find((o) => o.id === v) ?? null;
  const batchG =
    Number.isFinite(requested) && requested > 0
      ? requested
      : (selected?.batchG ?? 10);

  const plan = selected ? await productionPlan(selected.id, batchG) : null;

  return (
    <>
      <PageHeader
        title="Catat produksi"
        subtitle="Pilih versi yang mau diracik dan ukurannya. Bahannya dikurangi dari stok, dan hasilnya masuk kembali sebagai FO."
      >
        <Button asChild variant="outline">
          <Link href="/stock">
            <ArrowLeft className="size-4" />
            Kembali ke stok
          </Link>
        </Button>
      </PageHeader>

      {options.length === 0 ? (
        <Notice tone="warn">
          Belum ada versi tersimpan yang bisa diproduksi. Simpan dulu satu versi
          dari editor — draf sengaja tidak bisa diracik, karena isinya masih
          berubah.
        </Notice>
      ) : (
        <ProductionForm
          options={options}
          selectedId={selected?.id ?? null}
          batchG={batchG}
          plan={plan?.ok ? plan.data : null}
          error={plan && !plan.ok ? plan.error : null}
        />
      )}
    </>
  );
}
