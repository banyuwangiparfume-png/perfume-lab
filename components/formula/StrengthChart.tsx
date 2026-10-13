import { fmtPct } from "@/lib/calc/format";
import type { FormulaResult } from "@/lib/legacy/calc/types";
import { FUNCTION_COLORS } from "@/lib/constants";

/**
 * Komponen paling penting di aplikasi ini.
 *
 * Dua batang per bahan:
 *   batang atas tipis abu  = porsi berat (dari berat murni)
 *   batang bawah tebal     = porsi kekuatan, diwarnai per kategori fungsi
 *
 * PERBEDAAN PANJANG DUA BATANG ITULAH PELAJARANNYA. Bahan 2% berat yang
 * batang bawahnya tiga kali lebih panjang sedang mengendalikan formula tanpa
 * terlihat di resep.
 *
 * Baris FO tidak punya batang berwarna — hanya batang abu, dengan teks
 * "tidak dinilai". Jangan menggambar batang kosong sepanjang nol: itu terbaca
 * seolah kekuatannya memang nol.
 */
export function StrengthChart({ result }: { result: FormulaResult }) {
  const rows = result.rows
    .slice()
    // Urut dari % kekuatan terbesar, bukan urutan resep.
    .sort((a, b) => (b.strengthPct ?? -1) - (a.strengthPct ?? -1));

  const max = Math.max(
    1,
    ...rows.map((r) => Math.max(r.neatPct, r.strengthPct ?? 0)),
  );

  if (!rows.length) return null;

  return (
    <div>
      <p className="mb-4 text-[13px] leading-relaxed text-[var(--text-muted)]">
        Batang abu = porsi berat. Batang berwarna = porsi kekuatan sebenarnya.
        Kalau batang berwarna jauh lebih panjang, bahan itu mendominasi lebih
        dari yang terlihat di resep.
      </p>

      <ul className="space-y-3.5">
        {rows.map((row) => {
          const color = row.functionCategory
            ? FUNCTION_COLORS[row.functionCategory]
            : "var(--text-subtle)";
          return (
            <li key={row.id}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-medium">
                  {row.label}
                </span>
                <span className="numeric shrink-0 text-[12px] text-[var(--text-muted)]">
                  {fmtPct(row.neatPct)} berat
                  {row.strengthPct != null && (
                    <>
                      {" · "}
                      <strong className="text-[var(--text)]">
                        {fmtPct(row.strengthPct)} kekuatan
                      </strong>
                    </>
                  )}
                </span>
              </div>

              <div
                className="h-[5px] rounded-full bg-[var(--impact-low)]/55"
                style={{ width: `${(row.neatPct / max) * 100}%` }}
                aria-hidden
              />

              {row.strengthPct == null ? (
                <p className="mt-1 text-[12px] italic text-[var(--text-subtle)]">
                  {row.lineType === "fo"
                    ? "tidak dinilai — isi FO tidak diketahui"
                    : "tidak dinilai — nilai impact belum ada"}
                </p>
              ) : (
                <div
                  className="mt-1 h-[11px] rounded-full"
                  style={{
                    width: `${Math.max(1, (row.strengthPct / max) * 100)}%`,
                    backgroundColor: color,
                  }}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ul>

      {result.strengthBasis < 99.95 && (
        <p className="mt-4 border-t border-[var(--border)] pt-3 text-[12px] text-[var(--text-subtle)]">
          Batang kekuatan dihitung dari {fmtPct(result.strengthBasis)} formula.
          {result.hasFO ? " FO tidak ikut dinilai." : ""}
        </p>
      )}
    </div>
  );
}
