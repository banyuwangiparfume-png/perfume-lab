"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Input tag deskriptor dengan saran dari deskriptor yang pernah dipakai.
 *
 * Sarannya sengaja datang dari kosakata sendiri, bukan daftar bawaan yang
 * panjang: kosakata penciuman itu personal, dan daftar orang lain cuma bikin
 * user memilih kata yang bukan maksudnya.
 */
export function DescriptorTags({
  value,
  suggestions,
  onChange,
  id,
}: {
  value: string[];
  suggestions: string[];
  onChange: (next: string[]) => void;
  id?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || value.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const matching = draft.trim()
    ? suggestions
        .filter(
          (s) => s.includes(draft.trim().toLowerCase()) && !value.includes(s),
        )
        .slice(0, 6)
    : suggestions.filter((s) => !value.includes(s)).slice(0, 6);

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-soft)] px-2 py-0.5 text-[12px] font-medium text-[var(--brand)]">
                {tag}
                <button
                  type="button"
                  aria-label={`Hapus deskriptor ${tag}`}
                  onClick={() => remove(tag)}
                  className="hover:text-[var(--text)]"
                >
                  <X className="size-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Input
        id={id}
        value={draft}
        placeholder="creamy, woody, tajam… (Enter untuk tambah)"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
          if (e.key === "Backspace" && !draft && value.length) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />

      {matching.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {matching.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => add(s)}
                className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              >
                + {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
