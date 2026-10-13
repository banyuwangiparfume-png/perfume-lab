import "server-only";

import { labStage, macerationDays, macerationHours, oilRestHours } from "../lab";
import { T } from "../rules/thresholds";
import type { CompareEvaluation } from "../rules/compare";
import { getOwnerId } from "../owner";
import { getDb } from "../supabase/db";
import type {
  EvaluationPointRow,
  EvaluationRow,
} from "../supabase/database.types";
import { versionLabel } from "./versions";

export type EvaluationDetail = EvaluationRow & {
  points: EvaluationPointRow[];
};

export async function listEvaluationsForVersion(
  versionId: string,
): Promise<EvaluationDetail[]> {
  const db = getDb();
  const { data, error } = await db
    .from("evaluations")
    .select("*, points:evaluation_points(*)")
    .eq("formula_version_id", versionId)
    .order("evaluated_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat evaluasi: ${error.message}`);

  return ((data ?? []) as unknown as EvaluationDetail[]).map((e) => ({
    ...e,
    points: e.points
      .slice()
      .sort((a, b) => a.minutes_elapsed - b.minutes_elapsed),
  }));
}

export async function getEvaluation(
  id: string,
): Promise<EvaluationDetail | null> {
  const db = getDb();
  const ownerId = await getOwnerId();
  const { data, error } = await db
    .from("evaluations")
    .select("*, points:evaluation_points(*)")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat evaluasi: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as EvaluationDetail;
  return {
    ...row,
    points: row.points
      .slice()
      .sort((a, b) => a.minutes_elapsed - b.minutes_elapsed),
  };
}

/**
 * Evaluasi yang mewakili sebuah versi di layar compare: yang paling akhir
 * dinilai.
 *
 * Kalau sebuah versi punya screening DAN final, yang terbaru (final) yang
 * dipakai — dan kalau versi lain cuma punya screening, Rule 8 akan
 * memperingatkan ketidaksetaraannya. Itu memang yang diinginkan.
 */
export function representativeEvaluation(
  evaluations: EvaluationRow[],
): CompareEvaluation | null {
  if (!evaluations.length) return null;
  const latest = evaluations.reduce((a, b) =>
    b.evaluated_at > a.evaluated_at ? b : a,
  );
  return {
    evaluatorName: latest.evaluator_name,
    purpose: latest.purpose,
    medium: latest.medium,
    dilutedIn: latest.diluted_in,
    macerationDays: latest.maceration_days,
    blindCode: latest.blind_code,
  };
}

export type LabQueueItem = {
  versionId: string;
  formulaId: string;
  formulaName: string;
  versionNo: number;
  label: string;
  mixedAt: string | null;
  dilutedAt: string | null;
  oilRestHours: number | null;
  macerationDays: number | null;
  /** keterangan siap pakai untuk baris antrean */
  detail: string;
};

export type LabQueue = {
  readyToDilute: LabQueueItem[];
  readyToScreen: LabQueueItem[];
  readyForFinal: LabQueueItem[];
  total: number;
};

type QueueRow = {
  id: string;
  version_no: number;
  mixed_at: string | null;
  diluted_at: string | null;
  formula: { id: string; name: string } | null;
  evaluations: { id: string; purpose: string }[];
};

/**
 * Antrean lab dashboard, dibagi tiga kelompok sesuai tahap.
 *
 * Ini panel terpenting di dashboard: masalah utama praktik lab bukan kurangnya
 * ide, tapi racikan yang dibuat lalu terlupakan.
 *
 * Versi yang baru dicampur beberapa jam TIDAK muncul di mana pun — memunculkan
 * hal yang belum bisa dikerjakan hanya bikin daftarnya penuh dan akhirnya
 * diabaikan.
 *
 * Ketiga kelompok dibuat saling lepas. Versi yang sudah diencerkan 20 hari dan
 * belum pernah dinilai memenuhi syarat screening maupun final; menampilkannya
 * dua kali cuma kebisingan, dan yang benar-benar pantas dikerjakan adalah
 * penilaian final. Jadi dia hanya muncul di kelompok final.
 */
export async function listLabQueue(): Promise<LabQueue> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("formula_versions")
    .select(
      `id, version_no, mixed_at, diluted_at,
       formula:formulas!inner(id, name, owner_id),
       evaluations(id, purpose)`,
    )
    .eq("formula.owner_id", ownerId)
    .not("mixed_at", "is", null);

  if (error) throw new Error(`Gagal memuat antrean lab: ${error.message}`);

  const now = Date.now();
  const rows = ((data ?? []) as unknown as QueueRow[]).filter((r) => r.formula);

  const toItem = (row: QueueRow, detail: string): LabQueueItem => ({
    versionId: row.id,
    formulaId: row.formula!.id,
    formulaName: row.formula!.name,
    versionNo: row.version_no,
    label: versionLabel(row.formula!.name, row.version_no),
    mixedAt: row.mixed_at,
    dilutedAt: row.diluted_at,
    oilRestHours: oilRestHours(row.mixed_at, now),
    macerationDays: macerationDays(row.diluted_at, now),
    detail,
  });

  const readyToDilute: LabQueueItem[] = [];
  const readyToScreen: LabQueueItem[] = [];
  const readyForFinal: LabQueueItem[] = [];

  for (const row of rows) {
    const stage = labStage(row, now);

    if (!row.diluted_at) {
      // Fase minyak. Baru layak diencerkan setelah bahannya larut sempurna
      // antar sesamanya.
      if (stage.key === "siap_diencerkan") {
        readyToDilute.push(
          toItem(row, `${stage.detail}, siap dicampur ethanol`),
        );
      }
      continue;
    }

    const days = macerationDays(row.diluted_at, now)!;
    const hours = macerationHours(row.diluted_at, now)!;
    const hasAny = row.evaluations.length > 0;
    const hasFinal = row.evaluations.some((e) => e.purpose === "final");

    if (days >= T.minMacerationDays) {
      if (!hasFinal) {
        readyForFinal.push(
          toItem(row, `maserasi ${days} hari, siap dinilai final`),
        );
      }
      continue;
    }

    if (hours >= T.minScreeningHours && !hasAny) {
      readyToScreen.push(
        toItem(
          row,
          days === 0
            ? `sudah ${hours} jam sejak diencerkan, siap discreening`
            : `sudah ${days} hari sejak diencerkan, siap discreening`,
        ),
      );
    }
  }

  // Paling lama menunggu di atas, di tiap kelompok.
  const byOldest = (key: "mixedAt" | "dilutedAt") =>
    (a: LabQueueItem, b: LabQueueItem) =>
      (a[key] ?? "").localeCompare(b[key] ?? "");

  readyToDilute.sort(byOldest("mixedAt"));
  readyToScreen.sort(byOldest("dilutedAt"));
  readyForFinal.sort(byOldest("dilutedAt"));

  return {
    readyToDilute,
    readyToScreen,
    readyForFinal,
    total:
      readyToDilute.length + readyToScreen.length + readyForFinal.length,
  };
}

export type EvaluableVersion = {
  versionId: string;
  formulaId: string;
  label: string;
  dilutedAt: string;
  macerationDays: number;
  macerationHours: number;
};

/**
 * Versi yang bisa dinilai: yang sudah DIENCERKAN.
 *
 * Fase minyak yang belum ketemu ethanol belum mewakili apa pun yang akan
 * dicium pemakai, jadi menilainya di tahap itu cuma menghasilkan catatan yang
 * tidak bisa dibandingkan dengan apa-apa.
 */
export async function listEvaluableVersions(): Promise<EvaluableVersion[]> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("formula_versions")
    .select(
      `id, version_no, diluted_at, formula:formulas!inner(id, name, owner_id)`,
    )
    .eq("formula.owner_id", ownerId)
    .not("diluted_at", "is", null)
    .order("diluted_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat daftar racikan: ${error.message}`);

  const now = Date.now();
  type Row = {
    id: string;
    version_no: number;
    diluted_at: string;
    formula: { id: string; name: string } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.formula)
    .map((r) => ({
      versionId: r.id,
      formulaId: r.formula!.id,
      label: versionLabel(r.formula!.name, r.version_no),
      dilutedAt: r.diluted_at,
      macerationDays: macerationDays(r.diluted_at, now)!,
      macerationHours: macerationHours(r.diluted_at, now)!,
    }));
}

/**
 * Deskriptor yang pernah dipakai, untuk saran di input tag.
 * Membangun kosakata sendiri lebih berguna daripada daftar bawaan yang panjang.
 */
export async function listUsedDescriptors(): Promise<string[]> {
  const db = getDb();
  const ownerId = await getOwnerId();

  const { data, error } = await db
    .from("evaluation_points")
    .select("descriptors, evaluation:evaluations!inner(owner_id)")
    .eq("evaluation.owner_id", ownerId);

  if (error) throw new Error(`Gagal memuat deskriptor: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as unknown as { descriptors: string[] }[]) {
    for (const d of row.descriptors ?? []) {
      const key = d.trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([d]) => d);
}

/**
 * Nama penilai yang sudah menilai versi ini — untuk memberi tahu bahwa versi
 * ini sudah dinilai orang lain, TANPA menampilkan catatannya. Catatan mereka
 * baru boleh muncul setelah evaluasi baru disimpan, supaya tidak membiaskan.
 */
export async function previousEvaluatorNames(
  versionId: string,
): Promise<string[]> {
  const db = getDb();
  const { data, error } = await db
    .from("evaluations")
    .select("evaluator_name")
    .eq("formula_version_id", versionId);
  if (error) throw new Error(`Gagal memuat penilai: ${error.message}`);
  return [...new Set((data ?? []).map((e) => e.evaluator_name))];
}
