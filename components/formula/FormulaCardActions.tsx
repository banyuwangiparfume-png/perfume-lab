"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
}: {
  id: string;
  name: string;
  versionCount: number;
  archived: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

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
