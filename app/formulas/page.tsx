import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";
import { FormulaFilters } from "@/components/formula/FormulaFilters";
import { EmptyState, PageHeader } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { listFormulas } from "@/lib/data/formulas";
import { FORMULA_TYPES, STATUS_LABELS } from "@/lib/constants";
import type {
  FormulaSourceEnum,
  FormulaTypeEnum,
} from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const typeLabel = (type: FormulaTypeEnum) =>
  FORMULA_TYPES.find((t) => t.value === type)?.label ?? type;

export default async function FormulasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const formulas = await listFormulas({
    search: sp.q,
    type: sp.type as FormulaTypeEnum | undefined,
    source: sp.source as FormulaSourceEnum | undefined,
    targetCategory: sp.category,
    archived: sp.archived === "1",
  });

  const hasFilter = Boolean(
    sp.q || sp.type || sp.source || sp.category || sp.archived,
  );

  return (
    <>
      <PageHeader
        title="Formula"
        subtitle="Tiap formula punya banyak versi, dan versi bisa bercabang untuk subtraction test."
      >
        <Button asChild>
          <Link href="/formulas/new">
            <Plus className="size-4" />
            Formula baru
          </Link>
        </Button>
      </PageHeader>

      <FormulaFilters />

      {formulas.length === 0 ? (
        hasFilter ? (
          <EmptyState
            icon={FlaskConical}
            title="Tidak ada formula yang cocok"
            description="Coba longgarkan filternya, atau cek tab arsip."
          />
        ) : (
          <EmptyState
            icon={FlaskConical}
            title="Belum ada formula"
            description="Mulai dari membedah formula yang sudah ada — itu cara belajar paling cepat."
            action={{ href: "/formulas/new", label: "Buat formula pertama" }}
          />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {formulas.map((formula) => (
            <li key={formula.id}>
              <Link
                href={`/formulas/${formula.id}`}
                className="block h-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-lg)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug">{formula.name}</h2>
                  <span className="shrink-0 rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                    {typeLabel(formula.type)}
                  </span>
                </div>

                {formula.description && (
                  <p className="mt-1.5 line-clamp-2 text-[13px] text-[var(--text-muted)]">
                    {formula.description}
                  </p>
                )}

                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
                  <div>
                    <dt className="inline">Versi </dt>
                    <dd className="inline font-medium text-[var(--text)]">
                      {formula.versionCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Evaluasi </dt>
                    <dd className="inline font-medium text-[var(--text)]">
                      {formula.evaluationCount}
                    </dd>
                  </div>
                  {formula.latestVersion && (
                    <div>
                      <dt className="inline">Terakhir </dt>
                      <dd className="inline font-medium text-[var(--text)]">
                        v{formula.latestVersion.version_no} ·{" "}
                        {STATUS_LABELS[formula.latestVersion.status]}
                      </dd>
                    </div>
                  )}
                </dl>

                <p className="mt-2 text-[12px] text-[var(--text-subtle)]">
                  diubah {dateFmt.format(new Date(formula.updated_at))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
