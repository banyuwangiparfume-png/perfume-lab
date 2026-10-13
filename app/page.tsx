import Link from "next/link";
import {
  AlertTriangle,
  Beaker,
  ClipboardList,
  Droplets,
  FlaskConical,
  GitBranch,
  Plus,
  Trophy,
} from "lucide-react";
import { DiluteButton } from "@/components/formula/DiluteButton";
import {
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
  StatTile,
} from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/constants";
import { formulaStats, recentFormulas } from "@/lib/data/formulas";
import { listLabQueue, type LabQueueItem } from "@/lib/data/evaluations";
import { materialStats } from "@/lib/data/materials";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function DashboardPage() {
  const [stats, materials, queue, recent] = await Promise.all([
    formulaStats(),
    materialStats(),
    listLabQueue(),
    recentFormulas(5),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Apa yang perlu dikerjain hari ini."
      >
        <Button asChild>
          <Link href="/formulas/new">
            <Plus className="size-4" />
            Formula baru
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={FlaskConical}
          value={stats.fragranceCount}
          label="Fragrance"
          href="/formulas"
        />
        <StatTile
          icon={GitBranch}
          value={stats.accordCount}
          label="Accord saya"
        />
        <StatTile
          icon={ClipboardList}
          value={stats.evaluationsThisMonth}
          label="Evaluasi bulan ini"
        />
        <StatTile
          icon={materials.withoutImpact ? AlertTriangle : Beaker}
          value={materials.withoutImpact}
          label="Bahan tanpa data impact"
          tone={materials.withoutImpact ? "warn" : "default"}
          href="/materials?impact=no"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/*
          Panel terpenting di dashboard. Masalah utama praktik lab bukan
          kurangnya ide, tapi racikan yang dibuat lalu terlupakan.

          Versi yang baru dicampur beberapa jam sengaja TIDAK muncul di sini —
          memunculkan hal yang belum bisa dikerjakan cuma bikin daftarnya penuh
          dan akhirnya diabaikan.
        */}
        <Card>
          <CardTitle hint="Diurut dari yang paling lama menunggu. Yang belum cukup umur belum muncul.">
            Menunggu dikerjakan
          </CardTitle>

          {queue.total === 0 ? (
            <p className="rounded-lg bg-[var(--ok-soft)] px-3.5 py-3 text-[13px]">
              Tidak ada yang menggantung. Semua racikan masih istirahat, atau
              sudah dinilai.
            </p>
          ) : (
            <div className="space-y-5">
              <QueueGroup
                icon={Droplets}
                title="Siap diencerkan"
                hint="Fase minyak sudah lewat 24 jam — waktunya dicampur ethanol."
                items={queue.readyToDilute}
                kind="dilute"
              />
              <QueueGroup
                icon={ClipboardList}
                title="Siap dinilai (screening)"
                hint="Sudah 48 jam sejak diencerkan. Cukup untuk membandingkan versi, belum untuk memutuskan."
                items={queue.readyToScreen}
                kind="screening"
              />
              <QueueGroup
                icon={Trophy}
                title="Siap dinilai (final)"
                hint="Maserasi penuh. Ini yang menentukan apakah produknya siap dijual."
                items={queue.readyForFinal}
                kind="final"
              />
            </div>
          )}
        </Card>

        <Card>
          <CardTitle
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/formulas">Semua</Link>
              </Button>
            }
          >
            Baru diubah
          </CardTitle>

          {recent.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="Belum ada formula"
              description="Mulai dari membedah formula yang sudah ada — itu cara belajar paling cepat."
              action={{ href: "/formulas/new", label: "Buat formula pertama" }}
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {recent.map((formula) => (
                <li key={formula.id} className="py-2.5 first:pt-0">
                  <Link
                    href={`/formulas/${formula.id}`}
                    className="font-medium hover:text-[var(--brand)]"
                  >
                    {formula.name}
                  </Link>
                  <p className="text-[13px] text-[var(--text-muted)]">
                    {formula.versionCount} versi
                    {formula.latestVersion && (
                      <>
                        {" · v"}
                        {formula.latestVersion.version_no}{" "}
                        {STATUS_LABELS[
                          formula.latestVersion.status
                        ].toLowerCase()}
                        {" · "}
                        {dateFmt.format(new Date(formula.updated_at))}
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function QueueGroup({
  icon: Icon,
  title,
  hint,
  items,
  kind,
}: {
  icon: typeof Droplets;
  title: string;
  hint: string;
  items: LabQueueItem[];
  kind: "dilute" | "screening" | "final";
}) {
  if (!items.length) return null;

  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="size-4 text-[var(--text-subtle)]" />
        <h3 className="text-[14px] font-semibold">{title}</h3>
        <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
          {items.length}
        </span>
      </div>
      <p className="mb-2 text-[12px] text-[var(--text-subtle)]">{hint}</p>

      <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {items.map((item) => (
          <li
            key={item.versionId}
            className="flex flex-wrap items-center gap-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/formulas/${item.formulaId}?v=${item.versionId}`}
                className="font-medium hover:text-[var(--brand)]"
              >
                {item.label}
              </Link>
              <p className="text-[13px] text-[var(--text-muted)]">
                {item.detail}
              </p>
            </div>

            {kind === "dilute" ? (
              <DiluteButton
                versionId={item.versionId}
                label={item.label}
                mixedAt={item.mixedAt}
              />
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/evaluations/new?version=${item.versionId}&purpose=${
                    kind === "final" ? "final" : "screening"
                  }`}
                >
                  Nilai {kind === "final" ? "final" : "screening"}
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
