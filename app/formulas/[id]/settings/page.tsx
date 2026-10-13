import { notFound } from "next/navigation";
import { FormulaForm } from "@/components/formula/FormulaForm";
import { Card, PageHeader } from "@/components/shared/primitives";
import { getFormula } from "@/lib/data/formulas";

export const dynamic = "force-dynamic";

export default async function FormulaSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const formula = await getFormula(id);
  if (!formula) notFound();

  return (
    <>
      <PageHeader
        title="Ubah data formula"
        subtitle={formula.name}
      />
      <div className="max-w-[680px]">
        <Card>
          <FormulaForm
            id={formula.id}
            initial={{
              name: formula.name,
              type: formula.type,
              target_category: formula.target_category ?? "none",
              source: formula.source,
              source_note: formula.source_note ?? "",
              description: formula.description ?? "",
            }}
          />
        </Card>
      </div>
    </>
  );
}
