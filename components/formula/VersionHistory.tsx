"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, GitCompare, History } from "lucide-react";
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
import { restoreVersionToDraft } from "@/app/actions/versions";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editorStore";

type VersionItem = {
  id: string;
  no: number;
  note: string | null;
  date: string;
};

/**
 * Riwayat versi yang bisa diakses, bukan cuma dicatat.
 *
 * Tiap versi bisa dibuka (isi + analisanya), dibandingkan dengan versi yang
 * sedang dilihat, atau dijadikan titik lanjut: isinya disalin ke draf, dan
 * begitu disimpan jadi versi BARU — riwayatnya tidak pernah ditimpa.
 */
export function VersionHistory({
  formulaId,
  versions,
  currentId,
  draftHasUnsaved,
}: {
  formulaId: string;
  versions: VersionItem[];
  /** versi yang sedang ditampilkan halaman */
  currentId: string;
  /** draf punya perubahan yang belum pernah disimpan sebagai versi */
  draftHasUnsaved: boolean;
}) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<VersionItem | null>(null);
  const [pending, start] = useTransition();
  const current = versions.find((v) => v.id === currentId);

  const restore = (v: VersionItem) =>
    start(async () => {
      const result = await restoreVersionToDraft(v.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Editor menyimpan draf di memori dan tidak memuat ulang kalau id
      // drafnya sama. Tanpa dikosongkan, editor menampilkan isi lama dan
      // autosave-nya menimpa balik hasil salinan ini.
      useEditorStore.setState({ versionId: "", dirty: false });
      toast.success(`Isi v${v.no} disalin ke draf. Simpan nanti jadi versi baru.`);
      setRestoring(null);
      router.push(`/formulas/${formulaId}/edit`);
    });

  return (
    <>
      <ul className="divide-y divide-[var(--border)]">
        {versions.map((v) => {
          const isCurrent = v.id === currentId;
          return (
            <li
              key={v.id}
              className={cn(
                "space-y-1 py-2.5 first:pt-0",
                isCurrent && "-mx-2 rounded-lg bg-[var(--surface-muted)] px-2 first:pt-2.5",
              )}
            >
              <Link
                href={`/formulas/${formulaId}?v=${v.id}`}
                className="flex items-start gap-3 hover:text-[var(--brand)]"
              >
                <span className="w-7 shrink-0 font-semibold">v{v.no}</span>
                <span className="min-w-0">
                  <span className="block text-[13px]">{v.note ?? "versi pertama"}</span>
                  <span className="block text-[11px] text-[var(--text-subtle)]">
                    {v.date}
                    {isCurrent && " · sedang dilihat"}
                  </span>
                </span>
              </Link>

              {/* Baris sendiri di bawah catatan: berdampingan, tombolnya menjepit
                  catatan versi jadi satu-dua kata per baris di layar sempit. */}
              <div className="-ml-2 flex flex-wrap gap-1 pl-10">
                {!isCurrent && (
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[12px]">
                    <Link href={`/formulas/${formulaId}?v=${v.id}`}>
                      <Eye className="size-3.5" />
                      Buka
                    </Link>
                  </Button>
                )}
                {!isCurrent && current && (
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[12px]">
                    <Link
                      href={`/formulas/${formulaId}/compare?ids=${[v, current]
                        .sort((a, b) => a.no - b.no)
                        .map((x) => x.id)
                        .join(",")}`}
                    >
                      <GitCompare className="size-3.5" />
                      Bandingkan dgn v{current.no}
                    </Link>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[12px]"
                  onClick={() => setRestoring(v)}
                >
                  <History className="size-3.5" />
                  Lanjutkan dari sini
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!restoring} onOpenChange={(o) => !o && setRestoring(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Lanjutkan dari v{restoring?.no}?</DialogTitle>
            <DialogDescription>
              Isi v{restoring?.no} disalin ke draf kerja, lalu editor dibuka.
              v{restoring?.no} sendiri tidak berubah — begitu disimpan, hasilnya
              jadi versi baru.
            </DialogDescription>
          </DialogHeader>
          {draftHasUnsaved && (
            <p className="rounded-lg bg-[var(--warn-soft)] px-3 py-2 text-[13px] leading-relaxed">
              Draf sekarang punya perubahan yang <strong>belum pernah disimpan</strong>{" "}
              sebagai versi, dan akan tertimpa. Kalau masih mau disimpan, buka
              editor dan Simpan versi dulu.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRestoring(null)}>
              Batal
            </Button>
            <Button type="button" disabled={pending} onClick={() => restoring && restore(restoring)}>
              {pending ? "Menyalin…" : "Salin ke draf & buka editor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
