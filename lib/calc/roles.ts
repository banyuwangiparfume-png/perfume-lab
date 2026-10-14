import { aromaShares, normalizeL2 } from "./aroma";
import { sim, starterDose } from "./bridge";
import { shareOf, type FunctionMix } from "./functions";
import { strengthOf } from "./strength";
import type {
  ExpandedItem,
  FacetVector,
  FormulaContext,
  Material,
  Tier,
} from "./types";

/** Bahan di formula yang searah dengan sebuah saran — yang ikut terangkat. */
export type RoleLift = { refId: string; name: string; sim: number };

/**
 * Perkiraan efek saran ke pie aroma SELURUH formula, pada dosis awalnya.
 *
 * Yang dihitung cuma sumbangan bau bahan itu sendiri ke facet yang sama.
 * Sinergi — dua bahan barengan tercium lebih hidup dari jumlahnya — nyata
 * tapi tidak punya data terukur, jadi sengaja tidak dikarang di sini.
 */
export type RolePreview = { facet: string; beforePct: number; afterPct: number };

export type RoleSuggestion = {
  materialId: string;
  name: string;
  score: number;
  reason: string;
  impact: number | null;
  inStock: boolean;
  starterDose: number;
  tier: Tier;
  /** bahan di scope yang searah dengan saran ini */
  lifts: RoleLift[];
  preview: RolePreview | null;
};

export type RoleReport = {
  role: "diffuser" | "fixative";
  /** bagian formula yang jadi sasaran: seluruhnya, atau satu tier */
  scope: Tier;
  /** porsi peran ini dari bahan pewangi sekarang (selalu seluruh formula) */
  sharePct: number;
  /** bahan berperan ini yang sudah ada di formula */
  present: string[];
  suggestions: RoleSuggestion[];
};

/** Nama lama, dipertahankan supaya pemanggil yang sudah ada tidak putus. */
export type DiffuserReport = RoleReport;

/**
 * Di atas angka ini sebuah saran dianggap "nempel" ke bahan di formula.
 * Setengah jalan antara tidak berhubungan (0) dan identik (1): cukup untuk
 * berbagi watak utama, belum tentu baunya sama.
 */
const LIFT_MIN_SIM = 0.5;
const LIFT_MAX = 3;

const inScope = (item: ExpandedItem, scope: Tier) =>
  scope === "all" || item.tier === scope;

/**
 * Arah aroma bagian formula yang jadi sasaran, dibobot kekuatan.
 *
 * Untuk scope satu tier, yang dicari adalah bahan yang searah dengan tier itu
 * saja — "angkat Mid-nya", bukan "angkat semuanya".
 */
function scopeVector(
  items: ExpandedItem[],
  materials: Map<string, Material>,
  scope: Tier,
): FacetVector {
  const v: FacetVector = {};
  for (const item of items) {
    if (item.kind !== "material" || !inScope(item, scope)) continue;
    const material = materials.get(item.refId);
    if (!material || material.isSolvent) continue;

    const s = strengthOf(item, material);
    if (s <= 0) continue;
    for (const [facet, weight] of Object.entries(material.facets)) {
      v[facet] = (v[facet] ?? 0) + s * weight;
    }
  }
  return normalizeL2(v);
}

const strongestShared = (a: FacetVector, b: FacetVector): string | null => {
  let best: string | null = null;
  let bestValue = 0;
  for (const [facet, weight] of Object.entries(a)) {
    const score = weight * (b[facet] ?? 0);
    if (score > bestValue) {
      bestValue = score;
      best = facet;
    }
  }
  return best;
};

/**
 * Bahan di dalam scope yang searah dengan sebuah kandidat.
 *
 * Ini jawaban untuk "diffuser ini ngangkat yang mana". Bukan dengan menaikkan
 * impact bahan lain — impact itu sifat molekulnya sendiri dan tidak berubah —
 * tapi dengan menambah bau ke arah yang sama, sehingga bahan-bahan ini
 * terdengar lebih keras bersama-sama.
 */
export function liftsOf(
  candidate: Material,
  items: ExpandedItem[],
  materials: Map<string, Material>,
  scope: Tier,
): RoleLift[] {
  const seen = new Set<string>();
  const out: RoleLift[] = [];
  for (const item of items) {
    if (item.kind !== "material" || !inScope(item, scope)) continue;
    if (seen.has(item.refId)) continue;
    seen.add(item.refId);

    const m = materials.get(item.refId);
    if (!m || m.isSolvent || !Object.keys(m.facets).length) continue;

    const s = sim(candidate.facets, m.facets);
    if (s >= LIFT_MIN_SIM) out.push({ refId: m.id, name: m.name, sim: s });
  }
  return out
    .sort((a, b) => b.sim - a.sim || a.name.localeCompare(b.name, "id"))
    .slice(0, LIFT_MAX);
}

/**
 * Item sintetis untuk pratinjau: bahan ditambahkan pada dosis tertentu, dengan
 * aturan dilusi supplier dan basis kekuatan yang sama persis dengan expand().
 */
function syntheticItem(
  material: Material,
  dosePct: number,
  tier: Tier,
): ExpandedItem {
  const activePct = (dosePct * material.supplierDilutionPct) / 100;
  return {
    kind: "material",
    refId: material.id,
    tier,
    role: "ingredient",
    productPct: dosePct,
    activePct,
    strengthBasisPct: material.impactBasis === "active" ? activePct : dosePct,
    via: [],
    sourceLineId: "__preview",
  };
}

/**
 * Seberapa jauh satu facet di pie seluruh formula bergeser kalau bahan ini
 * ditambahkan pada dosis tertentu.
 *
 * Baris lain tidak diskalakan turun. Untuk dosis 0,1–5% bedanya dengan
 * menormalisasi ulang ke 100% kecil, dan pie memang membaca porsi relatif.
 */
export function previewFacetShift(
  items: ExpandedItem[],
  materials: Map<string, Material>,
  material: Material,
  dosePct: number,
  tier: Tier,
  facet: string,
): RolePreview {
  const pctOf = (list: ExpandedItem[]) =>
    aromaShares(list, materials).find((s) => s.facet === facet)?.pct ?? 0;

  return {
    facet,
    beforePct: pctOf(items),
    afterPct: pctOf([...items, syntheticItem(material, dosePct, tier)]),
  };
}

/**
 * Saran bahan untuk satu PERAN: diffuser atau fixative.
 *
 * Satu fungsi untuk keduanya, bukan dua modul yang mirip. Kriterianya memang
 * sama — cari bahan berperan itu yang searah dengan sasarannya — dan dua
 * salinan yang nyaris identik pasti menyimpang pelan-pelan tanpa ada yang
 * sadar.
 *
 * Pertanyaannya BERBEDA dari bridger. Bridger mencari bahan yang duduk di
 * antara dua sisi yang tidak nyambung — nilainya justru pada kemiripan
 * SEBAGIAN ke masing-masing sisi. Diffuser dicari yang mirip ke arah
 * sasarannya: tugasnya membawa yang sudah ada keluar lebih jauh, bukan
 * menambah watak baru.
 *
 * `scope` memilih sasarannya: seluruh formula, atau satu tier saja. Diffuser
 * tidak netral — Ambroxan mengangkat kayu, Hedione mengangkat floral — jadi
 * "mau ngangkat apa" lebih berguna daripada "biar nyebar".
 *
 * Hanya bahan yang kategorinya benar-benar DATA yang disarankan. Kategori hasil
 * tebakan dari family tidak dipakai: menyarankan dosis berdasarkan tebakan
 * sendiri menumpuk ketidakpastian di atas ketidakpastian.
 */
export function roleReport(
  ctx: FormulaContext,
  items: ExpandedItem[],
  mix: FunctionMix,
  role: "diffuser" | "fixative",
  opts: {
    onlyStock?: boolean;
    limit?: number;
    totalScore?: number;
    scope?: Tier;
  } = {},
): RoleReport {
  const { onlyStock = false, limit = 5, scope = "all" } = opts;

  const used = new Set(
    items.filter((i) => i.kind === "material").map((i) => i.refId),
  );

  const present = [...used]
    .map((id) => ctx.materials.get(id))
    .filter(
      (m): m is Material =>
        !!m && (m.functionCategory ?? "").toLowerCase() === role,
    )
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b, "id"));

  const target = scopeVector(items, ctx.materials, scope);
  const candidates: { material: Material; score: number; shared: string | null }[] = [];

  if (Object.keys(target).length) {
    for (const material of ctx.materials.values()) {
      if ((material.functionCategory ?? "").toLowerCase() !== role) continue;
      if (material.functionSource === "derived") continue;
      if (used.has(material.id)) continue;
      if (onlyStock && !ctx.stock.has(material.id)) continue;
      if (!Object.keys(material.facets).length) continue;

      const score = sim(material.facets, target);
      // Di bawah ini bukan penguat, melainkan bahan lain yang kebetulan
      // berkategori diffuser.
      if (score < 0.15) continue;

      candidates.push({
        material,
        score,
        shared: strongestShared(material.facets, target),
      });
    }
  }

  // Pratinjau dan daftar "nempel ke" cuma dihitung untuk yang lolos ke
  // tampilan — dua-duanya menghitung ulang pie, dan kandidatnya bisa puluhan.
  const suggestions: RoleSuggestion[] = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ material, score, shared }) => {
      const dose = starterDose(material, {
        totalScore: opts.totalScore,
        settings: ctx.settings,
      });
      // Fixative tempatnya di Base: yang menahan harus berada di lapisan yang
      // paling lambat menguap. Diffuser tetap di tier kebiasaannya walau
      // sasarannya tier lain — menaruh Hedione di Top tidak membuatnya
      // menguap lebih cepat.
      const tier: Tier =
        role === "fixative" ? "base" : (material.noteTierHint ?? "mid");

      return {
        materialId: material.id,
        name: material.name,
        score,
        reason:
          role === "diffuser"
            ? `menguatkan sisi ${shared ?? "—"} yang sudah ada`
            : `menahan dari sisi ${shared ?? "—"}, searah dengan formulanya`,
        impact: material.impact,
        inStock: ctx.stock.has(material.id),
        starterDose: dose,
        tier,
        lifts: liftsOf(material, items, ctx.materials, scope),
        preview: shared
          ? previewFacetShift(items, ctx.materials, material, dose, tier, shared)
          : null,
      };
    });

  return {
    role,
    scope,
    sharePct: shareOf(mix, role),
    present,
    suggestions,
  };
}
