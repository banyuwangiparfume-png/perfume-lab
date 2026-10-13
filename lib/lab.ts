import { T } from "./rules/thresholds";

/**
 * Protokol lab: dua masa istirahat yang tujuannya berbeda.
 *
 *   oil phase rest — dari `mixed_at`,   24–48 jam  — bahan larut antar sesamanya
 *                                                     sebelum ketemu ethanol
 *   maserasi       — dari `diluted_at`, 2–4 minggu — alcohol bite turun, kristal
 *                                                     larut, larutan stabil
 *
 * UMUR MASERASI SELALU DIHITUNG DARI `diluted_at`, TIDAK PERNAH DARI `mixed_at`.
 * Kalau salah pakai, angkanya selalu kelebihan beberapa hari dan perbandingan
 * antar versi jadi menyesatkan tanpa ada yang sadar.
 *
 * Fungsi di file ini murni dan client-safe — dipakai di dashboard, form
 * evaluasi, dan layar compare.
 */

const HOUR = 3_600_000;
const DAY = 86_400_000;

export function oilRestHours(
  mixedAt: string | null,
  now: number = Date.now(),
): number | null {
  if (!mixedAt) return null;
  return Math.max(0, Math.floor((now - new Date(mixedAt).getTime()) / HOUR));
}

export function macerationDays(
  dilutedAt: string | null,
  now: number = Date.now(),
): number | null {
  if (!dilutedAt) return null;
  return Math.max(0, Math.floor((now - new Date(dilutedAt).getTime()) / DAY));
}

export function macerationHours(
  dilutedAt: string | null,
  now: number = Date.now(),
): number | null {
  if (!dilutedAt) return null;
  return Math.max(0, Math.floor((now - new Date(dilutedAt).getTime()) / HOUR));
}

export type LabStageKey =
  | "belum_dicampur"
  | "oil_rest"
  | "siap_diencerkan"
  | "maserasi"
  | "siap_final";

export type LabStage = {
  key: LabStageKey;
  label: string;
  /** keterangan singkat berisi umurnya, untuk ditempel di samping label */
  detail: string;
};

/**
 * Tahap sebuah versi, diturunkan dari dua tanggal — bukan dari kolom status.
 *
 * `version_status` tetap draft/mixed/evaluated/locked seperti semula; tahap lab
 * sengaja tidak dijadikan status supaya satu versi bisa punya status
 * `evaluated` (hasil screening) dan tetap terbaca sedang maserasi menuju final.
 */
export function labStage(
  version: { mixed_at: string | null; diluted_at: string | null },
  now: number = Date.now(),
): LabStage {
  const days = macerationDays(version.diluted_at, now);
  if (days != null) {
    if (days >= T.minMacerationDays) {
      return {
        key: "siap_final",
        label: "Maserasi penuh",
        detail: `${days} hari sejak diencerkan`,
      };
    }
    return {
      key: "maserasi",
      label: "Maserasi",
      detail: days === 0 ? "diencerkan hari ini" : `hari ke-${days}`,
    };
  }

  const hours = oilRestHours(version.mixed_at, now);
  if (hours != null) {
    if (hours >= T.minOilRestHours) {
      return {
        key: "siap_diencerkan",
        label: "Siap diencerkan",
        detail: `fase minyak sudah ${formatAge(hours)}`,
      };
    }
    return {
      key: "oil_rest",
      label: "Fase minyak",
      detail: `baru ${hours} jam dari ${T.minOilRestHours} jam`,
    };
  }

  return {
    key: "belum_dicampur",
    label: "Belum dicampur",
    detail: "tanggal campur belum dicatat",
  };
}

/** "30 jam" di bawah dua hari, "3 hari" di atasnya — supaya tidak jadi "72 jam". */
export function formatAge(hours: number): string {
  if (hours < 48) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}

/**
 * Tujuan penilaian yang masuk akal untuk umur maserasi tertentu.
 * Dipakai sebagai nilai awal form — user tetap boleh menimpanya.
 */
export function defaultPurpose(
  days: number | null,
): "screening" | "final" {
  return days != null && days >= T.minMacerationDays ? "final" : "screening";
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I dan O dibuang: gampang tertukar dengan 1 dan 0

/**
 * Kode buta 3 huruf untuk ditulis di botol sampel.
 *
 * Memakai sumber acak kriptografis, bukan penghitung atau Math.random berurutan
 * — kode yang urutannya bisa ditebak membocorkan versi mana yang sedang dicium,
 * dan itu menghapus seluruh gunanya.
 */
export function generateBlindCode(length = 3): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  // Modulo bias diabaikan di sini: 256 % 24 memang tidak nol, tapi kode ini
  // hanya perlu tidak bisa ditebak oleh manusia yang memegang botolnya.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
