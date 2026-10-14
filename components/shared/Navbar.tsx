"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navbar sticky dengan efek kaca — ciri khas style iOS SaaS Storefront.
 *
 * Menu HPP belum ada di sini: kalkulator HPP dibangun di fase berikutnya, dan
 * link ke halaman kosong lebih membingungkan daripada menu yang belum muncul.
 */
const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/formulas", label: "Formula" },
  { href: "/materials", label: "Bahan" },
  { href: "/stock", label: "Stok" },
  { href: "/admin/materials", label: "Admin" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/[0.72] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-lg bg-[var(--cta)] text-[13px] font-bold text-white"
          >
            PN
          </span>
          <span className="hidden text-[15px] sm:inline">
            Perfumer&apos;s Notebook
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative px-3 py-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "text-[var(--brand)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--brand)]" />
              )}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          className="ml-auto grid size-9 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-lg px-3 py-2.5 text-sm font-medium",
                isActive(link.href)
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "text-[var(--text-muted)]",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
