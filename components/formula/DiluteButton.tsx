"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Droplets } from "lucide-react";
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
import { markDiluted } from "@/app/actions/versions";
import { formatAge, oilRestHours } from "@/lib/lab";
import { T } from "@/lib/rules/thresholds";

const todayLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Menandai ethanol sudah ditambahkan.
 *
 * Tanggal ini yang jadi titik nol maserasi — bukan tanggal pencampuran fase
 * minyak. Semua umur maserasi, antrean dashboard, dan Rule 8 bergantung ke
 * angka ini, jadi tanggalnya bisa dikoreksi kalau pengenceran terjadi kemarin
 * dan baru sempat dicatat hari ini.
 */
export function DiluteButton({
  versionId,
  label,
  mixedAt,
  dilutedAt,
  size = "sm",
  variant = "outline",
}: {
  versionId: string;
  label: string;
  mixedAt: string | null;
  dilutedAt?: string | null;
  size?: "sm" | "default";
  variant?: "outline" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(
    dilutedAt ? dilutedAt.slice(0, 10) : todayLocal(),
  );
  const [error, setError] = useState<string | null>(null);

  const restHours = oilRestHours(mixedAt);
  const tooEarly = restHours != null && restHours < T.minOilRestHours;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      // Jam 12.00 lokal supaya umur maserasi tidak bergeser sehari gara-gara
      // zona waktu.
      const result = await markDiluted(
        versionId,
        new Date(`${date}T12:00:00`).toISOString(),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Ditandai sudah diencerkan. Maserasi mulai dihitung.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Droplets className="size-3.5" />
        {dilutedAt ? "Ubah tanggal encer" : "Tandai diencerkan"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Ethanol ditambahkan ke {label}</DialogTitle>
            <DialogDescription>
              Dari tanggal ini maserasi mulai dihitung — bukan dari tanggal
              fase minyak dicampur.
            </DialogDescription>
          </DialogHeader>

          {restHours != null && (
            <Notice tone={tooEarly ? "warn" : "info"}>
              {tooEarly ? (
                <>
                  Fase minyak baru {restHours} jam dari {T.minOilRestHours} jam
                  yang disarankan. Bahan mungkin belum larut sempurna antar
                  sesamanya. Tidak diblokir — tapi catat saja kalau hasilnya
                  nanti terasa aneh.
                </>
              ) : (
                <>Fase minyak sudah {formatAge(restHours)}. Aman diencerkan.</>
              )}
            </Notice>
          )}

          <div>
            <Label htmlFor={`dilute-date-${versionId}`} className="mb-1.5">
              Tanggal pengenceran
            </Label>
            <Input
              id={`dilute-date-${versionId}`}
              type="date"
              value={date}
              max={todayLocal()}
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
