import { DEFAULT_GEOMETRY as DONUT, donutLayout } from "@/lib/chart/donutLayout";
import { fmtPct } from "@/lib/calc/format";

// Tanpa "use client" dan tanpa hook: dipakai panel analisa (interaktif) DAN
// halaman cetak PDF (dirender di server) dengan gambar yang sama persis.

/**
 * Donat dengan label di luar dan garis penunjuk — setiap irisan disebut
 * namanya, bukan cuma yang terbesar di tengah. Tata letaknya di
 * lib/chart/donutLayout (label tiap sisi didorong supaya tidak menumpuk).
 */
export function LabeledDonut({
  slices,
  center,
  onSliceClick,
}: {
  slices: { key: string; label: string; value: number; color: string }[];
  center: { label: string; value: string } | null;
  /** irisan yang bisa dibuka; "__other" tidak pernah bisa */
  onSliceClick?: (key: string) => void;
}) {
  const clickable = (key: string) => !!onSliceClick && key !== "__other";
  const layout = donutLayout(slices.map((s) => ({ key: s.key, value: s.value })));
  const byKey = new Map(slices.map((s) => [s.key, s]));
  return (
    <svg
      viewBox={`0 0 ${DONUT.width} ${DONUT.height}`}
      className="mx-auto block w-full max-w-[480px]"
      role="img"
      aria-label={slices.map((s) => `${s.label} ${fmtPct(s.value)}`).join(", ")}
    >
      {layout.map((l) => (
        <path
          key={l.key}
          d={l.path}
          fill={byKey.get(l.key)!.color}
          onClick={clickable(l.key) ? () => onSliceClick!(l.key) : undefined}
          className={clickable(l.key) ? "cursor-pointer hover:opacity-80" : undefined}
        >
          {clickable(l.key) && <title>{`Lihat isi ${byKey.get(l.key)!.label}`}</title>}
        </path>
      ))}
      {layout.map((l) => {
        const s = byKey.get(l.key)!;
        return (
          <g
            key={`lbl-${l.key}`}
            onClick={clickable(l.key) ? () => onSliceClick!(l.key) : undefined}
            className={clickable(l.key) ? "cursor-pointer" : undefined}
          >
            <polyline
              points={l.leader.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={1}
              opacity={0.7}
            />
            <text
              x={l.labelX}
              y={l.labelY}
              textAnchor={l.anchor}
              dominantBaseline="middle"
              fontSize={11}
            >
              {/* Label panjang dipendekkan supaya tidak keluar kanvas; nama
                  lengkapnya muncul saat kursor diarahkan. */}
              <title>{`${s.label} ${fmtPct(s.value)}`}</title>
              <tspan
                fontWeight={600}
                fill={`color-mix(in oklab, ${s.color} 78%, var(--text))`}
              >
                {s.label.length > 20 ? `${s.label.slice(0, 19).trimEnd()}…` : s.label}
              </tspan>
              {/* Jarak lewat dx, bukan spasi: SVG membuang spasi di awal
                  tspan, dan "Woody20,6%" yang menempel sulit dibaca. */}
              <tspan dx={4} fill="var(--text-muted)">
                {fmtPct(s.value)}
              </tspan>
            </text>
          </g>
        );
      })}
      {center && (
        <text
          x={DONUT.cx}
          y={DONUT.cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
        >
          <tspan x={DONUT.cx} dy="-0.5em" fontWeight={600} fill="var(--text)">
            {/* Lubang donat sempit; nama lengkap sudah ada di label luar. */}
            {center.label.split("/")[0]}
          </tspan>
          <tspan x={DONUT.cx} dy="1.2em" fill="var(--text-muted)">
            {center.value}
          </tspan>
        </text>
      )}
    </svg>
  );
}
