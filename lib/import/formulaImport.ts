import { SOLVENT_PRODUCTS, SOLVENT_TOKENS } from "../calc/supplierDilution";
import type { Line, LineKind, Pyramid, Tier } from "../calc/types";

/**
 * Import formula dari template Excel — biasanya hasil isian AI.
 *
 * Fungsi murni. Server hanya mengubah berkas Excel jadi baris mentah; semua
 * keputusan (nama ini bahan yang mana, persen ini sah atau tidak) diambil di
 * sini, supaya bisa diuji dan supaya pratinjau di layar memakai aturan yang
 * sama persis dengan yang akhirnya ditulis ke draf.
 *
 * Prinsipnya: TIDAK ADA tebakan diam-diam. Nama yang cocok ke dua bahan
 * ditandai ambigu, bukan dipilihkan salah satunya; nama yang tidak ketemu
 * ditandai, bukan dibuang tanpa kabar. AI sering mengarang nama yang mirip —
 * "Iso E Super" untuk "Iso E Super / Amber Fleur Pure Concentrate" — dan yang
 * seperti itu boleh dicocokkan, tapi "Ambrox" yang bisa berarti tiga produk
 * tidak boleh.
 */

export const TEMPLATE_COLUMNS = [
  "tier",
  "bahan",
  "cas",
  "persen",
  "dilusi_pct",
  "pelarut",
  "catatan",
] as const;

export type CatalogEntry = {
  id: string;
  kind: LineKind;
  name: string;
  synonym?: string | null;
  cas?: string | null;
  /** kebiasaan tier, dipakai kalau kolom tier kosong */
  tierHint?: Tier | null;
};

export type ImportCatalog = {
  entries: CatalogEntry[];
  solvents: { id: string; name: string }[];
};

export type ImportIssue = { level: "error" | "warn"; message: string };

export type ImportRow = {
  /** nomor baris di Excel, untuk pesan yang bisa dicari user */
  row: number;
  rawName: string;
  tier: Tier;
  pct: number | null;
  dilutionPct: number;
  match: { id: string; kind: LineKind; name: string } | null;
  solvent: { id: string; name: string } | null;
  issues: ImportIssue[];
};

export type ImportResult = {
  rows: ImportRow[];
  /** total persen baris yang akan masuk (yang cocok dan persennya sah) */
  totalPct: number;
  /** jumlah per tier dari baris yang masuk — jadi target piramida baru */
  tierSums: Record<"top" | "mid" | "base", number>;
  importable: number;
};

const TIERS = new Set(["top", "mid", "base"]);

/** Huruf kecil, spasi dirapatkan, tanda baca pinggir dibuang. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:]+|[\s.,;:]+$/g, "");

/**
 * Bentuk-bentuk nama sebuah entri: nama lengkap, tiap bagian yang dipisah "/"
 * ("Hedione / Methyl Dihydrojasmonate" → "hedione", "methyl
 * dihydrojasmonate"), dan sinonimnya. Supplier memang menulis nama dagang
 * dan nama kimia dipisah garis miring.
 */
function aliases(e: CatalogEntry): string[] {
  const out = new Set<string>();
  for (const source of [e.name, e.synonym ?? ""]) {
    if (!source.trim()) continue;
    out.add(norm(source));
    for (const part of source.split("/")) {
      const p = norm(part);
      if (p.length >= 3) out.add(p);
    }
  }
  return [...out];
}

/** Angka dari sel Excel: menerima koma desimal dan tanda persen. */
export function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace("%", "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const text = (v: unknown) => (v == null ? "" : String(v).trim());

export function matchFormulaRows(
  raw: { row: number; values: Record<string, unknown> }[],
  catalog: ImportCatalog,
  opts: { pyramid: boolean },
): ImportResult {
  // Indeks alias → entri. Satu alias bisa menunjuk beberapa entri; itu yang
  // nanti ditandai ambigu.
  const byAlias = new Map<string, CatalogEntry[]>();
  const byCas = new Map<string, CatalogEntry[]>();
  const byFullName = new Map<string, CatalogEntry[]>();
  for (const e of catalog.entries) {
    const full = norm(e.name);
    byFullName.set(full, [...(byFullName.get(full) ?? []), e]);
    for (const a of aliases(e)) {
      const list = byAlias.get(a) ?? [];
      if (!list.includes(e)) list.push(e);
      byAlias.set(a, list);
    }
    if (e.cas) {
      const k = e.cas.trim();
      byCas.set(k, [...(byCas.get(k) ?? []), e]);
    }
  }
  const solventByAlias = new Map<string, { id: string; name: string }>();
  for (const s of catalog.solvents) {
    solventByAlias.set(norm(s.name), s);
    for (const part of s.name.split("/")) {
      const p = norm(part);
      if (p.length >= 2) solventByAlias.set(p, s);
    }
  }
  // Singkatan yang lazim ditulis AI dan perfumer ("TEC", "DPG", "BB") —
  // sama dengan token yang dikenali di nama produk supplier.
  for (const token of SOLVENT_TOKENS) {
    const hit = catalog.solvents.find((s) => SOLVENT_PRODUCTS[token].test(s.name));
    if (hit && !solventByAlias.has(norm(token))) solventByAlias.set(norm(token), hit);
  }

  const rows: ImportRow[] = [];
  for (const { row, values } of raw) {
    const rawName = text(values.bahan);
    const pctRaw = values.persen;
    // Baris yang benar-benar kosong dilewati tanpa komentar — template punya
    // baris kosong di bawah, dan itu bukan kesalahan.
    if (!rawName && (pctRaw == null || pctRaw === "")) continue;

    const issues: ImportIssue[] = [];

    // ---- bahan ----
    let match: ImportRow["match"] = null;
    const cas = text(values.cas);
    // Nama lengkap yang persis menang atas potongan nama: "Hedione" yang
    // ditulis utuh adalah Hedione, walau ada bahan lain yang sinonimnya juga
    // memuat kata itu.
    const exact = rawName ? (byFullName.get(norm(rawName)) ?? []) : [];
    const nameHits =
      exact.length === 1
        ? exact
        : rawName
          ? (byAlias.get(norm(rawName)) ?? [])
          : [];
    const casHits = cas ? (byCas.get(cas) ?? []) : [];

    // CAS dipakai untuk memutus ambigu, bukan menggantikan nama: dua produk
    // bisa berbagi CAS (encer & murni), dan nama yang tertulis yang dimaksud.
    let hits = nameHits;
    if (hits.length > 1 && casHits.length) {
      const narrowed = hits.filter((h) => casHits.includes(h));
      if (narrowed.length) hits = narrowed;
    }
    if (!hits.length && casHits.length === 1) hits = casHits;

    if (!rawName) {
      issues.push({ level: "error", message: "Nama bahan kosong." });
    } else if (hits.length === 1) {
      const h = hits[0];
      match = { id: h.id, kind: h.kind, name: h.name };
    } else if (hits.length > 1) {
      issues.push({
        level: "error",
        message: `Nama ini cocok ke ${hits.length} bahan: ${hits
          .slice(0, 3)
          .map((h) => h.name)
          .join(" · ")}. Tulis nama lengkapnya, atau isi kolom CAS.`,
      });
    } else {
      issues.push({
        level: "error",
        message:
          "Tidak ada di master bahan. Tambahkan dulu lewat Bahan → Tambah bahan, atau ganti namanya.",
      });
    }

    // ---- persen ----
    const pct = parseNumber(pctRaw);
    if (pct == null) {
      issues.push({ level: "error", message: "Persen kosong atau bukan angka." });
    } else if (pct <= 0) {
      issues.push({ level: "error", message: "Persen harus lebih dari 0." });
    } else if (pct > 100) {
      issues.push({ level: "error", message: "Persen lebih dari 100." });
    }

    // ---- tier ----
    let tier: Tier = "all";
    if (opts.pyramid) {
      const t = text(values.tier).toLowerCase();
      const entry = match
        ? catalog.entries.find((e) => e.id === match!.id)
        : undefined;
      if (TIERS.has(t)) {
        tier = t as Tier;
      } else {
        const hint = entry?.tierHint;
        tier = hint && hint !== "all" ? hint : "mid";
        issues.push({
          level: "warn",
          message: t
            ? `Tier "${t}" tidak dikenal — dimasukkan ke ${tier}.`
            : `Tier kosong — dimasukkan ke ${tier}${hint ? " (kebiasaan bahannya)" : ""}.`,
        });
      }
    }

    // ---- dilusi ----
    const dil = parseNumber(values.dilusi_pct);
    let dilutionPct = 100;
    let solvent: ImportRow["solvent"] = null;
    if (dil != null && dil !== 100) {
      if (dil <= 0 || dil > 100) {
        issues.push({
          level: "warn",
          message: `Dilusi ${dil}% tidak masuk akal — dianggap neat.`,
        });
      } else if (match && match.kind !== "raw_material") {
        issues.push({
          level: "warn",
          message: "Accord dan FO tidak diencerkan per baris — dilusi diabaikan.",
        });
      } else {
        dilutionPct = dil;
        const sName = text(values.pelarut);
        solvent = sName ? (solventByAlias.get(norm(sName)) ?? null) : null;
        if (!solvent) {
          issues.push({
            level: "error",
            message: sName
              ? `Pelarut "${sName}" tidak ada di master.`
              : "Diencerkan tapi pelarutnya tidak disebut.",
          });
        }
      }
    }

    rows.push({ row, rawName, tier, pct, dilutionPct, match, solvent, issues });
  }

  // Bahan yang sama dua kali di tier yang sama hampir selalu salah ketik AI.
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (!r.match) continue;
    const key = `${r.tier}:${r.match.id}`;
    const first = seen.get(key);
    if (first != null) {
      r.issues.push({
        level: "warn",
        message: `Sudah ada di baris ${first} pada tier yang sama — keduanya tetap dimasukkan.`,
      });
    } else {
      seen.set(key, r.row);
    }
  }

  const ok = rows.filter(isImportable);
  const tierSums = { top: 0, mid: 0, base: 0 };
  for (const r of ok) {
    if (r.tier !== "all") tierSums[r.tier] += r.pct!;
  }

  return {
    rows,
    totalPct: ok.reduce((a, r) => a + r.pct!, 0),
    tierSums,
    importable: ok.length,
  };
}

export const isImportable = (r: ImportRow) =>
  !!r.match && r.pct != null && !r.issues.some((i) => i.level === "error");

/** Baris editor dari hasil import. Dikunci supaya tidak dibagi ulang otomatis. */
export function toLines(
  result: ImportResult,
  newId: () => string,
): Line[] {
  return result.rows.filter(isImportable).map((r, i) => ({
    id: newId(),
    tier: r.tier,
    kind: r.match!.kind,
    refId: r.match!.id,
    pct: round5(r.pct!),
    // Dikunci: persennya datang dari resep, dan alokasi otomatis tidak boleh
    // menggesernya hanya karena satu baris lain disunting.
    locked: true,
    userDilutionPct: r.dilutionPct,
    userSolventId: r.solvent?.id ?? null,
    sortOrder: i,
  }));
}

/**
 * Target piramida baru dari isi resep — hanya kalau totalnya memang 100.
 * Kalau tidak, piramida lama dipertahankan dan editor menandai selisihnya;
 * memaksakan target yang tidak berjumlah 100 cuma memindahkan masalahnya.
 */
export function pyramidFrom(result: ImportResult): Pyramid | null {
  if (Math.abs(result.totalPct - 100) > 0.01) return null;
  return {
    top: round5(result.tierSums.top),
    mid: round5(result.tierSums.mid),
    base: round5(result.tierSums.base),
  };
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
