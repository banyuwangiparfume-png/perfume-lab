"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/action-result";
import { deriveMaterial, normalizeName } from "@/lib/calc/deriveMaterial";
import type { FacetKeywordConfig } from "@/lib/calc/facetize";
import {
  SOLVENT_PRODUCTS,
  type SolventToken,
} from "@/lib/calc/supplierDilution";
import type { Material } from "@/lib/calc/types";
import { fetchMaterials } from "@/lib/data/loadFormulaContext";
import type { MaterialMeta } from "@/lib/data/loadEditorData";
import {
  parseMaterialRows,
  type MaterialColumn,
  type ParseFailure,
} from "@/lib/csv/parseMaterials";
import { getOwnerId } from "@/lib/owner";
import { getDb } from "@/lib/supabase/db";
import type { FunctionCategoryEnum } from "@/lib/supabase/database.types";
import facetKeywords from "@/seed/facet-keywords.json";

/**
 * Konfigurasi facet di-bundle, bukan dibaca dari disk saat runtime: di Vercel
 * berkas seed tidak selalu ikut ke bundel server.
 */
const FACET_CONFIG = facetKeywords as unknown as FacetKeywordConfig;

const CHUNK = 200;

const chunk = <T>(xs: T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
};

/**
 * Koreksi nilai impact dari hasil penciuman sendiri.
 *
 * Disimpan di kolom terpisah dari nilai supplier, dan import ulang tidak boleh
 * menimpanya. Lama-lama kolom inilah yang jadi aset asli aplikasi ini —
 * angka supplier bucketed (94 bahan bernilai persis 100), bagus untuk
 * mendeteksi kelebihan dosis tapi tidak untuk presisi.
 */
export async function setImpactOverride(
  id: string,
  value: number | null,
  note: string | null,
): Promise<ActionResult> {
  if (value != null && (!Number.isFinite(value) || value < 0)) {
    return fail("Nilai impact harus angka 0 atau lebih.", "value");
  }
  if (value != null && !note?.trim()) {
    return fail(
      "Tulis alasan koreksinya. Tiga bulan lagi kamu tidak akan ingat kenapa angkanya diubah.",
      "note",
    );
  }

  const db = getDb();
  const { error } = await db
    .from("raw_materials")
    .update({
      odor_impact_override: value,
      odor_impact_note: value == null ? null : note!.trim(),
    })
    .eq("id", id);

  if (error) return fail(describeDbError(error));

  revalidatePath(`/materials/${id}`);
  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  return ok();
}

const materialInput = z.object({
  name: z.string().trim().min(1, "Nama bahan wajib diisi"),
  synonym: z.string().trim().nullable().optional(),
  cas_number: z.string().trim().nullable().optional(),
  family: z.string().trim().nullable().optional(),
  category: z.string().trim().nullable().optional(),
  odour_profile: z.string().trim().nullable().optional(),
  function_category: z
    .enum(["diffuser", "modifier", "bridger", "fixative"])
    .nullable()
    .optional(),
  odor_impact: z.number().min(0).nullable().optional(),
  default_dilution_pct: z.number().gt(0).max(100).optional(),
  default_solvent: z.string().trim().nullable().optional(),
  tgsc_url: z.string().trim().nullable().optional(),
  supplier: z.string().trim().nullable().optional(),
  personal_note: z.string().trim().nullable().optional(),
});

const nullable = (v: string | null | undefined) =>
  v && v.trim() ? v.trim() : null;

const newMaterialInput = materialInput.extend({
  /** kosong = diturunkan dari family */
  note_tier_hint: z.enum(["top", "mid", "base"]).nullable().optional(),
  prices: z
    .array(
      z.object({
        tier_size: z.number().positive(),
        price_idr: z.number().min(0),
      }),
    )
    .optional(),
});

export type NewMaterialInput = z.input<typeof newMaterialInput>;

export type CreatedMaterial = {
  id: string;
  /** bentuk yang dipakai kalkulasi, supaya editor bisa langsung menghitungnya */
  material: Material;
  meta: MaterialMeta;
};

/**
 * Bahan baru yang dimasukkan sendiri dari aplikasi — bukan dari pricelist.
 *
 * Semua yang biasanya diturunkan saat import (facet, dilusi bawaan dari nama,
 * pelarut, kandidat bridger, kebiasaan tier) diturunkan di sini dengan fungsi
 * yang sama, deriveMaterial(). Bahan buatan sendiri tidak boleh dinilai dengan
 * aturan yang berbeda dari bahan supplier.
 *
 * Bahannya milik user (owner_id terisi), jadi import pricelist berikutnya
 * tidak akan pernah menyentuhnya — import hanya mencocokkan bahan global.
 */
export async function createMaterial(
  input: NewMaterialInput,
): Promise<ActionResult<CreatedMaterial>> {
  const parsed = newMaterialInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path[0] ?? ""));
  }
  const v = parsed.data;

  const db = getDb();
  const ownerId = await getOwnerId();

  // Duplikat dicek sebelum menulis. Dua "Nagarmotha Oil" di master membuat
  // picker menampilkan dua baris yang tidak bisa dibedakan, dan stok serta
  // harganya terpecah ke dua tempat.
  const { data: sameName, error: dupErr } = await db
    .from("raw_materials")
    .select("id, name, owner_id")
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
    .eq("is_active", true)
    .ilike("name", v.name.replace(/[%_\\]/g, (c) => `\\${c}`));
  if (dupErr) return fail(describeDbError(dupErr));
  const dup = (sameName ?? []).find(
    (m) => normalizeName(m.name) === normalizeName(v.name),
  );
  if (dup) {
    return fail(
      `${dup.name} sudah ada di master${dup.owner_id ? "" : " (dari pricelist supplier)"}. Cari dengan nama itu, atau pakai nama yang lain.`,
      "name",
    );
  }

  const family = nullable(v.family);
  const category = nullable(v.category);
  const odourProfile = nullable(v.odour_profile);
  const derived = deriveMaterial(
    {
      name: v.name,
      synonym: nullable(v.synonym),
      family,
      category,
      odourProfile,
      impact: v.odor_impact ?? null,
    },
    FACET_CONFIG,
  );

  // Pelarut bawaan ("... 10 TEC") disambungkan ke baris pelarut di master,
  // sama seperti import. Kalau tidak ketemu dibiarkan kosong — lebih baik
  // kosong daripada menunjuk ke bahan yang salah.
  let supplierSolventId: string | null = null;
  if (derived.solventToken) {
    const { data: solvents } = await db
      .from("raw_materials")
      .select("id, name")
      .is("owner_id", null)
      .eq("is_solvent", true);
    const pattern = SOLVENT_PRODUCTS[derived.solventToken];
    supplierSolventId =
      (solvents ?? []).find((s) => pattern.test(s.name))?.id ?? null;
  }

  const { data, error } = await db
    .from("raw_materials")
    .insert({
      owner_id: ownerId,
      name: v.name,
      synonym: nullable(v.synonym),
      cas_number: nullable(v.cas_number),
      family,
      category,
      odour_profile: odourProfile,
      function_category: v.function_category ?? null,
      odor_impact: v.odor_impact ?? null,
      default_dilution_pct: v.default_dilution_pct ?? 100,
      default_solvent: nullable(v.default_solvent),
      tgsc_url: nullable(v.tgsc_url),
      supplier: nullable(v.supplier),
      personal_note: nullable(v.personal_note),
      supplier_dilution_pct: derived.supplierDilutionPct,
      supplier_solvent_id: supplierSolventId,
      is_solvent: derived.isSolvent,
      is_bridge_candidate: derived.isBridgeCandidate,
      // Pilihan user menang atas turunan dari family. Bahannya milik user
      // sendiri, jadi di sini dia memang sumber datanya — bukan koreksi.
      note_tier_hint: v.note_tier_hint ?? derived.noteTierHint,
    })
    .select("id")
    .single();

  if (error || !data) {
    return fail(describeDbError(error ?? { message: "Gagal menyimpan bahan" }));
  }
  const id = data.id;

  const facetRows = Object.entries(derived.facets).map(([facet_key, weight]) => ({
    raw_material_id: id,
    facet_key,
    weight,
  }));
  if (facetRows.length) {
    const { error: fErr } = await db.from("raw_material_facets").insert(facetRows);
    if (fErr) return fail(`Bahan tersimpan, tapi facet-nya gagal: ${describeDbError(fErr)}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const priceRows = (v.prices ?? []).map((p) => ({
    raw_material_id: id,
    tier_size: p.tier_size,
    price_idr: p.price_idr,
    effective_date: today,
  }));
  if (priceRows.length) {
    const { error: pErr } = await db
      .from("rm_prices")
      .upsert(priceRows, { onConflict: "raw_material_id,tier_size,effective_date" });
    if (pErr) return fail(`Bahan tersimpan, tapi harganya gagal: ${describeDbError(pErr)}`);
  }

  // Dibaca ulang lewat loader yang sama dengan editor, supaya bentuknya pasti
  // sama — termasuk resolusi kategori fungsi dan asal-usulnya.
  const material = (await fetchMaterials(db, [id])).get(id);
  if (!material) return fail("Bahan tersimpan, tapi gagal dibaca ulang.");

  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  return ok({
    id,
    material,
    meta: {
      id,
      synonym: nullable(v.synonym),
      casNumber: nullable(v.cas_number),
      family,
      odourProfile,
    },
  });
}

export async function updateMaterial(
  id: string,
  input: z.input<typeof materialInput>,
): Promise<ActionResult> {
  const parsed = materialInput.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first.message, String(first.path[0] ?? ""));
  }
  const v = parsed.data;

  const db = getDb();
  const { error } = await db
    .from("raw_materials")
    .update({
      name: v.name,
      synonym: nullable(v.synonym),
      cas_number: nullable(v.cas_number),
      family: nullable(v.family),
      category: nullable(v.category),
      odour_profile: nullable(v.odour_profile),
      function_category: v.function_category ?? null,
      odor_impact: v.odor_impact ?? null,
      ...(v.default_dilution_pct !== undefined
        ? { default_dilution_pct: v.default_dilution_pct }
        : {}),
      default_solvent: nullable(v.default_solvent),
      tgsc_url: nullable(v.tgsc_url),
      supplier: nullable(v.supplier),
      ...(v.personal_note !== undefined
        ? { personal_note: nullable(v.personal_note) }
        : {}),
    })
    .eq("id", id);

  if (error) return fail(describeDbError(error));

  revalidatePath(`/materials/${id}`);
  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  return ok();
}

export async function setMaterialActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const db = getDb();
  const { error } = await db
    .from("raw_materials")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return fail(describeDbError(error));
  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  return ok();
}

export async function upsertPrices(
  materialId: string,
  tiers: { tier_size: number; price_idr: number }[],
  effectiveDate?: string,
): Promise<ActionResult> {
  const db = getDb();
  const date = effectiveDate ?? new Date().toISOString().slice(0, 10);

  const rows = tiers
    .filter((t) => t.tier_size > 0 && t.price_idr >= 0)
    .map((t) => ({
      raw_material_id: materialId,
      tier_size: t.tier_size,
      price_idr: t.price_idr,
      effective_date: date,
    }));

  if (!rows.length) return ok();

  // Membuat baris BARU dengan effective_date hari ini. Harga lama tidak
  // dihapus — riwayat harga berguna untuk melihat pergerakan biaya.
  const { error } = await db
    .from("rm_prices")
    .upsert(rows, { onConflict: "raw_material_id,tier_size,effective_date" });

  if (error) return fail(describeDbError(error));

  revalidatePath(`/materials/${materialId}`);
  return ok();
}

export type ImportSummary = {
  read: number;
  created: number;
  updated: number;
  priceRows: number;
  failures: ParseFailure[];
};

/**
 * Validasi tanpa menulis apa pun. Dipakai untuk layar ringkasan sebelum
 * konfirmasi, supaya user melihat berapa yang baru, berapa yang di-update, dan
 * baris mana yang gagal beserta alasannya.
 */
export async function validateMaterialsCsv(
  rawRows: Record<string, unknown>[],
  columnMap: Partial<Record<MaterialColumn, string>>,
): Promise<ActionResult<ImportSummary>> {
  const { rows, failures } = parseMaterialRows(rawRows, columnMap);
  const existing = await loadGlobalIndex();

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const match = matchExisting(existing, r.cas_number, r.name);
    if (match) updated++;
    else created++;
  }

  return ok({
    read: rawRows.length,
    created,
    updated,
    priceRows: rows.reduce((a, r) => a + r.prices.length, 0),
    failures,
  });
}

type GlobalIndex = {
  byCas: Map<string, string>;
  byName: Map<string, string>;
  /** CAS yang dipakai lebih dari satu bahan — tidak bisa jadi kunci */
  ambiguousCas: Set<string>;
};

async function loadGlobalIndex(): Promise<GlobalIndex> {
  const db = getDb();
  const byCas = new Map<string, string>();
  const byName = new Map<string, string>();
  const ambiguousCas = new Set<string>();

  // Pricelist bisa 400+ baris dan master bisa tumbuh; ambil berhalaman supaya
  // tidak kena batas baris PostgREST.
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("raw_materials")
      .select("id, name, cas_number")
      .is("owner_id", null)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(describeDbError(error));
    for (const row of data ?? []) {
      if (row.cas_number) {
        if (byCas.has(row.cas_number)) ambiguousCas.add(row.cas_number);
        else byCas.set(row.cas_number, row.id);
      }
      byName.set(row.name.toLowerCase(), row.id);
    }
    if (!data || data.length < PAGE) break;
  }

  return { byCas, byName, ambiguousCas };
}

/**
 * Kunci pencocokan utama adalah NAMA produk; CAS hanya cadangan, dan hanya
 * kalau CAS itu cuma dipakai satu bahan.
 *
 * Dibalik dari rancangan awal setelah pricelist Ecofragrantica 2026 memperlihatkan
 * satu CAS dipakai beberapa produk berbeda ("Benzoin 50-etha" dan "Benzoin
 * 50-bb", "Clove Leaf Oil" dan "Clove Bud Oil"). Dengan CAS sebagai kunci
 * utama, import kedua akan menimpa produk yang satu dengan harga produk yang
 * lain — diam-diam, dan tidak ada yang akan sadar sampai HPP-nya aneh.
 *
 * CAS yang benar-benar unik tetap berguna: dia yang membuat produk yang
 * DIGANTI NAMANYA oleh supplier tetap dikenali sebagai bahan yang sama.
 */
function matchExisting(
  index: GlobalIndex,
  cas: string | null,
  name: string,
): string | null {
  const byName = index.byName.get(name.toLowerCase());
  if (byName) return byName;
  if (cas && !index.ambiguousCas.has(cas)) {
    return index.byCas.get(cas) ?? null;
  }
  return null;
}

/**
 * Import pricelist ke master bahan GLOBAL (owner_id null).
 *
 * Aturan yang tidak boleh dilanggar:
 *  - Kunci pencocokan utama CAS number, nama cadangan
 *  - JANGAN pernah menimpa odor_impact_override, odor_impact_note, dan
 *    personal_note — itu hasil belajar user, bukan data supplier. Caranya:
 *    kolom-kolom itu tidak pernah masuk payload, jadi tidak mungkin tersentuh.
 *  - Kolom impact kosong tetap null, jangan diisi 0 atau 100
 *  - Idempoten: file yang sama dijalankan dua kali tidak membuat duplikat
 */
export async function importMaterialsCsv(
  rawRows: Record<string, unknown>[],
  columnMap: Partial<Record<MaterialColumn, string>>,
): Promise<ActionResult<ImportSummary>> {
  const { rows, failures } = parseMaterialRows(rawRows, columnMap);
  if (!rows.length) {
    return fail(
      failures.length
        ? `Tidak ada baris yang valid dari ${rawRows.length} baris terbaca. Perbaiki dulu baris yang gagal.`
        : "File tidak berisi baris data.",
    );
  }

  const db = getDb();
  const existing = await loadGlobalIndex();

  const payload = rows.map((r) => {
    const id = matchExisting(existing, r.cas_number, r.name);

    // Semua yang di bawah ini DITURUNKAN dari data supplier, bukan diketik
    // user, jadi aman disegarkan tiap import. Koreksi user hidup di kolom lain
    // (odor_impact_override, odor_impact_note, personal_note) yang memang tidak
    // pernah masuk payload ini.
    //
    // Aturannya sama persis dengan form bahan baru — lewat deriveMaterial().
    const derived = deriveMaterial(
      {
        name: r.name,
        synonym: r.synonym,
        family: r.family,
        category: r.category,
        odourProfile: r.odour_profile,
        impact: r.odor_impact,
      },
      FACET_CONFIG,
    );

    return {
      ...(id ? { id } : {}),
      owner_id: null,
      name: r.name,
      synonym: r.synonym,
      cas_number: r.cas_number,
      family: r.family,
      category: r.category,
      odour_profile: r.odour_profile,
      function_category: r.function_category,
      odor_impact: r.odor_impact,
      tgsc_url: r.tgsc_url,
      // Dilusi yang sudah menempel dari pabrik, dibaca dari nama produk.
      // 100 = neat. supplier_solvent_id disambungkan di pass kedua, setelah
      // semua bahan punya id.
      supplier_dilution_pct: derived.supplierDilutionPct,
      is_solvent: derived.isSolvent,
      is_bridge_candidate: derived.isBridgeCandidate,
      note_tier_hint: derived.noteTierHint,
      _line: r.line,
      _isNew: !id,
      _facets: derived.facets,
      _solventToken: derived.solventToken,
    };
  });

  const created = payload.filter((p) => p._isNew).length;
  const updated = payload.length - created;

  // Baris lama dan baris baru dikirim terpisah karena bentuk payload-nya beda
  // (yang lama membawa id untuk ON CONFLICT, yang baru tidak).
  const toInsert = payload.filter((p) => p._isNew);
  const toUpdate = payload.filter((p) => !p._isNew);

  const lineToId = new Map<number, string>();

  for (const batch of chunk(toUpdate)) {
    const { data, error } = await db
      .from("raw_materials")
      .upsert(
        batch.map(({ _line, _isNew, _facets, _solventToken, ...r }) => r),
        { onConflict: "id" },
      )
      .select("id, name, cas_number");
    if (error) return fail(`Gagal memperbarui bahan: ${describeDbError(error)}`);
    mapBackIds(batch, data ?? [], lineToId);
  }

  for (const batch of chunk(toInsert)) {
    const { data, error } = await db
      .from("raw_materials")
      .insert(
        batch.map(({ _line, _isNew, _facets, _solventToken, id: _id, ...r }) => r),
      )
      .select("id, name, cas_number");
    if (error) return fail(`Gagal menambah bahan: ${describeDbError(error)}`);
    mapBackIds(batch, data ?? [], lineToId);
  }

  // Harga masuk sebagai baris baru di rm_prices dengan effective_date hari ini.
  const today = new Date().toISOString().slice(0, 10);
  const priceRows = rows.flatMap((r) => {
    const id = lineToId.get(r.line);
    if (!id) return [];
    return r.prices.map((p) => ({
      raw_material_id: id,
      tier_size: p.tier_size,
      price_idr: p.price_idr,
      effective_date: today,
    }));
  });

  for (const batch of chunk(priceRows)) {
    const { error } = await db
      .from("rm_prices")
      .upsert(batch, {
        onConflict: "raw_material_id,tier_size,effective_date",
      });
    if (error) return fail(`Gagal menyimpan harga: ${describeDbError(error)}`);
  }

  // --- pass kedua: hal-hal yang baru bisa dikerjakan setelah semua punya id --
  await linkSupplierSolvents(payload, lineToId);
  await writeFacets(payload, lineToId);

  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  revalidatePath("/");

  return ok({
    read: rawRows.length,
    created,
    updated,
    priceRows: priceRows.length,
    failures,
  });
}

type ImportRow = {
  _line: number;
  _facets: Record<string, number>;
  _solventToken: SolventToken | null;
};

/**
 * Menyambungkan baris encer ke baris pelarutnya.
 *
 * "Indole 50 BB" perlu tahu bahwa BB-nya adalah baris Benzyl Benzoate yang
 * juga ada di master — tanpa itu, pelarut yang terbawa tidak bisa dijumlahkan
 * dan laporan pelarut jadi kosong.
 *
 * Pelarut yang tidak ada di master dibiarkan null, bukan dipaksakan: lebih
 * baik satu kolom kosong daripada menunjuk ke bahan yang salah.
 */
async function linkSupplierSolvents(
  payload: ImportRow[],
  lineToId: Map<number, string>,
) {
  const needed = payload.filter((p) => p._solventToken);
  if (!needed.length) return;

  const db = getDb();
  const { data } = await db
    .from("raw_materials")
    .select("id, name")
    .is("owner_id", null)
    .eq("is_solvent", true);

  const idByToken = new Map<SolventToken, string>();
  for (const [token, pattern] of Object.entries(SOLVENT_PRODUCTS)) {
    const hit = (data ?? []).find((m) => pattern.test(m.name));
    if (hit) idByToken.set(token as SolventToken, hit.id);
  }

  const updates = new Map<string, string[]>();
  for (const row of needed) {
    const id = lineToId.get(row._line);
    const solventId = idByToken.get(row._solventToken!);
    if (!id || !solventId) continue;
    const list = updates.get(solventId) ?? [];
    list.push(id);
    updates.set(solventId, list);
  }

  for (const [solventId, ids] of updates) {
    for (const batch of chunk(ids)) {
      await db
        .from("raw_materials")
        .update({ supplier_solvent_id: solventId })
        .in("id", batch);
    }
  }
}

/**
 * Menulis vektor facet tiap bahan.
 *
 * Bahan dengan `facets_manual = true` dilewati: facet-nya sudah dikurasi
 * sendiri, dan hasil hitungan otomatis tidak boleh menimpanya.
 */
async function writeFacets(
  payload: ImportRow[],
  lineToId: Map<number, string>,
) {
  const db = getDb();

  const ids = payload
    .map((p) => lineToId.get(p._line))
    .filter((id): id is string => !!id);
  if (!ids.length) return;

  const manual = new Set<string>();
  for (const batch of chunk(ids)) {
    const { data } = await db
      .from("raw_materials")
      .select("id")
      .eq("facets_manual", true)
      .in("id", batch);
    for (const row of data ?? []) manual.add(row.id);
  }

  const rows: { raw_material_id: string; facet_key: string; weight: number }[] =
    [];
  const replacing: string[] = [];

  for (const p of payload) {
    const id = lineToId.get(p._line);
    if (!id || manual.has(id)) continue;
    replacing.push(id);
    for (const [facet_key, weight] of Object.entries(p._facets)) {
      rows.push({ raw_material_id: id, facet_key, weight });
    }
  }

  // Ganti utuh, bukan tambah: bahan yang facet-nya menyusut setelah namanya
  // diperbaiki supplier tidak boleh menyisakan facet lama.
  for (const batch of chunk(replacing)) {
    const { error } = await db
      .from("raw_material_facets")
      .delete()
      .in("raw_material_id", batch);
    if (error) throw new Error(describeDbError(error));
  }

  for (const batch of chunk(rows)) {
    const { error } = await db.from("raw_material_facets").insert(batch);
    if (error) throw new Error(describeDbError(error));
  }
}

function mapBackIds(
  batch: { _line: number; name: string; cas_number: string | null }[],
  returned: { id: string; name: string; cas_number: string | null }[],
  into: Map<number, string>,
) {
  const byCas = new Map(
    returned.filter((r) => r.cas_number).map((r) => [r.cas_number!, r.id]),
  );
  const byName = new Map(returned.map((r) => [r.name.toLowerCase(), r.id]));
  for (const row of batch) {
    const id =
      (row.cas_number ? byCas.get(row.cas_number) : undefined) ??
      byName.get(row.name.toLowerCase());
    if (id) into.set(row._line, id);
  }
}

/**
 * Koreksi kategori fungsi dan tier hint.
 *
 * Keduanya datang dari pricelist supplier dan sering tidak cocok untuk yang
 * memakainya: Ecofragrantica menaruh Linalool di family Citrus, jadi tier
 * hint-nya "top", padahal banyak perfumer memperlakukannya sebagai mid.
 *
 * Disimpan di kolom override terpisah supaya import pricelist berikutnya tidak
 * pernah menghapusnya. Mengosongkan nilainya mengembalikan bahan itu ke data
 * supplier — bukan mengosongkan kategorinya.
 */
export async function setMaterialRoleOverride(
  id: string,
  input: {
    functionCategory?: FunctionCategoryEnum | null;
    noteTierHint?: "top" | "mid" | "base" | null;
    note?: string | null;
  },
): Promise<ActionResult> {
  const patch: {
    function_category_override?: FunctionCategoryEnum | null;
    note_tier_hint_override?: "top" | "mid" | "base" | null;
    function_category_note?: string | null;
  } = {};

  if ("functionCategory" in input) {
    patch.function_category_override = input.functionCategory ?? null;
  }
  if ("noteTierHint" in input) {
    patch.note_tier_hint_override = input.noteTierHint ?? null;
  }
  if ("note" in input) {
    patch.function_category_note = input.note?.trim() || null;
  }

  if (!Object.keys(patch).length) return ok();

  const db = getDb();
  const { error } = await db.from("raw_materials").update(patch).eq("id", id);
  if (error) return fail(describeDbError(error));

  revalidatePath(`/materials/${id}`);
  revalidatePath("/materials");
  revalidatePath("/admin/materials");
  return ok();
}
