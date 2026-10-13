"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, FlaskConical, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Notice } from "@/components/shared/primitives";
import { DiluteButton } from "./DiluteButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteVersion,
  duplicateVersion,
  markMixed,
} from "@/app/actions/versions";

const todayLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function VersionActions({
  formulaId,
  versionId,
  versionNo,
  hasLines,
  mixedAt,
  dilutedAt,
  evaluationCount,
  versionCount,
}: {
  formulaId: string;
  versionId: string;
  versionNo: number;
  hasLines: boolean;
  mixedAt: string | null;
  dilutedAt: string | null;
  evaluationCount: number;
  versionCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dupOpen, setDupOpen] = useState(false);
  const [mixOpen, setMixOpen] = useState(false);
  const [note, setNote] = useState("");
  const [mixDate, setMixDate] = useState(
    mixedAt ? mixedAt.slice(0, 10) : todayLocal(),
  );
  const [error, setError] = useState<string | null>(null);

  const doDuplicate = () => {
    if (!note.trim()) {
      setError(
        "Tulis dulu apa yang mau kamu ubah di versi baru ini. Catatan ini yang bikin kamu belajar.",
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await duplicateVersion(versionId, note.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`v${result.data.versionNo} dibuat dari v${versionNo}.`);
      setDupOpen(false);
      router.push(`/formulas/${formulaId}/edit?v=${result.data.versionId}`);
    });
  };

  const doMarkMixed = () => {
    setError(null);
    startTransition(async () => {
      // Jam 12.00 lokal supaya perhitungan umur maserasi tidak bergeser
      // sehari gara-gara zona waktu.
      const result = await markMixed(
        versionId,
        new Date(`${mixDate}T12:00:00`).toISOString(),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Ditandai sudah dicampur. Sekarang masuk antrean evaluasi.");
      setMixOpen(false);
      router.refresh();
    });
  };

  const doDelete = () => {
    if (
      !window.confirm(
        `Hapus v${versionNo} beserta semua barisnya? Tindakan ini tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteVersion(versionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`v${versionNo} dihapus.`);
      router.push(`/formulas/${formulaId}`);
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/formulas/${formulaId}/edit?v=${versionId}`}>Edit</Link>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setDupOpen(true)}
          disabled={!hasLines}
          title={
            hasLines ? undefined : "Versi ini masih kosong, belum ada yang disalin"
          }
        >
          <Copy className="size-3.5" />
          Duplikat jadi versi baru
        </Button>

        {/*
          Dua tahap berurutan: fase minyak dicampur dulu, istirahat, baru
          ethanol ditambahkan. Tombolnya menampilkan langkah BERIKUTNYA saja
          supaya urutannya tidak bisa dilewati tanpa sadar.
        */}
        {!mixedAt ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMixOpen(true)}
            disabled={!hasLines}
            title={hasLines ? undefined : "Versi ini masih kosong"}
          >
            <FlaskConical className="size-3.5" />
            Tandai sudah dicampur
          </Button>
        ) : (
          <DiluteButton
            versionId={versionId}
            label={`v${versionNo}`}
            mixedAt={mixedAt}
            dilutedAt={dilutedAt}
          />
        )}

        {hasLines && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/evaluations/new?version=${versionId}`}>Evaluasi</Link>
          </Button>
        )}

        {versionCount >= 2 && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/formulas/${formulaId}/compare`}>Compare</Link>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Aksi lain">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {mixedAt && (
              <DropdownMenuItem onClick={() => setMixOpen(true)}>
                Ubah tanggal campur
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/formulas/${formulaId}/settings`}>
                Ubah data formula
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={doDelete}
              disabled={evaluationCount > 0}
            >
              <Trash2 className="size-4" />
              {evaluationCount > 0
                ? "Tidak bisa dihapus (ada evaluasi)"
                : `Hapus v${versionNo}`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Duplikat v{versionNo} jadi versi baru</DialogTitle>
            <DialogDescription>
              Semua baris disalin beserta dilusi dan pelarutnya. Ini jalur untuk
              subtraction test: duplikat, hapus satu bahan, lalu bandingkan.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="dup-note" className="mb-1.5">
              Apa yang mau diubah? <span className="text-[var(--danger)]">*</span>
            </Label>
            <Textarea
              id="dup-note"
              rows={3}
              value={note}
              autoFocus
              placeholder='misal: "tanpa Bacdanol — mau lihat kontribusinya di drydown"'
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <Notice tone="danger">{error}</Notice>}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Batal</Button>
            </DialogClose>
            <Button onClick={doDuplicate} disabled={pending}>
              {pending ? "Membuat…" : "Buat versi baru"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mixOpen} onOpenChange={setMixOpen}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Kapan versi ini dicampur?</DialogTitle>
            <DialogDescription>
              Tanggal ini dipakai menghitung umur maserasi dan mengurutkan
              antrean &ldquo;menunggu dievaluasi&rdquo; di dashboard.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="mix-date" className="mb-1.5">
              Tanggal campur
            </Label>
            <Input
              id="mix-date"
              type="date"
              value={mixDate}
              max={todayLocal()}
              onChange={(e) => setMixDate(e.target.value)}
            />
          </div>

          {error && <Notice tone="danger">{error}</Notice>}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Batal</Button>
            </DialogClose>
            <Button onClick={doMarkMixed} disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
