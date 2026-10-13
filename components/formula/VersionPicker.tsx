"use client";

import { useRouter } from "next/navigation";
import { STATUS_LABELS } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { VersionStatusEnum } from "@/lib/supabase/database.types";

export type VersionOption = {
  id: string;
  versionNo: number;
  label: string | null;
  status: VersionStatusEnum;
};

export function VersionPicker({
  formulaId,
  versions,
  current,
}: {
  formulaId: string;
  versions: VersionOption[];
  current: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={current}
      onValueChange={(id) => router.push(`/formulas/${formulaId}?v=${id}`)}
    >
      <SelectTrigger className="w-[260px] bg-white" aria-label="Pilih versi">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            v{v.versionNo}
            {v.label ? ` — ${v.label}` : ""}
            <span className="text-[var(--text-subtle)]">
              {" · "}
              {STATUS_LABELS[v.status].toLowerCase()}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
