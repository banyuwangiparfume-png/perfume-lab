"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { fmtPct } from "@/lib/calc/format";
import type { FormulaResult } from "@/lib/legacy/calc/types";
import { FUNCTION_COLORS, FUNCTION_LABELS } from "@/lib/constants";
import type { FunctionCategoryEnum } from "@/lib/supabase/database.types";

/**
 * Sebaran % kekuatan per kategori fungsi.
 *
 * Harus diberi hasil dari daftar yang sudah DIBENTANGKAN
 * (analysis.expandedResult), bukan baris mentah — kalau tidak, baris
 * sub-formula tidak punya kategori fungsi dan donutnya terlihat kosong padahal
 * isinya ada.
 */
export function FunctionDonut({ result }: { result: FormulaResult }) {
  const entries = (
    Object.entries(result.functionShares) as [FunctionCategoryEnum, number][]
  ).filter(([, share]) => share > 0.05);

  const total = entries.reduce((a, [, s]) => a + s, 0);

  if (!entries.length) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        Belum ada sebaran yang bisa ditampilkan — kategori fungsi bahan di
        formula ini belum terisi
        {result.hasFO ? ", atau formulanya hanya berisi FO" : ""}.
      </p>
    );
  }

  const data = entries.map(([key, share]) => ({
    key,
    name: FUNCTION_LABELS[key],
    value: share,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="size-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={44}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={FUNCTION_COLORS[d.key]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="w-full space-y-1.5 text-[13px]">
          {data
            .slice()
            .sort((a, b) => b.value - a.value)
            .map((d) => (
              <li key={d.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: FUNCTION_COLORS[d.key] }}
                />
                <span className="flex-1">{d.name}</span>
                <span className="numeric font-medium">{fmtPct(d.value)}</span>
              </li>
            ))}
        </ul>
      </div>

      {total < 99.5 && (
        <p className="text-[12px] text-[var(--text-subtle)]">
          Sisa {fmtPct(100 - total)} berasal dari bahan yang kategori fungsinya
          belum diisi — lengkapi di master bahan supaya sebarannya utuh.
        </p>
      )}
    </div>
  );
}
