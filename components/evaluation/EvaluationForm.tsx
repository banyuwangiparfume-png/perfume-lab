"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dices } from "lucide-react";
import { toast } from "sonner";
import { Card, CardTitle, Notice } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { createEvaluation } from "@/app/actions/evaluations";
import {
  EVAL_MEDIA,
  EVAL_PURPOSES,
  TIMELINE_PRESETS,
  TRANSITION_VERDICTS,
} from "@/lib/constants";
import { defaultPurpose, generateBlindCode } from "@/lib/lab";
import { T } from "@/lib/rules/thresholds";
import type {
  EvalMediumEnum,
  EvalPurposeEnum,
  TransitionVerdictEnum,
} from "@/lib/supabase/database.types";
import {
  isPointBlank,
  TimelineInput,
  type TimelinePoint,
} from "./TimelineInput";

export type VersionChoice = {
  versionId: string;
  formulaId: string;
  label: string;
  macerationDays: number;
  macerationHours: number;
};

const NONE = "none";

const todayLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function EvaluationForm({
  versions,
  initialVersionId,
  initialPurpose,
  defaultEvaluatorName,
  descriptorSuggestions,
  previousEvaluators,
}: {
  versions: VersionChoice[];
  initialVersionId?: string;
  initialPurpose?: EvalPurposeEnum;
  defaultEvaluatorName: string;
  descriptorSuggestions: string[];
  previousEvaluators: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [versionId, setVersionId] = useState(
    initialVersionId ?? versions[0]?.versionId ?? "",
  );
  const chosen = versions.find((v) => v.versionId === versionId);

  const [evaluatorName, setEvaluatorName] = useState(defaultEvaluatorName);
  const [purpose, setPurpose] = useState<EvalPurposeEnum>(
    initialPurpose ?? defaultPurpose(chosen?.macerationDays ?? null),
  );
  const [medium, setMedium] = useState<EvalMediumEnum>("blotter");
  const [dilutedIn, setDilutedIn] = useState("");
  const [maceration, setMaceration] = useState(
    chosen ? String(chosen.macerationDays) : "",
  );
  const [blindCode, setBlindCode] = useState("");
  const [evaluatedAt, setEvaluatedAt] = useState(todayLocal());

  const [points, setPoints] = useState<TimelinePoint[]>(
    TIMELINE_PRESETS.map((p) => ({
      minutes: p.minutes,
      dominantNote: "",
      descriptors: [],
      intensity: null,
      note: "",
    })),
  );

  const [overall, setOverall] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<string>(NONE);
  const [error, setError] = useState<string | null>(null);

  /** Ganti versi = ganti umur maserasi, dan tujuan default ikut menyesuaikan. */
  const pickVersion = (id: string) => {
    setVersionId(id);
    const next = versions.find((v) => v.versionId === id);
    if (!next) return;
    setMaceration(String(next.macerationDays));
    setPurpose(defaultPurpose(next.macerationDays));
  };

  const days = Number(maceration.replace(",", "."));
  const macerationKnown = maceration.trim() !== "" && Number.isFinite(days);

  // Peringatan protokol — memberi tahu, tidak memblokir.
  const finalTooEarly =
    purpose === "final" && macerationKnown && days < T.minMacerationDays;
  const tooFreshHours =
    chosen != null && chosen.macerationHours < T.minScreeningHours
      ? chosen.macerationHours
      : null;

  const filledCount = points.filter((p) => !isPointBlank(p)).length;

  const submit = () => {
    if (!versionId) {
      setError("Pilih dulu versi yang mau dinilai.");
      return;
    }
    if (!evaluatorName.trim()) {
      setError("Nama penilai wajib diisi.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await createEvaluation({
        formula_version_id: versionId,
        evaluator_name: evaluatorName.trim(),
        purpose,
        medium,
        diluted_in: dilutedIn || null,
        maceration_days: macerationKnown ? Math.round(days) : null,
        blind_code: blindCode.trim() || null,
        evaluated_at: new Date(`${evaluatedAt}T12:00:00`).toISOString(),
        overall_note: overall || null,
        rating,
        transition_verdict:
          verdict === NONE ? null : (verdict as TransitionVerdictEnum),
        points: points
          .filter((p) => !isPointBlank(p))
          .map((p) => ({
            minutes_elapsed: p.minutes,
            dominant_note: p.dominantNote || null,
            descriptors: p.descriptors,
            intensity: p.intensity,
            note: p.note || null,
          })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Evaluasi tersimpan.");
      router.push(
        chosen
          ? `/formulas/${chosen.formulaId}?v=${versionId}`
          : `/evaluations/${result.data.evaluationId}`,
      );
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-5">
        <Card>
          <CardTitle>1. Konteks</CardTitle>

          <div className="space-y-4">
            <div>
              <Label className="mb-1.5">Versi yang dinilai</Label>
              <Select value={versionId} onValueChange={pickVersion}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih versi" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.versionId} value={v.versionId}>
                      {v.label}
                      <span className="text-[var(--text-subtle)]">
                        {" · maserasi "}
                        {v.macerationDays} hari
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tooFreshHours != null && (
              <Notice tone="warn">
                Baru {tooFreshHours} jam setelah diencerkan. Alcohol bite masih
                tinggi, hasilnya bisa menyesatkan — biasanya tunggu minimal{" "}
                {T.minScreeningHours} jam.
              </Notice>
            )}

            {previousEvaluators.length > 0 && (
              <Notice tone="info">
                Versi ini sudah dinilai oleh{" "}
                <strong>{previousEvaluators.join(", ")}</strong>. Jangan lihat
                catatannya dulu sebelum kamu selesai menilai sendiri — catatan
                mereka baru muncul setelah evaluasi ini disimpan.
              </Notice>
            )}

            <div>
              <Label htmlFor="evaluator" className="mb-1.5">
                Nama penilai <span className="text-[var(--danger)]">*</span>
              </Label>
              <Input
                id="evaluator"
                value={evaluatorName}
                onChange={(e) => setEvaluatorName(e.target.value)}
              />
              <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                Bisa nama orang lain. Sebagian orang tidak bisa mencium molekul
                musk atau sandalwood sintetis tertentu, jadi penilaian satu
                hidung tidak cukup.
              </p>
            </div>

            <div>
              <Label className="mb-1.5">Tujuan penilaian</Label>
              <RadioGroup
                value={purpose}
                onValueChange={(v) => setPurpose(v as EvalPurposeEnum)}
                className="space-y-2"
              >
                {EVAL_PURPOSES.map((p) => (
                  <div key={p.value} className="flex items-start gap-2">
                    <RadioGroupItem
                      value={p.value}
                      id={`purpose-${p.value}`}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor={`purpose-${p.value}`}
                      className="block font-normal"
                    >
                      <span className="text-[13px] font-medium">{p.label}</span>
                      <span className="mt-0.5 block text-[12px] text-[var(--text-subtle)]">
                        {p.hint}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {finalTooEarly && (
                <Notice tone="warn" className="mt-2">
                  Maserasi baru {Math.round(days)} hari. Penilaian final
                  biasanya menunggu minimal {T.minMacerationDays} hari —
                  alcohol bite belum turun. Tidak diblokir, tapi hasilnya belum
                  mewakili apa yang akan diterima pembeli.
                </Notice>
              )}
            </div>

            <div>
              <Label className="mb-1.5">Media</Label>
              <RadioGroup
                value={medium}
                onValueChange={(v) => setMedium(v as EvalMediumEnum)}
                className="flex gap-4"
              >
                {EVAL_MEDIA.map((m) => (
                  <div key={m.value} className="flex items-center gap-2">
                    <RadioGroupItem value={m.value} id={`medium-${m.value}`} />
                    <Label
                      htmlFor={`medium-${m.value}`}
                      className="text-[13px] font-normal"
                    >
                      {m.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="diluted" className="mb-1.5">
                  Diencerkan dalam
                </Label>
                <Input
                  id="diluted"
                  value={dilutedIn}
                  placeholder="20% in ethanol"
                  onChange={(e) => setDilutedIn(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="maceration" className="mb-1.5">
                  Umur maserasi (hari)
                </Label>
                <Input
                  id="maceration"
                  inputMode="numeric"
                  className="numeric"
                  value={maceration}
                  onChange={(e) => setMaceration(e.target.value)}
                />
                <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                  Terisi otomatis dari tanggal pengenceran.
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="blind-code" className="mb-1.5">
                Kode buta
              </Label>
              <div className="flex gap-2">
                <Input
                  id="blind-code"
                  value={blindCode}
                  placeholder="kosongkan kalau menilai terbuka"
                  maxLength={12}
                  onChange={(e) =>
                    setBlindCode(e.target.value.toUpperCase())
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBlindCode(generateBlindCode())}
                >
                  <Dices className="size-4" />
                  Buatkan kode
                </Button>
              </div>
              <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                Tulis kode ini di botol sampel, lalu nilai tanpa tahu versinya.
                Penilai yang tahu mana versi &ldquo;perbaikan&rdquo; cenderung
                menemukan perbaikan itu.
              </p>
            </div>

            <div>
              <Label htmlFor="evaluated-at" className="mb-1.5">
                Tanggal evaluasi
              </Label>
              <Input
                id="evaluated-at"
                type="date"
                value={evaluatedAt}
                max={todayLocal()}
                onChange={(e) => setEvaluatedAt(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>3. Penutup</CardTitle>

          <div className="space-y-4">
            <div>
              <Label htmlFor="overall" className="mb-1.5">
                Kesan keseluruhan
              </Label>
              <Textarea
                id="overall"
                rows={4}
                value={overall}
                onChange={(e) => setOverall(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <Label>Rating</Label>
                <span className="numeric text-[13px] font-medium">
                  {rating == null ? "belum diisi" : `${rating}/5`}
                </span>
              </div>
              <Slider
                min={1}
                max={5}
                step={1}
                value={[rating ?? 3]}
                onValueChange={([v]) => setRating(v)}
                aria-label="Rating keseluruhan"
              />
              {rating != null && (
                <button
                  type="button"
                  onClick={() => setRating(null)}
                  className="mt-1 text-[11px] text-[var(--text-subtle)] underline"
                >
                  kosongkan rating
                </button>
              )}
            </div>

            <div>
              <Label className="mb-1.5">Transisi</Label>
              <RadioGroup
                value={verdict}
                onValueChange={setVerdict}
                className="space-y-1.5"
              >
                {TRANSITION_VERDICTS.map((v) => (
                  <div key={v.value} className="flex items-center gap-2">
                    <RadioGroupItem value={v.value} id={`verdict-${v.value}`} />
                    <Label
                      htmlFor={`verdict-${v.value}`}
                      className="text-[13px] font-normal"
                    >
                      {v.label}
                    </Label>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={NONE} id="verdict-none" />
                  <Label
                    htmlFor="verdict-none"
                    className="text-[13px] font-normal text-[var(--text-muted)]"
                  >
                    belum bisa menilai
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </Card>

        {error && <Notice tone="danger">{error}</Notice>}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan evaluasi"}
          </Button>
          <p className="text-[12px] text-[var(--text-subtle)]">
            {filledCount} dari {points.length} titik waktu terisi — simpan saja,
            sisanya bisa ditambah nanti.
          </p>
        </div>
      </div>

      <Card>
        <CardTitle hint="Isi sebagian lalu kembali lagi nanti. Pengisian menit 5 sampai menit 360 memang terpisah berjam-jam.">
          2. Titik waktu
        </CardTitle>
        <TimelineInput
          points={points}
          suggestions={descriptorSuggestions}
          onChange={setPoints}
        />
      </Card>
    </div>
  );
}
