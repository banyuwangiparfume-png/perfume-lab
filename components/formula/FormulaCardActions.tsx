"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileDown,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteFormula,
  duplicateFormula,
  setFormulaArchived,
  updateFormula,
} from "@/app/actions/formulas";

/**
 * Aksi per kartu formula.
 *
 * Menghapus diberi dialog konfirmasi yang menyebutkan apa yang ikut hilang.
 * Formula bukan berkas yang bisa dibuat ulang dalam semenit: di dalamnya ada
 * riwayat versi dan keputusan yang tidak tercatat di tempat lain.
 *
 * Arsipkan ditaruh berdampingan dan disebut di dialognya, karena hampir selalu
 * itu yang sebenarnya dimaksud — menyingkirkan dari daftar, bukan melenyapkan.
 */
export function FormulaCardActions({
  id,
  name,
  versionCount,
  archived,
  versionId,
}: {
  id: string;
  name: string;
  versionCount: number;
  archived: boolean;
  /** versi yang diekspor; kosong = versi tersimpan terbaru */
  versionId?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [withCost, setWithCost] = useState(true);
  const exportHref = `/formulas/${id}/export?${new URLSearchParams({
    ...(versionId ? { v: versionId } : {}),
    ...(withCost ? { hpp: "1" } : {}),
  })}`;
  // Laporan PDF: halaman cetak dengan semua tab analisa terbuka.
  const printHref = `/formulas/${id}/print?${new URLSearchParams({
    ...(versionId ? { v: versionId } : {}),
    hpp: withCost ? "1" : "0",
  })}`;
  const [newName, setNewName] = useState(name);
  const [pending, start] = useTransition();

  const rename = () => {
    const next = newName.trim();
    if (!next) {
      toast.error("Nama formula wajib diisi.");
      return;
    }
    if (next === name) {
      setRenaming(false);
      return;
    }
    start(async () => {
      const result = await updateFormula(id, { name: next });
      if (result.ok) {
        toast.success("Nama formula diganti.");
        setRenaming(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(done);
        setConfirming(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal.");
      }
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Aksi untuk ${name}`}
            onClick={(e) => {
              // Kartunya sendiri sebuah tautan; tanpa ini menu ikut membuka
              // formulanya.
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          onClick={(e) => e.preventDefault()}
        >
          <DropdownMenuItem
            onSelect={() => {
              setNewName(name);
              setRenaming(true);
            }}
          >
            <Pencil className="size-4" />
            Ganti nama
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setExporting(true)}>
            <FileDown className="size-4" />
            Export (Excel / PDF)
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const result = await duplicateFormula(id);
                if (result.ok) {
                  toast.success("Formula diduplikat.");
                  router.push(`/formulas/${result.data.formulaId}/edit`);
                } else {
                  toast.error(result.error);
                }
              })
            }
          >
            <Copy className="size-4" />
            Duplikat
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() =>
              run(
                () => setFormulaArchived(id, !archived),
                archived ? "Dikembalikan dari arsip." : "Diarsipkan.",
              )
            }
          >
            {archived ? (
              <ArchiveRestore className="size-4" />
            ) : (
              <Archive className="size-4" />
            )}
            {archived ? "Kembalikan dari arsip" : "Arsipkan"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirming(true)}
          >
            <Trash2 className="size-4" />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={exporting} onOpenChange={setExporting}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Export {name}</DialogTitle>
            <DialogDescription>
              <strong className="font-medium">Excel</strong> — komposisi lengkap
              per baris, bisa diimpor balik. <strong className="font-medium">PDF</strong>{" "}
              — laporan dengan semua tab analisa terbuka: ringkasan & SPL, aroma
              beserta isi tiap irisan, kepaduan, kekuatan per fase, dan HPP.
            </DialogDescription>
          </DialogHeader>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border)] p-3">
            <Checkbox
              checked={withCost}
              onCheckedChange={(v) => setWithCost(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[13px] font-medium">
                Sertakan HPP & harga
              </span>
              <span className="block text-[12px] leading-relaxed text-[var(--text-muted)]">
                Lembar HPP per bahan, plus HPP per gram dan per batch. Matikan
                kalau berkasnya mau dibagikan ke orang lain.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExporting(false)}>
              Batal
            </Button>
            <Button asChild variant="outline">
              <a href={exportHref} download onClick={() => setExporting(false)}>
                <FileDown className="size-4" />
                Excel
              </a>
            </Button>
            <Button asChild>
              <a href={printHref} target="_blank" rel="noopener" onClick={() => setExporting(false)}>
                <FileText className="size-4" />
                Laporan PDF
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Ganti nama</DialogTitle>
            {/* Yang perlu diketahui sebelum mengganti: nama ini juga yang
                tampil di formula lain yang memakainya sebagai accord. */}
            <DialogDescription>
              Riwayat versi dan catatan penciuman tetap utuh. Formula lain yang
              memakai ini sebagai accord ikut menampilkan nama barunya.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                rename();
              }
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRenaming(false)}
            >
              Batal
            </Button>
            <Button type="button" onClick={rename} disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus {name}?</DialogTitle>
            <DialogDescription>
              {versionCount > 0
                ? `${versionCount} versi tersimpan beserta seluruh barisnya ikut hilang, dan tidak bisa dikembalikan.`
                : "Draf beserta seluruh barisnya ikut hilang, dan tidak bisa dikembalikan."}
            </DialogDescription>
          </DialogHeader>

          <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
            Kalau cuma ingin menyingkirkannya dari daftar, pilih{" "}
            <strong className="font-medium">Arsipkan</strong> — formulanya tetap
            bisa dibuka lagi kapan saja.
          </p>

          {/* Dua hal yang membuat penghapusan ditolak server. Disebut di sini
              supaya penolakannya tidak terasa seperti kegagalan acak. */}
          <p className="text-[12px] leading-relaxed text-[var(--text-subtle)]">
            Formula yang sudah punya catatan evaluasi, atau yang versinya
            dipakai sebagai accord di formula lain, tidak bisa dihapus — catatan
            penciuman tidak bisa dibuat ulang, dan formula lain akan rusak.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await deleteFormula(id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Formula dihapus.");
                  setConfirming(false);
                  // Selalu ke daftar, tidak pernah refresh: menu ini juga
                  // dipakai DI halaman formulanya sendiri, dan me-refresh
                  // halaman yang barusan dihapus cuma menghasilkan 404.
                  router.push("/formulas");
                })
              }
            >
              {pending ? "Menghapus…" : "Hapus permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
