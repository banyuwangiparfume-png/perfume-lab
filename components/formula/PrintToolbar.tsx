"use client";

import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Bilah atas halaman laporan — tidak ikut tercetak. PDF dibuat lewat dialog
 * cetak browser ("Simpan sebagai PDF"): grafiknya jadi sama persis dengan
 * yang di layar, tanpa server harus menjalankan browser sendiri.
 */
export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 print:hidden">
      <Button asChild variant="ghost" size="sm">
        <Link href={backHref}>
          <ArrowLeft className="size-4" />
          Kembali
        </Link>
      </Button>
      <p className="flex-1 text-[12px] text-[var(--text-muted)]">
        Di dialog cetak, pilih tujuan <strong>Simpan sebagai PDF</strong>, ukuran
        A4, dan nyalakan <strong>Grafik latar</strong> supaya warna donat ikut.
      </p>
      <Button type="button" onClick={() => window.print()}>
        <FileDown className="size-4" />
        Unduh PDF
      </Button>
    </div>
  );
}
