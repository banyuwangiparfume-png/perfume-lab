"use client";

import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordAdjustment, recordPurchase } from "@/app/actions/stock";
import { fmtGram } from "@/lib/calc/format";
import { parseDecimal } from "@/lib/tiers";

export type EntryTarget = {
  id: string;
  kind: "rm" | "fo";
  name: string;
  onHand: number;
};

/**
 * Mencatat satu pergerakan stok.
 *
 * Pembelian dan penyesuaian sengaja dipisah, bukan digabung jadi "ubah jumlah".
 * Keduanya menjawab pertanyaan berbeda: yang satu "saya beli segini", yang lain
 * "ternyata isinya segini". Menggabungkannya membuat riwayatnya tidak bisa
 * dibaca lagi enam bulan kemudian.
 */
export function StockEntryDialog({
  target,
  mode,
  onClose,
}: {
  target: EntryTarget | null;
  mode: "pembelian" | "penyesuaian";
  onClose: () => void;
}) {
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const isPurchase = mode === "pembelian";

  const submit = () => {
    if (!target) return;
    const parsed = parseDecimal(qty);
    if (parsed == null || parsed === 0) {
      toast.error("Isi jumlahnya dulu.");
      return;
    }

    start(async () => {
      const payload = {
        target: { id: target.id, kind: target.kind },
        qtyG: parsed,
        note: note.trim() || null,
      };

      const result = isPurchase
        ? await recordPurchase({
            ...payload,
            unitPriceIdr: parseDecimal(price) ?? null,
          })
        : await recordAdjustment(payload);

      if (result.ok) {
        toast.success(
          isPurchase ? "Pembelian tercatat." : "Penyesuaian tercatat.",
        );
        setQty("");
        setPrice("");
        setNote("");
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPurchase ? "Catat pembelian" : "Sesuaikan stok"}
          </DialogTitle>
          <DialogDescription>
            {target?.name} — sisa sekarang {fmtGram(target?.onHand ?? 0)} g.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="qty" className="mb-1.5 text-[13px]">
              {isPurchase ? "Jumlah dibeli (g)" : "Selisih (g)"}
            </Label>
            <Input
              id="qty"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={isPurchase ? "50" : "-2,5"}
            />
            {!isPurchase && (
              <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                Tulis minus kalau isinya ternyata lebih sedikit dari catatan —
                tumpah, menguap, atau salah timbang.
              </p>
            )}
          </div>

          {isPurchase && (
            <div>
              <Label htmlFor="price" className="mb-1.5 text-[13px]">
                Harga per gram (Rp) — opsional
              </Label>
              <Input
                id="price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="12800"
              />
              <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                Yang benar-benar dibayar, bukan harga pricelist. Selisihnya baru
                kelihatan kalau yang dibayar ikut dicatat.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="note" className="mb-1.5 text-[13px]">
              Catatan
            </Label>
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isPurchase ? "beli di mana, batch berapa" : "kenapa berubah"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
