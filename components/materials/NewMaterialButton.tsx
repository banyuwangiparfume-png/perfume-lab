"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewMaterialForm } from "./NewMaterialForm";

/** Tombol + dialog bahan baru di halaman master bahan. */
export function NewMaterialButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Tambah bahan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[560px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bahan baru</DialogTitle>
            <DialogDescription>
              Untuk bahan yang tidak ada di pricelist. Bahan ini milikmu sendiri
              — import pricelist berikutnya tidak akan menyentuhnya.
            </DialogDescription>
          </DialogHeader>

          {open && (
            <NewMaterialForm
              onCancel={() => setOpen(false)}
              onCreated={(created) => {
                toast.success(`${created.material.name} masuk master bahan.`);
                setOpen(false);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
