import Link from "next/link";
import { notFound } from "next/navigation";
import { EvaluationCard } from "@/components/evaluation/EvaluationCard";
import { Card, CardTitle, PageHeader } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { getEvaluation } from "@/lib/data/evaluations";
import { getVersionDetail } from "@/lib/data/versions";

export const dynamic = "force-dynamic";

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const evaluation = await getEvaluation(id);
  if (!evaluation) notFound();

  const detail = await getVersionDetail(evaluation.formula_version_id);

  return (
    <>
      <PageHeader
        title={`Evaluasi oleh ${evaluation.evaluator_name}`}
        subtitle={
          detail
            ? `${detail.formula.name} · v${detail.version.version_no}`
            : undefined
        }
      >
        {detail && (
          <Button asChild variant="outline">
            <Link
              href={`/formulas/${detail.formula.id}?v=${detail.version.id}`}
            >
              Buka formula
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="max-w-[720px]">
        <Card>
          <CardTitle>Catatan penciuman</CardTitle>
          <EvaluationCard
            evaluation={evaluation}
            points={evaluation.points}
          />
        </Card>
      </div>
    </>
  );
}
