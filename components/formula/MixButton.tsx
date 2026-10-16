"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Notice } from "@/components/shared/primitives";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markMixed } from "@/app/actions/versions";
import { T } from "@/lib/rules/thresholds";

const todayLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Menandai fase minyak sudah dicampur — langkah pertama protokol lab.
 *
 * Tanpa tanggal ini tidak ada yang bisa berjalan: tombol "Tandai diencerkan"
 * baru muncul setelahnya, dan evaluasi butuh tanggal encer. Tombol ini sempat
 * hilang saat tampilan v2 dibangun, dan selama itu tidak ada satu versi pun
 * yang bisa dinilai.
 *
 * Tanggalnya bisa diatur, karena racikan sering baru sempat dicatat besoknya.
 */
export function MixButton({
  versionId,
  label,
  mixedAt,
  dilutedAt,
}: {
  versionId: string;
  label: string;
  mixedAt: string | null;
  dilutedAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(
    mixedAt ? mixedAt.slice(0, 10) : todayLocal(),
  );
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      // Jam 12.00 lokal, sama dengan tanggal encer, supaya selisih keduanya
      // tidak bergeser sehari gara-gara zona waktu.
      const result = await markMixed(
        versionId,
        new Date(`${date}T12:00:00`).toISOString(),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        mixedAt
          ? "Tanggal campur diperbarui."
          : `Ditandai sudah dicampur. Oil rest ${T.minOilRestHours} jam mulai berjalan.`,
      );
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FlaskConical className="size-4" />
        {mixedAt ? "Ubah tanggal campur" : "Tandai dicampur"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Fase minyak {label} dicampur</DialogTitle>
            <DialogDescription>
              Konsentratnya sudah diracik, belum ketemu ethanol. Biarkan
              istirahat sekitar {T.minOilRestHours} jam supaya bahan-bahannya
              saling larut, lalu tandai diencerkan.
            </DialogDescription>
          </DialogHeader>

          {dilutedAt && (
            <Notice tone="info">
              Versi ini sudah diencerkan. Tanggal campur tidak boleh jatuh
              setelah tanggal encernya.
            </Notice>
          )}

          <div>
            <Label htmlFor={`mix-date-${versionId}`} className="mb-1.5">
              Tanggal pencampuran
            </Label>
            <Input
              id={`mix-date-${versionId}`}
              type="date"
              value={date}
              max={dilutedAt ? dilutedAt.slice(0, 10) : todayLocal()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {error && <Notice tone="danger">{error}</Notice>}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Batal</Button>
            </DialogClose>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
