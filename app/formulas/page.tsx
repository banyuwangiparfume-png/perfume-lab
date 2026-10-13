import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { fmtGram, fmtNum } from "@/lib/calc/format";
import { listFormulas } from "@/lib/data/formulas";
import type { FormulaCategoryEnum } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function FormulasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; archived?: string }>;
}) {
  const sp = await searchParams;
  const category: FormulaCategoryEnum =
    sp.tab === "accord" ? "accord" : "fragrance";
  const archived = sp.archived === "1";

  const formulas = await listFormulas({ category, archived });

  const tabs: { key: FormulaCategoryEnum; label: string }[] = [
    { key: "fragrance", label: "Fragrance" },
    { key: "accord", label: "Accord" },
  ];

  return (
    <>
      <PageHeader
        title="Formula"
        subtitle="Fragrance adalah parfum utuh. Accord adalah modul yang bisa dipakai lagi sebagai bahan di formula lain."
      >
        <Button asChild>
          <Link href="/formulas/new">
            <Plus className="size-4" />
            Formula baru
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/formulas?tab=${t.key}`}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              category === t.key
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {formulas.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title={
            category === "accord" ? "Belum ada accord" : "Belum ada formula"
          }
          description={
            category === "accord"
              ? "Accord yang lo simpan di sini akan muncul sebagai pilihan bahan saat menyusun formula."
              : "Mulai dari piramida: tentukan top, mid, base, lalu isi bahannya."
          }
          action={{ href: "/formulas/new", label: "Buat formula" }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {formulas.map((f) => (
            <li key={f.id}>
              <Link
                href={`/formulas/${f.id}`}
                className="block h-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-lg)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug">{f.name}</h2>
                  {f.pyramid_mode && f.draft?.top_pct != null && (
                    <span className="shrink-0 rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                      {fmtNum(f.draft.top_pct)}/{fmtNum(f.draft.mid_pct)}/
                      {fmtNum(f.draft.base_pct)}
                    </span>
                  )}
                </div>

                {f.description && (
                  <p className="mt-1.5 line-clamp-2 text-[13px] text-[var(--text-muted)]">
                    {f.description}
                  </p>
                )}

                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
                  <div>
                    <dt className="inline">Bahan </dt>
                    <dd className="inline font-medium text-[var(--text)]">
                      {f.lineCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Versi </dt>
                    <dd className="inline font-medium text-[var(--text)]">
                      {f.versionCount || "belum ada"}
                    </dd>
                  </div>
                  {f.draft && (
                    <div>
                      <dt className="inline">Batch </dt>
                      <dd className="inline font-medium text-[var(--text)]">
                        {fmtGram(f.draft.batch_g)} g
                      </dd>
                    </div>
                  )}
                </dl>

                <p className="mt-2 text-[12px] text-[var(--text-subtle)]">
                  diubah {dateFmt.format(new Date(f.updated_at))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
