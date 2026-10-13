"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import { ImpactBadge } from "@/components/shared/ImpactBadge";
import { SmellDisclaimer } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtIdr } from "@/lib/calc/format";
import {
  RULES_DISCLAIMER,
  RULES_HEALTHY,
  type Finding,
  type FindingLevel,
} from "@/lib/rules";
import { cn } from "@/lib/utils";

export type BridgerCandidate = {
  id: string;
  name: string;
  family: string | null;
  effectiveImpact: number | null;
  pricePerGram: number | null;
};

const LEVEL: Record<
  FindingLevel,
  { icon: LucideIcon; className: string; bg: string }
> = {
  info: {
    icon: Info,
    className: "text-[var(--info)]",
    bg: "bg-[var(--info-soft)]",
  },
  warning: {
    icon: AlertTriangle,
    className: "text-[var(--warn)]",
    bg: "bg-[var(--warn-soft)]",
  },
  critical: {
    icon: OctagonAlert,
    className: "text-[var(--danger)]",
    bg: "bg-[var(--danger-soft)]",
  },
};

const ORDER: Record<FindingLevel, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Panel hasil pemeriksaan struktural.
 *
 * Nadanya memberi informasi, bukan menghakimi. Footer disclaimer SELALU ada,
 * di semua kondisi — termasuk saat tidak ada temuan sama sekali.
 */
export function RulesPanel({
  findings,
  bridgerCandidates = [],
}: {
  findings: Finding[];
  bridgerCandidates?: BridgerCandidate[];
}) {
  const [showBridgers, setShowBridgers] = useState(false);

  const sorted = findings
    .slice()
    .sort((a, b) => ORDER[a.level] - ORDER[b.level]);

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg bg-[var(--ok-soft)] px-3.5 py-3">
          <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-[var(--ok)]" />
          <p className="text-[13px] leading-relaxed">{RULES_HEALTHY}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((finding, i) => {
            const level = LEVEL[finding.level];
            const Icon = level.icon;
            return (
              <li
                key={`${finding.rule}-${i}`}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg px-3.5 py-3",
                  level.bg,
                )}
              >
                <Icon
                  className={cn("mt-0.5 size-[18px] shrink-0", level.className)}
                />
                <div className="min-w-0 flex-1">
                  {finding.basisNote ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="cursor-help text-[13px] leading-relaxed underline decoration-dotted decoration-from-font underline-offset-2">
                          {finding.message}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px]">
                        {finding.basisNote}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <p className="text-[13px] leading-relaxed">
                      {finding.message}
                    </p>
                  )}

                  {finding.actionHint?.kind === "bridger-candidates" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 bg-white"
                      onClick={() => setShowBridgers(true)}
                    >
                      {finding.actionHint.label}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SmellDisclaimer>{RULES_DISCLAIMER}</SmellDisclaimer>

      <Dialog open={showBridgers} onOpenChange={setShowBridgers}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Kandidat Bridger</DialogTitle>
            <DialogDescription>
              Bahan kategori Bridger yang kamu punya. Nilai impact-nya selalu
              100 — itu titik acuan sistem ini, bukan kebetulan.
            </DialogDescription>
          </DialogHeader>

          {bridgerCandidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              Belum ada bahan berkategori Bridger di master bahan kamu. Isi
              kolom kategori fungsi di master bahan, atau impor pricelist yang
              sudah berisi kolom itu.
            </p>
          ) : (
            <ul className="max-h-[320px] space-y-1.5 overflow-y-auto">
              {bridgerCandidates.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{m.name}</p>
                    <p className="text-[12px] text-[var(--text-subtle)]">
                      {m.family ?? "family belum diisi"}
                      {m.pricePerGram != null && (
                        <> &middot; {fmtIdr(m.pricePerGram)}/g</>
                      )}
                    </p>
                  </div>
                  <ImpactBadge value={m.effectiveImpact} />
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
