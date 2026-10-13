import Link from "next/link";
import { Star } from "lucide-react";
import {
  EVAL_MEDIA,
  EVAL_PURPOSES,
  minutesLabel,
  TRANSITION_VERDICTS,
} from "@/lib/constants";
import type {
  EvaluationPointRow,
  EvaluationRow,
} from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const VERDICT_TONE: Record<string, string> = {
  smooth: "bg-[var(--ok-soft)] text-[var(--ok)]",
  broken: "bg-[var(--warn-soft)] text-[var(--warn)]",
  muddy: "bg-[var(--danger-soft)] text-[var(--danger)]",
};

export function EvaluationCard({
  evaluation,
  points,
  compact,
}: {
  evaluation: EvaluationRow;
  points: EvaluationPointRow[];
  compact?: boolean;
}) {
  const medium =
    EVAL_MEDIA.find((m) => m.value === evaluation.medium)?.label ??
    evaluation.medium;
  const verdict = TRANSITION_VERDICTS.find(
    (v) => v.value === evaluation.transition_verdict,
  );
  const purpose = EVAL_PURPOSES.find((p) => p.value === evaluation.purpose);

  return (
    <article className="rounded-lg border border-[var(--border)] p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">
            <Link
              href={`/evaluations/${evaluation.id}`}
              className="hover:text-[var(--brand)]"
            >
              {evaluation.evaluator_name}
            </Link>
          </p>
          <p className="text-[12px] text-[var(--text-muted)]">
            {medium}
            {evaluation.diluted_in ? ` · ${evaluation.diluted_in}` : ""}
            {evaluation.maceration_days != null
              ? ` · maserasi ${evaluation.maceration_days} hari`
              : ""}
            {" · "}
            {dateFmt.format(new Date(evaluation.evaluated_at))}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-medium",
                evaluation.purpose === "final"
                  ? "bg-[var(--ok-soft)] text-[var(--ok)]"
                  : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
              )}
              title={purpose?.hint}
            >
              {purpose?.label ?? evaluation.purpose}
            </span>
            {evaluation.blind_code ? (
              <span
                className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--brand)]"
                title="Dinilai buta — penilai tidak tahu versi mana yang dicium"
              >
                {evaluation.blind_code}
              </span>
            ) : (
              <span
                className="text-[11px] text-[var(--text-subtle)]"
                title="Penilai tahu versi mana yang dicium. Bukan dosa, tapi perlu terlihat."
              >
                dinilai terbuka
              </span>
            )}
          </p>
        </div>

        {evaluation.rating != null && (
          <span className="flex items-center gap-0.5 text-[13px] font-medium">
            {evaluation.rating}
            <Star className="size-3.5 fill-[var(--warn)] text-[var(--warn)]" />
          </span>
        )}
      </div>

      {verdict && (
        <span
          className={cn(
            "mt-2 inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium",
            VERDICT_TONE[evaluation.transition_verdict!],
          )}
        >
          {verdict.label}
        </span>
      )}

      {points.length > 0 && (
        <ul
          className={cn(
            "mt-3 space-y-2 border-l-2 border-[var(--border)] pl-3",
            compact && "space-y-1.5",
          )}
        >
          {points.map((point) => (
            <li key={point.id} className="relative">
              <span
                aria-hidden
                className="absolute -left-[18px] top-1.5 size-2 rounded-full bg-[var(--border-strong)]"
              />
              <p className="text-[12px] font-medium text-[var(--text-muted)]">
                {minutesLabel(point.minutes_elapsed)}
                {point.intensity != null && (
                  <span className="ml-1.5 font-normal">
                    intensitas {point.intensity}/10
                  </span>
                )}
              </p>
              {point.dominant_note && (
                <p className="text-[13px] font-medium">{point.dominant_note}</p>
              )}
              {point.descriptors.length > 0 && (
                <p className="text-[12px] text-[var(--text-muted)]">
                  {point.descriptors.join(" · ")}
                </p>
              )}
              {!compact && point.note && (
                <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                  {point.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {!compact && evaluation.overall_note && (
        <p className="mt-3 whitespace-pre-wrap border-t border-[var(--border)] pt-3 text-[13px]">
          {evaluation.overall_note}
        </p>
      )}
    </article>
  );
}
