import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { NewFoDialog } from "@/components/fo/NewFoDialog";
import { ImpactBadge } from "@/components/shared/ImpactBadge";
import { EmptyState, PageHeader } from "@/components/shared/primitives";
import { fmtIdr, fmtNum } from "@/lib/calc/format";
import { listFragranceOils } from "@/lib/data/fragrance-oils";

export const dynamic = "force-dynamic";

export default async function FoListPage() {
  const fos = await listFragranceOils({ includeInactive: true });

  return (
    <>
      <PageHeader
        title="Fragrance oil"
        subtitle="Bibit parfum jadi. Dipisah dari raw material karena FO adalah parfum lengkap berisi puluhan bahan yang komposisinya tidak diketahui."
      >
        <NewFoDialog />
      </PageHeader>

      {fos.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Belum ada FO terdaftar"
          description="Tambahkan bibit yang kamu pakai supaya bisa dipanggil sebagai komponen di formula, bukan cuma jadi angka di kalkulator HPP."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
                <th className="px-3 py-2 text-left font-medium">Nama</th>
                <th className="px-3 py-2 text-left font-medium">Inspired by</th>
                <th className="px-3 py-2 text-left font-medium">Family</th>
                <th className="px-3 py-2 text-left font-medium">Supplier</th>
                <th className="px-3 py-2 text-right font-medium">Harga/g</th>
                <th className="px-3 py-2 text-right font-medium">DEP</th>
                <th className="px-3 py-2 text-left font-medium">Kekuatan</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {fos.map((fo) => (
                <tr
                  key={fo.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)]"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/fo/${fo.id}`}
                      className="font-medium hover:text-[var(--brand)]"
                    >
                      {fo.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-[var(--text-muted)]">
                    {fo.inspired_by ?? "\u2014"}
                  </td>
                  <td className="px-3 py-2.5 text-[13px]">
                    {fo.family}
                    {fo.sub_family && (
                      <span className="text-[var(--text-subtle)]">
                        {" · "}
                        {fo.sub_family}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-[var(--text-muted)]">
                    {fo.supplier ?? "\u2014"}
                  </td>
                  <td className="numeric px-3 py-2.5">
                    {fo.price_per_gram != null
                      ? fmtIdr(fo.price_per_gram)
                      : "\u2014"}
                  </td>
                  <td className="numeric px-3 py-2.5 text-[var(--text-muted)]">
                    {fmtNum(fo.dep_pct)}%
                  </td>
                  <td className="px-3 py-2.5">
                    <ImpactBadge value={null} isFo />
                  </td>
                  <td className="px-3 py-2.5 text-[13px]">
                    {fo.is_active ? (
                      <span className="text-[var(--ok)]">aktif</span>
                    ) : (
                      <span className="text-[var(--text-subtle)]">nonaktif</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
