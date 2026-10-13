"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FoForm } from "./FoForm";

export function NewFoDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          FO baru
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>FO baru</DialogTitle>
          <DialogDescription>
            Bibit parfum jadi yang kamu pakai. Didata terpisah dari raw material
            karena sifatnya berbeda — FO adalah parfum lengkap, bukan molekul
            tunggal.
          </DialogDescription>
        </DialogHeader>
        <FoForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
