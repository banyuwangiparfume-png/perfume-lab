import { NewFormulaWizard } from "@/components/editor/NewFormulaWizard";
import { PageHeader } from "@/components/shared/primitives";

export default function NewFormulaPage() {
  return (
    <>
      <PageHeader
        title="Formula baru"
        subtitle="Mulai dari piramida: tentukan top, mid, base, lalu isi bahannya."
      />
      <NewFormulaWizard />
    </>
  );
}
