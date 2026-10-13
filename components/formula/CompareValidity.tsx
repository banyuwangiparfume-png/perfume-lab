import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { EVAL_MEDIA, EVAL_PURPOSES } from "@/lib/constants";
import { COMPARE_VALID, type CompareSubject } from "@/lib/rules/compare";
import type { Finding } from "@/lib/rules";
import { cn } from "@/lib/utils";

/**
 * Panel kesahihan perbandingan (Rule 8), DI ATAS tabel apa pun.
 *
 * Kalau user sudah selesai membaca tabelnya, peringatan ini sudah terlambat:
 * dia sudah menarik kesimpulan. Jangan pernah pindahkan ke bawah.
 */
export function CompareValidity({
  findings,
  subjects,
}: {
  findings: Finding[];
  subjects: CompareSubject[];
}) {
  const scored = subjects.filter((s) => s.evaluation != null);

  if (scored.length < 2) {
    return (
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
        <Info className="mt-0.5 size-[18px] shrink-0 text-[var(--text-subtle)]" />
        <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
          Baru {scored.length} versi yang punya catatan penciuman. Tabel di
          bawah masih bisa dibaca sebagai perbandingan komposisi, tapi belum
          bisa menjawab versi mana yang lebih enak — itu cuma datang dari
          hidung.
        </p>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[var(--ok)]/25 bg-[var(--ok-soft)] px-4 py-3">
        <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-[var(--ok)]" />
        <p className="text-[13px] leading-relaxed">{COMPARE_VALID}</p>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-[var(--warn)]/30 bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <h2 className="mb-1 text-[15px] font-semibold">
        Kondisi ujinya tidak setara
      </h2>
      <p className="mb-3 text-[13px] text-[var(--text-muted)]">
        Perbandingan terkontrol tidak butuh kondisi sempurna, tapi butuh kondisi
        identik. Baca ini dulu sebelum menyimpulkan apa pun dari tabel di bawah.
      </p>

      <ul className="space-y-2">
        {findings.map((finding, i) => {
          const Icon = finding.level === "info" ? Info : AlertTriangle;
          return (
            <li
              key={`${finding.rule}-${i}`}
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-3.5 py-2.5",
                finding.level === "info"
                  ? "bg-[var(--info-soft)]"
                  : "bg-[var(--warn-soft)]",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 size-[18px] shrink-0",
                  finding.level === "info"
                    ? "text-[var(--info)]"
                    : "text-[var(--warn)]",
                )}
              />
              <p className="text-[13px] leading-relaxed">{finding.message}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[12px] text-[var(--text-subtle)]">
        Tidak ada yang diblokir — tabelnya tetap bisa dibaca. Yang dicegah
        adalah menyimpulkan tanpa sadar bahwa yang dibandingkan bukan
        formulanya.
      </p>
    </div>
  );
}

type ConditionRow = {
  label: string;
  values: (string | null)[];
};

/**
 * Baris kondisi uji tiap versi. Kolom yang BERBEDA antar versi diberi latar
 * kuning tipis, supaya ketidaksetaraan langsung terlihat tanpa harus membaca
 * panel peringatan di atas.
 */
export function CompareConditions({
  subjects,
}: {
  subjects: CompareSubject[];
}) {
  const value = (
    pick: (s: CompareSubject) => string | null,
  ): (string | null)[] => subjects.map(pick);

  const rows: ConditionRow[] = [
    {
      label: "Umur maserasi",
      values: value((s) =>
        s.evaluation?.macerationDays == null
          ? null
          : `${s.evaluation.macerationDays} hari`,
      ),
    },
    {
      label: "Tujuan",
      values: value(
        (s) =>
          EVAL_PURPOSES.find((p) => p.value === s.evaluation?.purpose)?.label ??
          null,
      ),
    },
    {
      label: "Media",
      values: value(
        (s) =>
          EVAL_MEDIA.find((m) => m.value === s.evaluation?.medium)?.label ??
          null,
      ),
    },
    {
      label: "Pengenceran",
      values: value((s) => s.evaluation?.dilutedIn ?? null),
    },
    {
      label: "Penilai",
      values: value((s) => s.evaluation?.evaluatorName ?? null),
    },
    {
      label: "Kode buta",
      values: value((s) => s.evaluation?.blindCode ?? null),
    },
  ];

  return (
    <div className="-mx-5 overflow-x-auto md:mx-0">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-y border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--text-muted)]">
            <th className="w-[150px] px-3 py-2 text-left font-medium">
              Kondisi uji
            </th>
            {subjects.map((s) => (
              <th key={s.label} className="px-3 py-2 text-left font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            // "Berbeda" dihitung dari versi yang punya evaluasi saja — versi
            // yang belum dinilai bukan ketidaksetaraan kondisi, dia cuma
            // belum ada datanya.
            const present = row.values.filter(
              (_, i) => subjects[i].evaluation != null,
            );
            const differs = new Set(present).size > 1;
            return (
              <tr
                key={row.label}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                  {row.label}
                </td>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-3 py-2",
                      differs &&
                        subjects[i].evaluation != null &&
                        "bg-[var(--warn-soft)]",
                    )}
                  >
                    {subjects[i].evaluation == null ? (
                      <span className="text-[var(--text-subtle)]">
                        belum dinilai
                      </span>
                    ) : v ? (
                      <span className={cn(differs && "font-medium")}>{v}</span>
                    ) : (
                      <span className="text-[var(--text-subtle)]">
                        tidak dicatat
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
