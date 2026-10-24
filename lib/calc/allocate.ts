import { round5, sum, type Line, type Pyramid, type Tier } from "./types";

/**
 * Pembagian persen di dalam SATU tier.
 *
 * Semua operasi editor bermuara ke sini. Fungsi murni dan immutable — editor
 * memanggilnya, menyimpan hasilnya ke store, lalu merender. Tidak ada rumus
 * pembagian yang ditulis di komponen React.
 *
 * Gembok (`locked`) adalah inti mekanismenya: baris terkunci dipatok user dan
 * tidak pernah berubah sendiri; sisa target dibagi rata ke baris terbuka.
 */

/** Toleransi perbandingan persen. Di bawah ini dianggap sama. */
export const PCT_EPSILON = 0.01;

/**
 * Membagi ulang baris TERBUKA supaya total tier tepat sama dengan target.
 *
 * Sisa pembulatan diberikan ke baris terbuka TERAKHIR, bukan dibagi rata —
 * supaya totalnya tepat, bukan "99,99998%". Target 10% dengan 3 baris terbuka
 * menghasilkan 3,33333 / 3,33333 / 3,33334.
 */
export function allocateTier(lines: Line[], target: number): Line[] {
  const unlockedIdx = lines
    .map((l, i) => (l.locked ? -1 : i))
    .filter((i) => i >= 0);

  if (unlockedIdx.length === 0) return lines.map((l) => ({ ...l }));

  const lockedSum = sum(lines.filter((l) => l.locked).map((l) => l.pct));
  // Sisa negatif tidak pernah jadi persen negatif — baris terbuka cuma nol.
  // Kelebihannya ditampilkan sebagai badge oleh tierStatus().
  const remaining = Math.max(0, target - lockedSum);

  const share = round5(remaining / unlockedIdx.length);
  const next = lines.map((l) => ({ ...l }));

  unlockedIdx.forEach((idx, k) => {
    next[idx].pct =
      k === unlockedIdx.length - 1
        ? round5(remaining - share * (unlockedIdx.length - 1))
        : share;
  });

  return next;
}

/** Baris baru selalu masuk TERBUKA, supaya langsung ikut pembagian rata. */
export function addLine(
  lines: Line[],
  newLine: Line,
  target: number,
): Line[] {
  return allocateTier([...lines, { ...newLine, locked: false }], target);
}

/**
 * Target tier: dari piramida, atau 100 kalau mode piramida mati. Dipakai
 * store editor dan pratinjau "Turunkan" — satu rumus, supaya pratinjau
 * membagi ulang persen persis seperti editor.
 */
export function tierTarget(pyramid: Pyramid | null, tier: Tier): number {
  if (!pyramid) return 100;
  if (tier === "top") return pyramid.top;
  if (tier === "mid") return pyramid.mid;
  if (tier === "base") return pyramid.base;
  return 100;
}

/**
 * Mengetik persen = mengunci baris itu. Baris terbuka lain menyesuaikan.
 * Top 15% dengan Bergamot+DHM: ketik Bergamot 10 -> DHM otomatis jadi 5.
 */
export function editLinePct(
  lines: Line[],
  lineId: string,
  pct: number,
  target: number,
): Line[] {
  const next = lines.map((l) =>
    l.id === lineId ? { ...l, pct: round5(Math.max(0, pct)), locked: true } : l,
  );
  return allocateTier(next, target);
}

export function setLocked(
  lines: Line[],
  lineId: string,
  locked: boolean,
  target: number,
): Line[] {
  const next = lines.map((l) => (l.id === lineId ? { ...l, locked } : l));
  return allocateTier(next, target);
}

export function removeLine(
  lines: Line[],
  lineId: string,
  target: number,
): Line[] {
  return allocateTier(
    lines.filter((l) => l.id !== lineId),
    target,
  );
}

/** Semua baris dikali target/total, lalu dikunci semua. */
export function normalizeTier(lines: Line[], target: number): Line[] {
  const total = sum(lines.map((l) => l.pct));
  if (total <= 0) return spreadEven(lines, target);
  const factor = target / total;
  const next = lines.map((l) => ({
    ...l,
    pct: round5(l.pct * factor),
    locked: true,
  }));
  return absorbRounding(next, target);
}

/** User mengetik rasio "10 : 5" -> persen = target × rasio / Σ rasio. */
export function applyRatio(
  lines: Line[],
  ratios: Record<string, number>,
  target: number,
): Line[] {
  const totalRatio = sum(lines.map((l) => Math.max(0, ratios[l.id] ?? 0)));
  if (totalRatio <= 0) return lines.map((l) => ({ ...l }));
  const next = lines.map((l) => ({
    ...l,
    pct: round5((target * Math.max(0, ratios[l.id] ?? 0)) / totalRatio),
    locked: true,
  }));
  return absorbRounding(next, target);
}

/** Semua baris dibuka dan dibagi rata. */
export function spreadEven(lines: Line[], target: number): Line[] {
  return allocateTier(
    lines.map((l) => ({ ...l, locked: false })),
    target,
  );
}

/**
 * Target tier berubah (Top 15 -> 20): semua baris dikali 20/15, gembok TIDAK
 * berubah. Total piramida jadi 105% — itu urusan banner di header, bukan di
 * sini.
 */
export function scaleTier(
  lines: Line[],
  oldTarget: number,
  newTarget: number,
): Line[] {
  if (oldTarget <= 0) return spreadEven(lines, newTarget);
  const factor = newTarget / oldTarget;
  const next = lines.map((l) => ({ ...l, pct: round5(l.pct * factor) }));
  // Hanya baris terbuka yang boleh menyerap sisa pembulatan; kalau semuanya
  // terkunci, biarkan apa adanya — user yang memutuskan.
  return next.some((l) => !l.locked)
    ? allocateTier(next, newTarget)
    : absorbRounding(next, newTarget);
}

/** Baris pindah tier dengan persennya, terkunci. Kedua tier dihitung ulang. */
export function moveLine(
  fromLines: Line[],
  toLines: Line[],
  lineId: string,
  fromTarget: number,
  toTarget: number,
  toTier: Line["tier"],
): { from: Line[]; to: Line[] } {
  const moving = fromLines.find((l) => l.id === lineId);
  if (!moving) return { from: fromLines, to: toLines };

  return {
    from: allocateTier(
      fromLines.filter((l) => l.id !== lineId),
      fromTarget,
    ),
    to: allocateTier(
      [...toLines, { ...moving, tier: toTier, locked: true }],
      toTarget,
    ),
  };
}

export type TierStatus = {
  filled: number;
  diff: number;
  ok: boolean;
};

export function tierStatus(lines: Line[], target: number): TierStatus {
  const filled = round5(sum(lines.map((l) => l.pct)));
  const diff = round5(filled - target);
  return { filled, diff, ok: Math.abs(diff) <= PCT_EPSILON };
}

/**
 * Menempelkan sisa pembulatan ke baris terakhir supaya total tepat sama
 * dengan target. Dipakai operasi yang mengunci semua baris, karena di situ
 * allocateTier tidak punya baris terbuka untuk menyerapnya.
 */
function absorbRounding(lines: Line[], target: number): Line[] {
  if (!lines.length) return lines;
  const total = sum(lines.map((l) => l.pct));
  const drift = round5(target - total);
  if (drift === 0) return lines;
  const next = lines.map((l) => ({ ...l }));
  const last = next.length - 1;
  next[last].pct = round5(Math.max(0, next[last].pct + drift));
  return next;
}
