import { Card, PageHeader } from "@/components/shared/primitives";
import { FormulaForm } from "@/components/formula/FormulaForm";

export default function NewFormulaPage() {
  return (
    <>
      <PageHeader
        title="Formula baru"
        subtitle="Formula adalah wadahnya. Yang berisi bahan adalah versi — v1 langsung dibuat begitu kamu simpan."
      />
      <div className="max-w-[680px]">
        <Card>
          <FormulaForm />
        </Card>
      </div>
    </>
  );
}
