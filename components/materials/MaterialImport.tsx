"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Notice } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  importMaterialsCsv,
  validateMaterialsCsv,
  type ImportSummary,
} from "@/app/actions/materials";
import {
  failuresToCsv,
  guessColumnMap,
  MATERIAL_COLUMNS,
  type MaterialColumn,
} from "@/lib/csv/parseMaterials";
import { cn } from "@/lib/utils";

type Step = "upload" | "map" | "review" | "done";

const SKIP = "__skip__";

const COLUMN_LABELS: Record<MaterialColumn, string> = {
  name: "Nama (wajib)",
  synonym: "Sinonim",
  cas_number: "CAS number (kunci pencocokan)",
  family: "Family",
  category: "Kategori",
  odour_profile: "Odour profile",
  function_category: "Kategori fungsi",
  odor_impact: "Odor impact",
  tgsc_url: "TGSC URL",
  price_5g: "Harga 5 g",
  price_10g: "Harga 10 g",
  price_50g: "Harga 50 g",
  price_100g: "Harga 100 g",
  price_500g: "Harga 500 g",
};

/**
 * Import pricelist, empat langkah — jangan dipotong.
 *
 * Pemetaan kolom ditebak dari nama header tapi tetap bisa diubah, karena
 * header pricelist supplier tidak pernah konsisten. Ringkasan validasi
 * ditampilkan SEBELUM apa pun ditulis ke database.
 */
export function MaterialImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columnMap, setColumnMap] = useState<
    Partial<Record<MaterialColumn, string>>
  >({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setColumnMap({});
    setSummary(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (file: File) => {
    setError(null);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        if (!result.data.length) {
          setError(
            "File-nya terbaca tapi tidak ada baris data di dalamnya. Pastikan baris pertama berisi nama kolom.",
          );
          return;
        }
        const fields = result.meta.fields ?? Object.keys(result.data[0]);
        setFileName(file.name);
        setHeaders(fields);
        setRows(result.data);
        setColumnMap(guessColumnMap(fields));
        setStep("map");
      },
      error: (err) =>
        setError(`File tidak bisa dibaca: ${err.message}`),
    });
  };

  const runValidation = () => {
    if (!columnMap.name) {
      setError(
        "Kolom nama belum dipetakan. Tanpa nama, barisnya tidak bisa diimpor.",
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await validateMaterialsCsv(rows, columnMap);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.data);
      setStep("review");
    });
  };

  const runImport = () => {
    setError(null);
    startTransition(async () => {
      const result = await importMaterialsCsv(rows, columnMap);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.data);
      setStep("done");
      toast.success(
        `${result.data.created} bahan baru, ${result.data.updated} di-update.`,
      );
      router.refresh();
    });
  };

  const downloadFailures = () => {
    if (!summary?.failures.length) return;
    const blob = new Blob([failuresToCsv(summary.failures)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gagal-${fileName || "import"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2 text-[12px]">
        {(
          [
            ["upload", "1. Upload"],
            ["map", "2. Pemetaan kolom"],
            ["review", "3. Validasi"],
            ["done", "4. Selesai"],
          ] as const
        ).map(([key, title]) => (
          <li
            key={key}
            className={cn(
              "rounded-md px-2 py-1 font-medium",
              step === key
                ? "bg-[var(--cta)] text-white"
                : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
            )}
          >
            {title}
          </li>
        ))}
      </ol>

      {step === "upload" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)]/40 px-6 py-10 text-center"
        >
          <Upload className="size-6 text-[var(--text-subtle)]" />
          <div>
            <p className="font-medium">Tarik file .csv ke sini</p>
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              Kolom yang dikenali: name, synonym, cas_number, family, category,
              odour_profile, function_category, odor_impact, tgsc_url, dan harga
              tier 5/10/50/100/500 g.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button type="button" onClick={() => inputRef.current?.click()}>
            Pilih file
          </Button>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--text-muted)]">
            <strong>{fileName}</strong> &middot; {rows.length} baris data
            terdeteksi. Tebakan pemetaan di bawah bisa diubah.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {MATERIAL_COLUMNS.map((column) => (
              <div key={column}>
                <Label className="mb-1.5 text-[13px]">
                  {COLUMN_LABELS[column]}
                </Label>
                <Select
                  value={columnMap[column] ?? SKIP}
                  onValueChange={(v) =>
                    setColumnMap((prev) => {
                      const next = { ...prev };
                      if (v === SKIP) delete next[column];
                      else next[column] = v;
                      return next;
                    })
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKIP}>
                      &mdash; tidak dipakai
                    </SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium">10 baris pertama</p>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-[12px]">
                <thead className="bg-[var(--surface-muted)] text-[var(--text-muted)]">
                  <tr>
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-2 py-1.5 text-left font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      {headers.map((h) => (
                        <td
                          key={h}
                          className="max-w-[200px] truncate px-2 py-1.5"
                        >
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && <Notice tone="danger">{error}</Notice>}

          <div className="flex gap-2">
            <Button type="button" onClick={runValidation} disabled={pending}>
              {pending ? "Memeriksa…" : "Periksa"}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Ganti file
            </Button>
          </div>
        </div>
      )}

      {(step === "review" || step === "done") && summary && (
        <div className="space-y-4">
          <div className="rounded-lg bg-[var(--surface-muted)] p-4 font-mono text-[13px] leading-relaxed">
            <p>{summary.read} baris terbaca</p>
            <p>&rarr; {summary.created} baru</p>
            <p>&rarr; {summary.updated} update (cocok lewat CAS atau nama)</p>
            <p>&rarr; {summary.priceRows} baris harga</p>
            <p
              className={
                summary.failures.length ? "text-[var(--danger)]" : undefined
              }
            >
              &rarr; {summary.failures.length} gagal
            </p>
          </div>

          {summary.failures.length > 0 && (
            <div className="space-y-2">
              <ul className="max-h-[200px] space-y-1 overflow-y-auto rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3 font-mono text-[12px]">
                {summary.failures.slice(0, 50).map((f) => (
                  <li key={`${f.line}-${f.reason}`}>
                    baris {f.line} : {f.reason}
                  </li>
                ))}
                {summary.failures.length > 50 && (
                  <li className="text-[var(--text-muted)]">
                    …dan {summary.failures.length - 50} lagi
                  </li>
                )}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadFailures}
              >
                <Download className="size-3.5" />
                Unduh baris gagal sebagai CSV
              </Button>
            </div>
          )}

          {step === "review" && (
            <>
              <Notice tone="info">
                Nilai koreksi impact, alasan koreksi, dan catatan pribadi kamu
                tidak akan tertimpa — kolom itu tidak pernah ikut dikirim saat
                import. Kolom impact yang kosong di file tetap disimpan sebagai
                kosong, bukan diisi 0.
              </Notice>

              {error && <Notice tone="danger">{error}</Notice>}

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={runImport}
                  disabled={pending || summary.created + summary.updated === 0}
                >
                  {pending
                    ? "Mengimpor…"
                    : `Jalankan import (${summary.created + summary.updated} baris)`}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep("map")}>
                  Kembali ke pemetaan
                </Button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="flex gap-2">
              <Notice tone="ok" className="flex-1">
                Import selesai. Menjalankan file yang sama lagi tidak akan
                membuat duplikat — pencocokannya pakai CAS number.
              </Notice>
              <Button type="button" variant="outline" onClick={reset}>
                Import file lain
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
