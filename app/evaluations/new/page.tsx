import { ClipboardList } from "lucide-react";
import { EvaluationForm } from "@/components/evaluation/EvaluationForm";
import { EmptyState, PageHeader } from "@/components/shared/primitives";
import {
  listEvaluableVersions,
  listUsedDescriptors,
  previousEvaluatorNames,
} from "@/lib/data/evaluations";
import type { EvalPurposeEnum } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function NewEvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string; purpose?: string }>;
}) {
  const { version, purpose } = await searchParams;

  const [versions, descriptors] = await Promise.all([
    listEvaluableVersions(),
    listUsedDescriptors(),
  ]);

  if (versions.length === 0) {
    return (
      <>
        <PageHeader title="Evaluasi penciuman" />
        <EmptyState
          icon={ClipboardList}
          title="Belum ada racikan yang siap dinilai"
          description="Tandai dulu kapan versi itu dicampur dan diencerkan. Fase minyak yang belum ketemu ethanol belum mewakili apa pun yang akan dicium pemakai."
          action={{ href: "/formulas", label: "Lihat formula" }}
        />
      </>
    );
  }

  const selected =
    version && versions.some((v) => v.versionId === version)
      ? version
      : versions[0].versionId;

  const previous = await previousEvaluatorNames(selected);

  return (
    <>
      <PageHeader
        title="Evaluasi penciuman"
        subtitle="Rekam perjalanan wanginya, bukan cuma kesan akhir. Ini data yang paling bernilai jangka panjang dan paling sering tidak dicatat orang."
      />
      <EvaluationForm
        versions={versions.map((v) => ({
          versionId: v.versionId,
          formulaId: v.formulaId,
          label: v.label,
          macerationDays: v.macerationDays,
          macerationHours: v.macerationHours,
        }))}
        initialVersionId={selected}
        initialPurpose={
          purpose === "final" || purpose === "screening"
            ? (purpose as EvalPurposeEnum)
            : undefined
        }
        defaultEvaluatorName=""
        descriptorSuggestions={descriptors}
        previousEvaluators={previous}
      />
    </>
  );
}
