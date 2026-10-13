"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { minutesLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { DescriptorTags } from "./DescriptorTags";

export type TimelinePoint = {
  minutes: number;
  dominantNote: string;
  descriptors: string[];
  intensity: number | null;
  note: string;
};

export const isPointBlank = (p: TimelinePoint) =>
  !p.dominantNote.trim() &&
  !p.note.trim() &&
  p.intensity == null &&
  p.descriptors.length === 0;

/**
 * Timeline vertikal, satu simpul per titik waktu.
 *
 * SIMPAN PARSIAL harus bisa: pengisian menit 5 sampai menit 360 memang
 * terpisah berjam-jam. Titik yang belum diisi tampil pucat dan dilewati saat
 * menyimpan — tombol simpan tidak pernah menunggu semuanya terisi.
 */
export function TimelineInput({
  points,
  suggestions,
  onChange,
}: {
  points: TimelinePoint[];
  suggestions: string[];
  onChange: (next: TimelinePoint[]) => void;
}) {
  const [customMinutes, setCustomMinutes] = useState("");

  const update = (minutes: number, patch: Partial<TimelinePoint>) =>
    onChange(
      points.map((p) => (p.minutes === minutes ? { ...p, ...patch } : p)),
    );

  const addCustom = () => {
    const minutes = Number(customMinutes);
    if (!Number.isInteger(minutes) || minutes < 0) return;
    if (points.some((p) => p.minutes === minutes)) return;
    onChange(
      [
        ...points,
        {
          minutes,
          dominantNote: "",
          descriptors: [],
          intensity: null,
          note: "",
        },
      ].sort((a, b) => a.minutes - b.minutes),
    );
    setCustomMinutes("");
  };

  return (
    <div className="space-y-4">
      <ol className="space-y-5 border-l-2 border-[var(--border)] pl-5">
        {points.map((point) => {
          const blank = isPointBlank(point);
          return (
            <li key={point.minutes} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-[26px] top-1 size-3 rounded-full border-2 border-[var(--surface)]",
                  blank
                    ? "bg-[var(--border-strong)]"
                    : "bg-[var(--brand)]",
                )}
              />

              <div className="mb-2 flex items-baseline gap-2">
                <p className="font-semibold">{minutesLabel(point.minutes)}</p>
                {blank && (
                  <span className="text-[12px] text-[var(--text-subtle)]">
                    belum dinilai
                  </span>
                )}
              </div>

              <div
                className={cn(
                  "space-y-3 rounded-lg border p-3",
                  blank
                    ? "border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50"
                    : "border-[var(--border)] bg-[var(--surface)]",
                )}
              >
                <div>
                  <Label
                    htmlFor={`dom-${point.minutes}`}
                    className="mb-1.5 text-[13px]"
                  >
                    Nada dominan
                  </Label>
                  <Input
                    id={`dom-${point.minutes}`}
                    value={point.dominantNote}
                    placeholder="misal: bergamot masih memimpin"
                    onChange={(e) =>
                      update(point.minutes, { dominantNote: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label
                    htmlFor={`desc-${point.minutes}`}
                    className="mb-1.5 text-[13px]"
                  >
                    Deskriptor
                  </Label>
                  <DescriptorTags
                    id={`desc-${point.minutes}`}
                    value={point.descriptors}
                    suggestions={suggestions}
                    onChange={(next) =>
                      update(point.minutes, { descriptors: next })
                    }
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <Label className="text-[13px]">Intensitas</Label>
                    <span className="numeric text-[13px] font-medium">
                      {point.intensity == null
                        ? "belum diisi"
                        : `${point.intensity}/10`}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[point.intensity ?? 5]}
                    onValueChange={([v]) =>
                      update(point.minutes, { intensity: v })
                    }
                    aria-label={`Intensitas di ${minutesLabel(point.minutes)}`}
                  />
                  {point.intensity != null && (
                    <button
                      type="button"
                      onClick={() => update(point.minutes, { intensity: null })}
                      className="mt-1 text-[11px] text-[var(--text-subtle)] underline"
                    >
                      kosongkan intensitas
                    </button>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor={`note-${point.minutes}`}
                    className="mb-1.5 text-[13px]"
                  >
                    Catatan
                  </Label>
                  <Textarea
                    id={`note-${point.minutes}`}
                    rows={2}
                    value={point.note}
                    onChange={(e) =>
                      update(point.minutes, { note: e.target.value })
                    }
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex items-end gap-2">
        <div className="w-[160px]">
          <Label htmlFor="custom-minutes" className="mb-1.5 text-[13px]">
            Titik waktu lain (menit)
          </Label>
          <Input
            id="custom-minutes"
            inputMode="numeric"
            className="numeric"
            value={customMinutes}
            placeholder="720"
            onChange={(e) => setCustomMinutes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
        </div>
        <Button type="button" variant="outline" onClick={addCustom}>
          <Plus className="size-4" />
          Tambah titik
        </Button>
      </div>
    </div>
  );
}
