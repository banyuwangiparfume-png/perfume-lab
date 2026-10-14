import { normalizeL2 } from "./aroma";
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

export type RoleSuggestion = {
  materialId: string;
  name: string;
  score: number;
  reason: string;
  impact: number | null;
  inStock: boolean;
  starterDose: number;
  tier: Tier;
};

export type RoleReport = {
  role: "diffuser" | "fixative";
  /** porsi peran ini dari bahan pewangi sekarang */
  sharePct: number;
  /** bahan berperan ini yang sudah ada di formula */
  present: string[];
  suggestions: RoleSuggestion[];
};

/** Nama lama, dipertahankan supaya pemanggil yang sudah ada tidak putus. */
export type DiffuserReport = RoleReport;

/**
 * Arah aroma formula secara keseluruhan, dibobot kekuatan.
 *
 * Dipakai untuk menilai apakah sebuah diffuser akan terdengar menyatu atau
 * malah seperti bahan asing yang ditempelkan.
 */
function formulaVector(
  items: ExpandedItem[],
  materials: Map<string, Material>,
): FacetVector {
  const v: FacetVector = {};
  for (const item of items) {
    if (item.kind !== "material") continue;
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
 * Saran bahan untuk satu PERAN: diffuser atau fixative.
 *
 * Satu fungsi untuk keduanya, bukan dua modul yang mirip. Kriterianya memang
 * sama — cari bahan berperan itu yang searah dengan formula — dan dua salinan
 * yang nyaris identik pasti menyimpang pelan-pelan tanpa ada yang sadar.
 *
 * Saran diffuser: bahan yang menaikkan proyeksi tanpa mengubah wataknya.
 *
 * Pertanyaannya BERBEDA dari bridger. Bridger mencari bahan yang duduk di
 * antara dua sisi yang tidak nyambung — nilainya justru pada kemiripan
 * SEBAGIAN ke masing-masing sisi. Diffuser dicari yang mirip ke arah formula
 * SECARA KESELURUHAN: tugasnya membawa yang sudah ada keluar lebih jauh, bukan
 * menambah watak baru. Bahan yang skornya rendah di sini akan terdengar seperti
 * tempelan.
 *
 * Hanya bahan yang kategorinya benar-benar DATA yang disarankan. Kategori hasil
 * tebakan dari family tidak dipakai di sini: menyarankan dosis berdasarkan
 * tebakan sendiri menumpuk ketidakpastian di atas ketidakpastian.
 */
export function roleReport(
  ctx: FormulaContext,
  items: ExpandedItem[],
  mix: FunctionMix,
  role: "diffuser" | "fixative",
  opts: { onlyStock?: boolean; limit?: number; totalScore?: number } = {},
): RoleReport {
  const { onlyStock = false, limit = 5 } = opts;

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

  const target = formulaVector(items, ctx.materials);
  const suggestions: RoleSuggestion[] = [];

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

      suggestions.push({
        materialId: material.id,
        name: material.name,
        score,
        reason:
          role === "diffuser"
            ? `menguatkan sisi ${strongestShared(material.facets, target) ?? "—"} yang sudah ada`
            : `menahan dari sisi ${strongestShared(material.facets, target) ?? "—"}, searah dengan formulanya`,
        impact: material.impact,
        inStock: ctx.stock.has(material.id),
        starterDose: starterDose(material, {
          totalScore: opts.totalScore,
          settings: ctx.settings,
        }),
        // Fixative tempatnya di Base: yang menahan harus berada di lapisan
        // yang paling lambat menguap, berapa pun kebiasaan bahannya.
        tier:
          role === "fixative" ? "base" : (material.noteTierHint ?? "mid"),
      });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  return {
    role,
    sharePct: shareOf(mix, role),
    present,
    suggestions: suggestions.slice(0, limit),
  };
}
