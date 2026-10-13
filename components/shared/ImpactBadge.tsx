import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtNum } from "@/lib/calc/format";
import { cn } from "@/lib/utils";

type Variant = "value" | "missing" | "fo";

export type ImpactBadgeProps = {
  value: number | null;
  /** nilai asli supplier, kalau sudah di-override */
  supplierValue?: number | null;
  overrideNote?: string | null;
  /** baris FO: memang tidak punya nilai, bukan belum diisi */
  isFo?: boolean;
  /** nilai rata-rata tertimbang dari penyusun sub-formula */
  isAggregate?: boolean;
  className?: string;
};

/** < 50 lemah · 50–150 sedang · 150–500 kuat · > 500 sangat kuat */
function scale(value: number) {
  if (value < 50)
    return { color: "var(--impact-low)", label: "lemah · tahan lama" };
  if (value <= 150) return { color: "var(--impact-mid)", label: "sedang" };
  if (value <= 500) return { color: "var(--impact-high)", label: "kuat" };
  return { color: "var(--impact-xhigh)", label: "sangat kuat — dosis kecil" };
}

/**
 * Menampilkan nilai impact dengan warna dan label.
 *
 * Dua keadaan tanpa angka harus DIBEDAKAN:
 *   "belum ada data"  → ada yang perlu dilengkapi, garis putus-putus
 *   "FO tidak dinilai" → memang begitu seharusnya, dan tidak akan pernah terisi
 * Kalau keduanya terlihat sama, user akan menghabiskan waktu mencari data yang
 * tidak ada.
 */
export function ImpactBadge({
  value,
  supplierValue,
  overrideNote,
  isFo,
  isAggregate,
  className,
}: ImpactBadgeProps) {
  const variant: Variant = isFo ? "fo" : value == null ? "missing" : "value";

  if (variant === "fo") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-subtle)]",
              className,
            )}
          >
            tidak dinilai
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px]">
          FO adalah parfum lengkap berisi puluhan bahan yang komposisinya tidak
          diketahui, jadi dia tidak bisa diberi satu nilai kekuatan.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "missing") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center rounded-md border border-dashed border-[var(--border-strong)] px-2 py-0.5 text-[12px] font-medium text-[var(--text-subtle)]",
              className,
            )}
          >
            &mdash;
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Belum ada data impact. Selama kosong, % kekuatan formula yang memakai
          bahan ini belum bisa dipercaya.
        </TooltipContent>
      </Tooltip>
    );
  }

  const { color, label } = scale(value!);
  const overridden = supplierValue != null && supplierValue !== value;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-semibold text-white",
            className,
          )}
          style={{ backgroundColor: color }}
        >
          {overridden && (
            <s className="font-normal opacity-70">{fmtNum(supplierValue)}</s>
          )}
          {fmtNum(value)}
          {isAggregate && <span className="font-normal opacity-80">rata²</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">
        <p>
          {label} &middot; baseline 100 = bahan kategori Bridger
        </p>
        {overridden && (
          <p className="mt-1 border-t border-white/20 pt-1">
            Nilai supplier {fmtNum(supplierValue)} diganti jadi {fmtNum(value)}.
            {overrideNote ? ` ${overrideNote}` : ""}
          </p>
        )}
        {isAggregate && (
          <p className="mt-1 border-t border-white/20 pt-1">
            Rata-rata tertimbang dari bahan penyusun sub-formula ini.
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
