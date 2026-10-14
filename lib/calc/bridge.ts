import { normalizeL2, tierVector } from "./aroma";
import { expand } from "./expand";
import { strengthOf } from "./strength";
import {
  TIERS,
  type ExpandedItem,
  type FacetVector,
  type FormulaContext,
  type Material,
  type Settings,
  type Tier,
} from "./types";

/** Vektor sudah L2, jadi dot product = cosine similarity. */
export function sim(a: FacetVector, b: FacetVector): number {
  let s = 0;
  for (const [f, w] of Object.entries(a)) s += w * (b[f] ?? 0);
  return s;
}

export type BridgeStatus = "connected" | "loose" | "gap";

export function bridgeStatus(
  s: number,
  thresholds: { connected: number; loose: number },
): BridgeStatus {
  if (s >= thresholds.connected) return "connected";
  if (s >= thresholds.loose) return "loose";
  return "gap";
}

export const STATUS_LABEL: Record<BridgeStatus, string> = {
  connected: "Nyambung",
  loose: "Renggang",
  gap: "Jurang",
};

/** Facet yang cukup kuat untuk dianggap mewakili arah sebuah vektor. */
const TOP_FACET_MIN = 0.3;

export function topFacets(v: FacetVector): Set<string> {
  return new Set(
    Object.entries(v)
      .filter(([, w]) => w >= TOP_FACET_MIN)
      .map(([f]) => f),
  );
}

export type BridgeSuggestion = {
  materialId: string;
  name: string;
  score: number;
  reason: string;
  ruleSource: "temen" | "klasik" | "saya" | null;
  functionCategory: string | null;
  impact: number | null;
  inStock: boolean;
  /** dosis awal yang disarankan, % dari formula */
  starterDose: number;
  /** tier tujuan kalau saran ini ditambahkan */
  tier: Tier;
};

/** Dosis awal: bahan kuat dimulai setengahnya, supaya tidak kedengaran sendiri. */
/** Dipakai kalau pemanggil tidak membawa settings. */
const DEFAULT_BRIDGE_STARTER = {
  targetStrengthPct: 3,
  minPct: 0.1,
  maxPct: 5,
};

/**
 * Langkah dosis yang wajar ditimbang dan dibaca manusia.
 *
 * Hasil hitungan sengaja dibulatkan ke salah satu angka ini. Nilai impact dari
 * supplier itu bucketed — puluhan bahan bernilai persis 100 — jadi dosis
 * seperti "0,37%" memberi kesan presisi yang datanya tidak punya.
 */
const DOSE_STEPS = [0.1, 0.25, 0.5, 1, 2, 5];

const snapToStep = (value: number): number =>
  DOSE_STEPS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  );

/**
 * Dosis awal bridger, dibalik dari porsi kekuatan yang dituju.
 *
 * Aturan lama cuma dua bucket: 1% kalau impact di bawah 150, selain itu 0,5%.
 * Di master Ecofragrantica itu berarti 244 dari 328 kandidat mendapat angka
 * yang sama persis, padahal impact di dalam bucket itu berentang 5 sampai 150
 * — tiga puluh kali lipat. Bahan selemah Iso E Super di 1% nyaris tidak
 * terdengar, jadi dosis awalnya tidak bisa dipakai menilai apa pun.
 *
 * Sekarang: berapa persen yang membuat bahan ini menyumbang kira-kira sekian
 * persen dari kekuatan formula. Bahan lemah dapat dosis besar, bahan kuat
 * dapat dosis kecil, dan angkanya ikut menyesuaikan formula — menjembatani
 * formula yang ramai butuh lebih banyak daripada yang sepi.
 *
 * Bahan TANPA data impact tetap 1%. Menebak di atas data kosong lebih buruk
 * daripada mengaku tidak tahu.
 */
export function starterDose(
  material: Material,
  opts: { totalScore?: number; settings?: Settings } = {},
): number {
  const cfg = opts.settings?.bridgeStarter ?? DEFAULT_BRIDGE_STARTER;
  const impact = material.impact;
  const total = opts.totalScore ?? 0;

  if (impact == null || impact <= 0 || total <= 0) return 1;

  const share = cfg.targetStrengthPct / 100;
  const dose = (share * total) / (impact * (1 - share));

  return snapToStep(Math.min(cfg.maxPct, Math.max(cfg.minPct, dose)));
}

const strongestShared = (x: FacetVector, v: FacetVector): string | null => {
  let best: string | null = null;
  let bestVal = 0;
  for (const [f, w] of Object.entries(x)) {
    const val = w * (v[f] ?? 0);
    if (val > bestVal) {
      bestVal = val;
      best = f;
    }
  }
  return best;
};

/**
 * Mencari bahan yang bisa menjembatani dua arah aroma.
 *
 * Skornya harmonic mean dari kemiripan ke kedua sisi — sengaja, bukan
 * rata-rata biasa: bahan yang sangat mirip ke satu sisi tapi tidak nyambung
 * sama sekali ke sisi lain BUKAN jembatan, dan harmonic mean menghukum itu
 * jauh lebih keras.
 *
 * Aturan jembatan (`bridge_rules`) memberi bonus karena dia pengetahuan nyata
 * dari hidung orang, bukan hasil hitung vektor — jadi dia boleh mengalahkan
 * kemiripan angka.
 */
export function suggestBridges(
  a: FacetVector,
  b: FacetVector,
  ctx: FormulaContext,
  excludeIds: Set<string>,
  opts: {
    onlyStock?: boolean;
    limit?: number;
    /** pasangan tier yang dijembatani, untuk menentukan tier tujuan per bahan */
    pair?: [Tier, Tier];
    /** jembatan dalam tier: tujuannya selalu tier itu sendiri */
    forceTier?: Tier;
    /** jumlah kekuatan formula sekarang, untuk membalik dosis awal */
    totalScore?: number;
  } = {},
): BridgeSuggestion[] {
  const { onlyStock = false, limit = 5 } = opts;
  const ta = topFacets(a);
  const tb = topFacets(b);

  const rulesByMaterial = new Map<string, typeof ctx.bridgeRules>();
  for (const rule of ctx.bridgeRules) {
    const list = rulesByMaterial.get(rule.materialId) ?? [];
    list.push(rule);
    rulesByMaterial.set(rule.materialId, list);
  }

  const out: BridgeSuggestion[] = [];

  for (const material of ctx.materials.values()) {
    if (!material.isBridgeCandidate) continue;
    if (excludeIds.has(material.id)) continue;
    if (onlyStock && !ctx.stock.has(material.id)) continue;
    if (!Object.keys(material.facets).length) continue;

    const sa = sim(material.facets, a);
    const sb = sim(material.facets, b);

    const rule = (rulesByMaterial.get(material.id) ?? []).find(
      (r) =>
        (ta.has(r.facetA) && tb.has(r.facetB)) ||
        (ta.has(r.facetB) && tb.has(r.facetA)),
    );

    // Tanpa aturan pendukung, bahan yang nyaris tidak nyambung ke salah satu
    // sisi bukan kandidat — menampilkannya cuma bikin daftar penuh.
    if (!rule && (sa < 0.15 || sb < 0.15)) continue;

    let score = sa + sb ? (2 * sa * sb) / (sa + sb) : 0;
    if (rule) score = Math.max(score, 0.3) + 0.3;
    if ((material.functionCategory ?? "").toLowerCase() === "bridger") {
      score += 0.05;
    }
    if ((material.impact ?? 0) > 500) score -= 0.1;

    out.push({
      materialId: material.id,
      name: material.name,
      score,
      reason:
        rule?.note ??
        `nyambung ke sisi pertama lewat ${strongestShared(material.facets, a) ?? "—"}, ke sisi kedua lewat ${strongestShared(material.facets, b) ?? "—"}`,
      ruleSource: rule?.source ?? null,
      functionCategory: material.functionCategory,
      impact: material.impact,
      inStock: ctx.stock.has(material.id),
      starterDose: starterDose(material, {
        totalScore: opts.totalScore,
        settings: ctx.settings,
      }),
      // Tier tujuan ditentukan PER BAHAN, bukan per pasangan: aturannya
      // bergantung pada note_tier_hint bahan itu sendiri (PRD v2 §6 B.A).
      tier:
        opts.forceTier ??
        (opts.pair ? recommendTier(material, opts.pair) : "mid"),
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

export type TierBridge = {
  pair: [Tier, Tier];
  sim: number;
  status: BridgeStatus;
  suggestions: BridgeSuggestion[];
  /**
   * false kalau salah satu sisi belum punya bahan berfacet sama sekali.
   *
   * Tier kosong BUKAN jurang. Melaporkannya sebagai "Jurang 0%" memberi tahu
   * ada masalah pada transisi yang belum ada — dan menyuruh memperbaiki sesuatu
   * yang belum dibuat.
   */
  comparable: boolean;
};

/** Semua bahan yang sudah ada di formula — tidak disarankan ulang. */
function usedMaterialIds(items: ExpandedItem[]): Set<string> {
  return new Set(
    items.filter((i) => i.kind === "material").map((i) => i.refId),
  );
}

/**
 * Tier tujuan saat user menambahkan bridger.
 *
 * Top↔Mid selalu ke Mid. Mid↔Base ke Mid hanya kalau bahannya memang biasa
 * duduk di mid; selain itu ke Base, karena jembatan yang terlalu ringan di
 * base akan hilang duluan.
 */
export function recommendTier(
  material: Material | undefined,
  pair: [Tier, Tier],
): Tier {
  if (pair[0] === "top" && pair[1] === "mid") return "mid";

  if (pair[0] === "mid" && pair[1] === "base") {
    const hint = material?.noteTierHint;
    if (hint === "base") return "base";
    // Bahan ber-hint TOP diantar ke Mid, bukan Base.
    //
    // Menyimpang dari PRD §197 yang menaruh semua yang bukan "mid" di Base.
    // Alasannya: menaruh bahan yang menguap cepat di Base adalah yang terburuk
    // dari dua pilihan — dia tidak bertahan di sana, dan dia jauh dari tempat
    // asalnya. Mid adalah tier terdekat yang masih menyambung keduanya.
    // Linalool (family Citrus, jadi hint "top") adalah kasus yang memunculkan
    // ini.
    if (hint === "mid" || hint === "top") return "mid";
    return "base";
  }

  return "mid";
}

export function crossTierBridges(
  ctx: FormulaContext,
  items: ExpandedItem[],
  opts: { onlyStock?: boolean; totalScore?: number } = {},
): TierBridge[] {
  if (!ctx.version.pyramid) return [];

  const vectors = Object.fromEntries(
    TIERS.map((t) => [t, tierVector(items, ctx.materials, t)]),
  ) as Record<Tier, FacetVector>;

  const exclude = usedMaterialIds(items);
  const pairs: [Tier, Tier][] = [
    ["top", "mid"],
    ["mid", "base"],
    ["top", "base"],
  ];

  return pairs.map(([x, y]) => {
    const comparable =
      Object.keys(vectors[x]).length > 0 && Object.keys(vectors[y]).length > 0;
    const s = sim(vectors[x], vectors[y]);
    const status = bridgeStatus(s, ctx.settings.bridgeThresholds);

    return {
      pair: [x, y],
      sim: s,
      status,
      comparable,
      // Tier yang sehat tidak perlu saran — menampilkannya mengaburkan mana
      // yang benar-benar perlu dikerjakan. Tier yang masih kosong juga tidak:
      // tidak ada arah yang bisa dijembatani, dan sarannya akan asal.
      suggestions:
        !comparable || status === "connected"
          ? []
          : suggestBridges(vectors[x], vectors[y], ctx, exclude, {
              ...opts,
              pair: [x, y],
            }),
    };
  });
}

export type WithinTierPair = {
  tier: Tier;
  a: { lineId: string; name: string };
  b: { lineId: string; name: string };
  sim: number;
  status: BridgeStatus;
  suggestions: BridgeSuggestion[];
};

/** Vektor satu baris: bahan pakai facet-nya, accord pakai gabungan isinya. */
function lineVector(
  ctx: FormulaContext,
  lineId: string,
  items: ExpandedItem[],
): FacetVector {
  const line = ctx.version.lines.find((l) => l.id === lineId);
  if (!line) return {};

  if (line.kind === "raw_material") {
    return ctx.materials.get(line.refId)?.facets ?? {};
  }
  if (line.kind === "fo") return {};

  // Accord: arah aromanya dibobot kekuatan isinya.
  const v: FacetVector = {};
  let weighted = 0;
  for (const item of items) {
    if (item.sourceLineId !== lineId || item.kind !== "material") continue;
    const m = ctx.materials.get(item.refId);
    if (!m) continue;
    const s = strengthOf(item, m);
    weighted += s;
    for (const [f, w] of Object.entries(m.facets)) {
      v[f] = (v[f] ?? 0) + s * w;
    }
  }

  // Baris yang persennya masih 0 tidak punya kekuatan, jadi bobotnya nol dan
  // arahnya hilang sama sekali. Padahal bahan yang baru ditambahkan justru
  // itulah yang ingin dilihat: cocok atau tidak dengan yang sudah ada. Jadi
  // kalau bobotnya nol, pakai facet isinya apa adanya.
  if (weighted <= 0) {
    const flat: FacetVector = {};
    const sub = ctx.accords.get(line.refId);
    for (const l of sub?.lines ?? []) {
      const m = ctx.materials.get(l.refId);
      if (!m) continue;
      for (const [f, w] of Object.entries(m.facets)) {
        flat[f] = (flat[f] ?? 0) + w;
      }
    }
    return normalizeL2(flat);
  }

  return normalizeL2(v);
}

/**
 * Pasangan bahan dalam satu tier yang sambungannya paling lemah.
 *
 * Dibatasi 15 pasangan terlemah: formula 10 bahan punya 45 pasangan, dan
 * menampilkan semuanya mengubah panel saran jadi daftar yang tidak dibaca.
 */
export function withinTierBridges(
  ctx: FormulaContext,
  items: ExpandedItem[],
  opts: { onlyStock?: boolean; maxPairs?: number; totalScore?: number } = {},
): WithinTierPair[] {
  const { maxPairs = 15 } = opts;
  const exclude = usedMaterialIds(items);
  const tiers: Tier[] = ctx.version.pyramid ? TIERS : ["all"];
  const out: WithinTierPair[] = [];

  for (const tier of tiers) {
    const lines = ctx.version.lines.filter(
      (l) => l.tier === tier && l.kind !== "fo",
    );
    const vectors = new Map(
      lines.map((l) => [l.id, lineVector(ctx, l.id, items)]),
    );
    const nameOf = (lineId: string) => {
      const l = ctx.version.lines.find((x) => x.id === lineId)!;
      return l.kind === "accord"
        ? (ctx.accords.get(l.refId)?.name ?? "accord")
        : (ctx.materials.get(l.refId)?.name ?? "bahan");
    };

    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const va = vectors.get(lines[i].id)!;
        const vb = vectors.get(lines[j].id)!;
        if (!Object.keys(va).length || !Object.keys(vb).length) continue;

        const s = sim(va, vb);
        const status = bridgeStatus(s, ctx.settings.bridgeThresholds);
        if (status === "connected") continue;

        out.push({
          tier,
          a: { lineId: lines[i].id, name: nameOf(lines[i].id) },
          b: { lineId: lines[j].id, name: nameOf(lines[j].id) },
          sim: s,
          status,
          // Jembatan antara dua bahan di tier yang sama masuk ke tier itu
          // juga — memindahkannya ke tier lain tidak menyambung apa pun.
          suggestions: suggestBridges(va, vb, ctx, exclude, {
            ...opts,
            forceTier: tier,
          }),
        });
      }
    }
  }

  return out.sort((a, b) => a.sim - b.sim).slice(0, maxPairs);
}

/** Vektor tier dari sebuah accord utuh — dipakai picker untuk pratinjau. */
export function accordVector(
  ctx: FormulaContext,
  accordVersionId: string,
): FacetVector {
  const version = ctx.accords.get(accordVersionId);
  if (!version) return {};
  const items = expand({ ...ctx, version }, version);
  const v: FacetVector = {};
  for (const item of items) {
    const m = ctx.materials.get(item.refId);
    if (!m) continue;
    const s = strengthOf(item, m);
    for (const [f, w] of Object.entries(m.facets)) {
      v[f] = (v[f] ?? 0) + s * w;
    }
  }
  return normalizeL2(v);
}
