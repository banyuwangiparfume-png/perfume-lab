"use client";

import { useRouter } from "next/navigation";
import { STATUS_LABELS } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import type { VersionStatusEnum } from "@/lib/supabase/database.types";

const MAX = 3;

export function CompareSelector({
  formulaId,
  versions,
  selected,
}: {
  formulaId: string;
  versions: { id: string; versionNo: number; status: VersionStatusEnum }[];
  selected: string[];
}) {
  const router = useRouter();

  const toggle = (id: string, on: boolean) => {
    let next = on ? [...selected, id] : selected.filter((x) => x !== id);
    // Lebih dari tiga kolom tidak lagi bisa dibaca sekilas — yang paling lama
    // dipilih dilepas supaya klik terakhir user selalu berlaku.
    if (next.length > MAX) next = next.slice(next.length - MAX);
    router.replace(
      `/formulas/${formulaId}/compare?ids=${next.join(",")}`,
    );
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[13px] font-medium">Bandingkan versi:</p>
      {versions.map((v) => {
        const checked = selected.includes(v.id);
        return (
          <div key={v.id} className="flex items-center gap-2">
            <Checkbox
              id={`cmp-${v.id}`}
              checked={checked}
              disabled={!checked && selected.length >= MAX}
              onCheckedChange={(on) => toggle(v.id, on === true)}
            />
            <Label htmlFor={`cmp-${v.id}`} className="text-[13px]">
              v{v.versionNo}
              <span className="text-[var(--text-subtle)]">
                {" · "}
                {STATUS_LABELS[v.status].toLowerCase()}
              </span>
            </Label>
          </div>
        );
      })}
      <p className="text-[12px] text-[var(--text-subtle)]">maksimal {MAX}</p>
    </div>
  );
}
