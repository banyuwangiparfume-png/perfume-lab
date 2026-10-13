import { notFound } from "next/navigation";
import { FoForm } from "@/components/fo/FoForm";
import { Card, CardTitle, PageHeader } from "@/components/shared/primitives";
import { getFragranceOil } from "@/lib/data/fragrance-oils";

export const dynamic = "force-dynamic";

export default async function FoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fo = await getFragranceOil(id);
  if (!fo) notFound();

  return (
    <>
      <PageHeader
        title={fo.name}
        subtitle={
          fo.inspired_by ? `inspired by ${fo.inspired_by}` : undefined
        }
      />

      <div className="max-w-[720px]">
        <Card>
          <CardTitle>Data FO</CardTitle>
          <FoForm
            id={fo.id}
            initial={{
              name: fo.name,
              inspired_by: fo.inspired_by ?? "",
              supplier: fo.supplier ?? "",
              family: fo.family,
              sub_family: fo.sub_family ?? "",
              note_pyramid: fo.note_pyramid ?? "",
              price_per_gram:
                fo.price_per_gram != null ? String(fo.price_per_gram) : "",
              dep_pct: String(fo.dep_pct),
              personal_note: fo.personal_note ?? "",
            }}
          />
        </Card>
      </div>
    </>
  );
}
