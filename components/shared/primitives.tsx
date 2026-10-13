import Link from "next/link";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Kartu putih di atas latar abu — pemisahan tanpa perlu banyak garis. */
export function Card({
  className,
  children,
  ...rest
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]",
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  hint,
  action,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[16px] font-semibold">{children}</h2>
        {hint && (
          <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{hint}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-[70ch] text-sm text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Angka besar, label kecil di bawah. Tanpa sparkline di v1. */
export function StatTile({
  value,
  label,
  icon: Icon,
  tone = "default",
  href,
}: {
  value: React.ReactNode;
  label: string;
  icon?: LucideIcon;
  tone?: "default" | "warn";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-xl border bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-shadow",
        tone === "warn"
          ? "border-[var(--warn)]/35"
          : "border-[var(--border)]",
        href && "hover:shadow-[var(--shadow-card-lg)]",
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "mb-2 size-[18px]",
            tone === "warn" ? "text-[var(--warn)]" : "text-[var(--text-subtle)]",
          )}
        />
      )}
      <p
        className={cn(
          "text-[28px] font-semibold leading-none tabular-nums",
          tone === "warn" && "text-[var(--warn)]",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[13px] font-medium text-[var(--text-muted)]">
        {label}
      </p>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * Ikon · judul · satu kalimat penjelasan · satu tombol aksi.
 * Jangan pernah menampilkan tabel kosong tanpa penjelasan.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-14 text-center">
      {Icon && (
        <span className="mb-3 grid size-11 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-subtle)]">
          <Icon className="size-5" />
        </span>
      )}
      <p className="text-[16px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[46ch] text-sm text-[var(--text-muted)]">
        {description}
      </p>
      {action && (
        <Button asChild className="mt-5">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

/** Banner error. Selalu menyebutkan apa yang terjadi, bukan "terjadi kesalahan". */
export function ErrorBanner({
  title = "Gagal memuat data",
  message,
  children,
}: {
  title?: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-4">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--danger)]" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--danger)]">{title}</p>
        <p className="mt-0.5 break-words text-sm text-[var(--text)]">
          {message}
        </p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

const TONES = {
  info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/25",
  warn: "bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/30",
  danger:
    "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30",
  ok: "bg-[var(--ok-soft)] text-[var(--ok)] border-[var(--ok)]/25",
} as const;

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed",
        TONES[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Teks penutup yang mengembalikan keputusan ke hidung user.
 * Jangan pernah menulis "formula ini bagus".
 */
export function SmellDisclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] leading-relaxed text-[var(--text-subtle)]">
      {children}
    </p>
  );
}
