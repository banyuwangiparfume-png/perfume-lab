# Fase 3 — Tech Stack, Data Model & Kalkulasi (PRD v2)

> Lanjutan file 01–02. Berisi stack, skema database lengkap, lapisan kalkulasi (paling kritis), parser pricelist, server actions, struktur folder, seed, migrasi dari v1, dan fixture test.

---

## 1. Stack

| Lapisan | Pilihan |
|---|---|
| Framework | **Next.js 14+ (App Router)**, TypeScript strict |
| Database | **Supabase** (Postgres + Auth) |
| Client DB | `@supabase/supabase-js` + `@supabase/ssr` |
| Styling | **Tailwind CSS** + **shadcn/ui** |
| Chart | **Recharts** (donut/pie, bar horizontal) |
| Form | **react-hook-form** + **zod** |
| Tabel | **TanStack Table** |
| Parse Excel | **SheetJS** (`xlsx`) — dijalankan di server action |
| State editor | **Zustand** (state draf formula di client; kalkulasi live) |
| Test | **Vitest** untuk `lib/calc/` |
| PDF / print | print stylesheet (lembar timbang), `@react-pdf/renderer` untuk HPP (opsional) |
| Repo | **GitHub** |
| Deploy | **Vercel** (Node runtime) + **Supabase Cloud** |

Hindari API khusus Vercel (`@vercel/kv`, `@vercel/blob`, Edge Runtime) supaya tetap bisa pindah ke VPS tanpa menulis ulang.

---

## 2. Prinsip Desain Data

1. **Persen adalah sumber kebenaran baris formula, gram adalah turunan.** *(Berubah dari v1.)* v2 adalah kalkulator yang sering mengubah skala batch (3 g ↔ 120 g). Menyimpan gram akan memaksa konversi ulang setiap kali batch berubah. Persen disimpan `numeric(9,5)` — presisi cukup sehingga pembulatan tidak merusak reproduksi.
2. **Persen baris = % timbang dari total formula** (bukan dari tier, bukan % aktif). Dilusi disimpan terpisah. Persen aktif selalu turunan.
3. **Dua lapis dilusi**: dilusi supplier menempel di `raw_materials`, dilusi user menempel di `formula_lines`. Jangan digabung.
4. **Pelarut adalah bahan biasa** (`raw_materials`), dirujuk lewat FK, bukan teks bebas — supaya bisa dijumlahkan dan dihargai.
5. **Data supplier dan koreksi user di kolom berbeda.** Upload pricelist hanya menyentuh kolom supplier.
6. **Versi tidak diubah setelah punya evaluasi** (dari v1). Draf boleh diubah bebas.
7. **`owner_id` + RLS sejak hari pertama.**
8. **Semua kalkulasi adalah fungsi murni di `lib/calc/`**, dipakai server dan client, dites dengan Vitest. Tidak ada rumus di komponen React atau SQL.

---

## 3. Skema Database

### 3.1 Enum

```sql
create type user_role         as enum ('user','admin');
create type function_category as enum ('diffuser','modifier','bridger','fixative');
create type formula_category  as enum ('fragrance','accord');
create type tier_key          as enum ('top','mid','base','all');
create type line_type         as enum ('raw_material','accord','fo');
create type version_status    as enum ('draft','saved','mixed','evaluated','locked');
create type rule_source       as enum ('temen','klasik','saya');
create type impact_basis      as enum ('as_sold','active');
create type import_status     as enum ('previewed','applied','discarded');
-- enum evaluasi dari v1 tetap: eval_medium, eval_purpose, transition_verdict
```

### 3.2 `profiles`

```sql
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  role         user_role not null default 'user',
  created_at   timestamptz not null default now()
);
```

### 3.3 `raw_materials`

```sql
create table raw_materials (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid references profiles(id) on delete cascade,
  -- NULL = bahan global dari pricelist; terisi = bahan tambahan milik user

  -- kolom SUPPLIER (boleh ditimpa saat upload pricelist)
  name                  text not null,
  name_normalized       text not null,          -- lihat §6.3
  synonym               text,
  cas_number            text,
  family                text,                   -- Floral, Woody, Citrus, Musk / Animalic, ...
  category              text,                   -- Aromachemical, Essential Oil, Accord, Base, Solvent, Single Notes, ...
  odour_profile         text,
  function_category     function_category,
  odor_impact           numeric(10,2),          -- 100 = acuan
  fr_fl                 text,                   -- FR / FL / FR/FL
  tgsc_url              text,
  supplier              text default 'Ecofragrantica',
  supplier_dilution_pct numeric(7,4) not null default 100,  -- dari nama: "Indole 50 BB" -> 50
  supplier_solvent_id   uuid references raw_materials(id),  -- -> Benzyl Benzoate
  last_seen_import_id   uuid,                   -- FK ke import_batches, diisi saat upload

  -- kolom USER (tidak pernah ditimpa upload)
  odor_impact_override  numeric(10,2),
  odor_impact_note      text,
  impact_basis          impact_basis not null default 'as_sold',
  note_tier_hint        tier_key,               -- top/mid/base; awal dari family, bisa dikoreksi
  facets_manual         boolean not null default false,
  is_bridge_candidate   boolean not null default true,
  is_solvent            boolean not null default false,  -- muncul di pilihan pelarut dilusi
  ifra_cat4_limit_pct   numeric(7,4),           -- disiapkan, belum divalidasi
  personal_note         text,
  is_active             boolean not null default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index raw_materials_global_name_uniq
  on raw_materials (name_normalized) where owner_id is null;
create index on raw_materials (owner_id);
create index on raw_materials (category);
create index on raw_materials using gin (to_tsvector('simple', name || ' ' || coalesce(synonym,'')));
```

**Kenapa unik di nama, bukan CAS:** Ecofragrantica menjual beberapa produk dengan CAS sama (`Ambroxan` dan `Ambroxan 10-TEC`). CAS hanya dipakai sebagai pencocok cadangan (§6.4).

**Turunan (hitung di aplikasi):**
```ts
effectiveImpact = odor_impact_override ?? odor_impact   // boleh null
```

### 3.4 `rm_prices`

```sql
create table rm_prices (
  id               uuid primary key default gen_random_uuid(),
  raw_material_id  uuid not null references raw_materials(id) on delete cascade,
  tier_size        numeric(10,2) not null,   -- 5, 10, 50, 100, 500 (g/ml)
  price_idr        numeric(14,2) not null,
  effective_date   date not null,            -- tanggal pricelist
  import_batch_id  uuid,
  created_at       timestamptz not null default now(),
  unique (raw_material_id, tier_size, effective_date)
);
create index on rm_prices (raw_material_id, effective_date desc);
```

Harga yang dipakai kalkulasi = baris dengan `effective_date` terbaru per `(raw_material_id, tier_size)`. Buat view:

```sql
create view rm_current_prices as
select distinct on (raw_material_id, tier_size)
       raw_material_id, tier_size, price_idr, price_idr / tier_size as price_per_unit, effective_date
from rm_prices
order by raw_material_id, tier_size, effective_date desc;
```

Satuan supplier campur g dan ml. v2 menganggap **1 ml = 1 g** dan menuliskannya di UI HPP.

### 3.5 `facets` + `raw_material_facets`

```sql
create table facets (
  key        text primary key,       -- 'citrus', 'woody', ...
  label      text not null,          -- 'Citrus', 'Woody', ...
  color      text not null,          -- hex, lihat file 04 §1.6
  sort_order int not null
);

create table raw_material_facets (
  raw_material_id uuid references raw_materials(id) on delete cascade,
  facet_key       text references facets(key),
  weight          numeric(4,3) not null check (weight > 0 and weight <= 1),
  primary key (raw_material_id, facet_key)
);
```

20 facet di-seed dari `seed/facet-keywords.json`. Vektor facet tiap bahan dinormalisasi panjang 1 (L2). Dihitung otomatis saat import (§4.9), kecuali `facets_manual = true`.

### 3.6 `bridge_rules`

```sql
create table bridge_rules (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references profiles(id) on delete cascade,  -- null = bawaan
  raw_material_id uuid not null references raw_materials(id) on delete cascade,
  facet_a         text not null references facets(key),
  facet_b         text not null references facets(key),
  note            text,
  source          rule_source not null default 'saya',
  created_at      timestamptz not null default now()
);
create index on bridge_rules (raw_material_id);
```

Seed dari `seed/seed-bridge-rules.csv` (54 aturan), dicocokkan ke bahan lewat `name_normalized`, fallback CAS.

### 3.7 `user_stock`

```sql
create table user_stock (
  owner_id        uuid references profiles(id) on delete cascade,
  raw_material_id uuid references raw_materials(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (owner_id, raw_material_id)
);
```

### 3.8 `fragrance_oils` (dari v1, tidak berubah)

Tabel terpisah, **tanpa kolom impact**. Lihat PRD v1 §3.5. Kolom `price_per_gram` dipakai untuk HPP.

### 3.9 `formulas`

```sql
create table formulas (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles(id) on delete cascade,
  name            text not null,
  category        formula_category not null default 'fragrance',
  pyramid_mode    boolean not null default true,
  target_family   text,
  description     text,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on formulas (owner_id, category, is_archived);
```

### 3.10 `formula_versions`

```sql
create table formula_versions (
  id                  uuid primary key default gen_random_uuid(),
  formula_id          uuid not null references formulas(id) on delete cascade,
  version_no          integer not null,          -- 0 = draf kerja
  label               text,
  change_note         text,                      -- wajib untuk version_no > 1
  parent_version_id   uuid references formula_versions(id) on delete set null,
  status              version_status not null default 'draft',

  batch_g             numeric(10,3) not null default 10,
  top_pct             numeric(7,4),              -- null kalau pyramid_mode = false
  mid_pct             numeric(7,4),
  base_pct            numeric(7,4),
  price_tier_override numeric(10,2),             -- null = pakai aturan settings

  mixed_at            timestamptz,               -- dari v1
  diluted_at          timestamptz,               -- dari v1
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (formula_id, version_no),
  constraint pyramid_sum check (
    top_pct is null or abs(top_pct + mid_pct + base_pct - 100) < 0.001
  )
);
```

**Draf vs versi.** Tiap formula punya tepat satu baris `version_no = 0` (draf kerja) yang di-autosave. **Simpan versi** menyalin draf → baris baru `version_no = max + 1`, status `saved`. Draf tetap ada untuk diedit lanjut. Constraint `pyramid_sum` hanya mengikat versi tersimpan — untuk draf, validasi di aplikasi (draf boleh sementara 105%). Implementasi: jalankan check hanya kalau `version_no > 0` (pakai trigger atau check `version_no = 0 or ...`).

### 3.11 `formula_lines`

```sql
create table formula_lines (
  id                  uuid primary key default gen_random_uuid(),
  formula_version_id  uuid not null references formula_versions(id) on delete cascade,
  tier                tier_key not null default 'all',

  line_type           line_type not null default 'raw_material',
  raw_material_id     uuid references raw_materials(id) on delete restrict,
  accord_version_id   uuid references formula_versions(id) on delete restrict,
  fo_id               uuid references fragrance_oils(id) on delete restrict,

  pct                 numeric(9,5) not null check (pct >= 0),   -- % TIMBANG dari total formula
  is_locked           boolean not null default false,
  user_dilution_pct   numeric(7,4) not null default 100 check (user_dilution_pct > 0 and user_dilution_pct <= 100),
  user_solvent_id     uuid references raw_materials(id),        -- wajib kalau user_dilution_pct < 100

  note                text,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),

  constraint ref_matches_type check (
       (line_type = 'raw_material' and raw_material_id is not null and accord_version_id is null and fo_id is null)
    or (line_type = 'accord'       and accord_version_id is not null and raw_material_id is null and fo_id is null)
    or (line_type = 'fo'           and fo_id is not null and raw_material_id is null and accord_version_id is null)
  ),
  constraint solvent_when_diluted check (user_dilution_pct = 100 or user_solvent_id is not null),
  constraint no_self_ref check (accord_version_id is null or accord_version_id <> formula_version_id)
);
create index on formula_lines (formula_version_id, tier, sort_order);
```

**Baris accord merujuk ke versi tersimpan** (bukan draf) dari formula berkategori `accord`. Validasi di aplikasi: kategori harus accord, tidak ada siklus, kedalaman ≤ 3. Saat accord punya versi baru, formula induk **tidak** otomatis pindah — tampilkan badge "Ada versi baru Jasmine Accord (v4)" dengan tombol "Pakai v4".

**Jangan simpan gram.** Gram = `pct / 100 × batch_g`.

### 3.12 `import_batches`

```sql
create table import_batches (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles(id),
  file_name       text not null,
  pricelist_date  date not null,
  status          import_status not null default 'previewed',
  summary         jsonb not null,       -- hitungan + daftar perubahan untuk pratinjau
  created_at      timestamptz not null default now(),
  applied_at      timestamptz
);
```

### 3.13 `app_settings`

```sql
create table app_settings (
  owner_id  uuid primary key references profiles(id) on delete cascade,
  settings  jsonb not null default '{}'::jsonb
);
```

Bentuk `settings` (dengan default di kode, `lib/settings.ts`):
```ts
{
  priceTierRules: [ {maxBatchExclusive: 50, tier: 10}, {maxBatchExclusive: 100, tier: 50},
                    {maxBatchExclusive: 500, tier: 100}, {maxBatchExclusive: null, tier: 500} ],
  bridgeThresholds: { connected: 0.45, loose: 0.20 },
  solventWarn: { singlePct: 10, totalPct: 25 },
  dominance: { minStrengthPct: 20, ratio: 3 },
  supplierSolventTokens: { TEC: "<uuid TEC>", BB: "<uuid Benzyl Benzoate>", DPG: "...", ETHA: "<uuid Ethanol>", CASTOR: null, IPM: null }
}
```

### 3.14 Tabel v1 yang dipakai ulang tanpa perubahan

`evaluations`, `evaluation_points`, `packaging_items`, `cost_sheet_items` — skema persis seperti PRD v1 §3.9–3.12.

`cost_sheets`: tambah dua kolom
```sql
alter table cost_sheets
  add column concentrate_source text not null default 'fo' check (concentrate_source in ('fo','formula')),
  add column concentrate_price_per_g_snapshot numeric(12,2);  -- dibekukan saat cost sheet disimpan
-- formula_version_id sudah ada di v1
```

### 3.15 RLS

Pola sama dengan v1:
- Tabel milik user (`formulas`, `fragrance_oils`, `user_stock`, `app_settings`, `import_batches`): `owner_id = auth.uid()`.
- `raw_materials`, `bridge_rules`: baca `owner_id is null or owner_id = auth.uid()`; tulis global hanya admin.
- `rm_prices`, `raw_material_facets`: baca ikut bahan induknya; tulis hanya admin (untuk global) atau pemilik bahan.
- Tabel anak (`formula_versions`, `formula_lines`): lewat join ke `formulas`.
- **Baris accord**: policy baca `formula_lines` harus mengizinkan membaca versi accord milik user sendiri — sudah tercakup selama accord juga milik user. Accord milik orang lain tidak bisa dirujuk di v2.

Fase 1–4 tanpa auth: server action pakai service-role key + UUID dummy tetap (`DEV_OWNER_ID`). RLS tetap aktif.

---

## 4. Lapisan Kalkulasi — `lib/calc/`

Semua fungsi murni, tanpa akses DB. Input diambil oleh loader (`lib/data/loadFormula.ts`) yang mengumpulkan versi, baris, bahan, facet, harga, dan accord (rekursif) jadi satu objek `FormulaContext`.

### 4.1 Tipe inti

```ts
type Tier = 'top' | 'mid' | 'base' | 'all';

interface Material {
  id: string; name: string; category: string | null;
  impact: number | null;                 // effectiveImpact
  impactBasis: 'as_sold' | 'active';
  supplierDilutionPct: number;           // 100 = neat
  supplierSolventId: string | null;
  facets: Record<string, number>;        // L2-normalized, bisa kosong
  functionCategory: string | null;
  noteTierHint: Tier | null;
  isBridgeCandidate: boolean;
  prices: Record<number, number>;        // tier_size -> price_idr (terbaru)
}

interface Line {
  id: string; tier: Tier; type: 'raw_material' | 'accord' | 'fo';
  refId: string; pct: number; locked: boolean;
  userDilutionPct: number; userSolventId: string | null;
}

interface Version { id: string; batchG: number; pyramid: { top: number; mid: number; base: number } | null;
                    priceTierOverride: number | null; lines: Line[]; }

interface FormulaContext {
  version: Version;
  materials: Map<string, Material>;
  accords: Map<string, Version>;          // versionId -> version (isinya ikut dimuat)
  fos: Map<string, { id: string; name: string; pricePerGram: number | null }>;
  settings: Settings;
}
```

### 4.2 `allocate.ts` — pembagian persen dalam tier

```ts
allocateTier(lines: Line[], target: number): Line[]
```
1. `lockedSum = Σ pct (locked)`; `unlocked = lines.filter(!locked)`
2. `remaining = max(0, target - lockedSum)`
3. Kalau `unlocked.length > 0`: tiap baris unlocked = `round5(remaining / n)`; baris unlocked terakhir = `remaining − Σ yang lain` (menyerap sisa pembulatan)
4. Kembalikan baris baru (immutable)

Operasi lain (semuanya memanggil `allocateTier` di akhir):
```ts
addLine(tierLines, newLine, target)            // newLine.locked = false
editLinePct(tierLines, lineId, pct, target)    // set locked = true lalu allocate
removeLine(tierLines, lineId, target)
normalizeTier(tierLines, target)               // kali target/total, semua locked
applyRatio(tierLines, ratios: Record<id, number>, target)  // semua locked
spreadEven(tierLines, target)                  // semua unlocked
scaleTier(tierLines, oldTarget, newTarget)     // kali newTarget/oldTarget, gembok tetap
moveLine(fromLines, toLines, lineId, fromTarget, toTarget)
tierStatus(tierLines, target) -> { filled, diff, ok: |diff| <= 0.01 }
```

### 4.3 `supplierDilution.ts` — baca dilusi dari nama supplier

```ts
parseSupplierDilution(name: string): { pct: number; solventToken: string } | null
// regex (case-insensitive):
//   /(\d+(?:[.,]\d+)?)\s*-?\s*(TEC|BB|DPG|IPM|ETHA|ETHANOL|CASTOR)\b/i
// koma desimal -> titik. Contoh:
//   "1-Octen 3-One 1-TEC"                  -> {1, TEC}
//   "2-Methoxy 3-Isobutyl Pyrazine 0,04 TEC" -> {0.04, TEC}
//   "Indole 50 BB"                          -> {50, BB}
//   "Benzoin 50-etha"                       -> {50, ETHA}
//   "Galbanum Resin 50 - etha"              -> {50, ETHA}
//   "Oud Resin 5 TEC Etha"                  -> {5, TEC}   (ambil match pertama)
//   "Aldehyde C-12 MNA 10-TEC"              -> {10, TEC}  ("C-12 MNA" tidak cocok karena tidak diikuti token pelarut)
//   "Bergamot Oil Italy FCF"                -> null
```
Hasilnya ditampilkan di pratinjau import ("13 bahan terdeteksi sudah encer") dan bisa dikoreksi admin.

### 4.4 `expand.ts` — membentangkan formula jadi komposisi nyata

```ts
interface ExpandedItem {
  kind: 'material' | 'fo';
  refId: string;
  tier: Tier;                 // tier baris asal di formula induk
  role: 'ingredient' | 'user_solvent';
  productPct: number;         // % dari total formula, bentuk yang dibeli/ditimbang
  activePct: number;          // productPct × supplierDilution (molekul murni)
  strengthBasisPct: number;   // productPct (as_sold) atau activePct (active)
  hiddenSolvent?: { solventId: string | null; pct: number };   // pelarut bawaan supplier
  via: string[];              // jalur accord, contoh ['Jasmine Accord v3']
  sourceLineId: string;       // baris formula induk asalnya
}

expand(ctx: FormulaContext, version = ctx.version, factor = 1, via = [], depth = 0): ExpandedItem[]
```
Untuk tiap baris:
```
product = line.pct × factor × line.userDilutionPct / 100
userSolvent = line.pct × factor × (1 − line.userDilutionPct / 100)

raw_material:
  push ingredient { productPct: product,
                    activePct: product × m.supplierDilutionPct / 100,
                    hiddenSolvent: { m.supplierSolventId, product × (1 − m.supplierDilutionPct/100) } }
accord:
  sub = ctx.accords.get(refId); subTotal = Σ sub.lines.pct
  push ...expand(ctx, sub, product / subTotal, [...via, nama accord], depth + 1)
  (tier semua item hasil = tier baris accord di induk)
fo:
  push fo { productPct: product, activePct: product }
lalu, kalau userSolvent > 0:
  push user_solvent { refId: line.userSolventId, productPct: userSolvent, activePct: userSolvent }
```
Lempar error kalau `depth > 3` atau versi accord sudah ada di `via` (siklus).

```ts
mergeByMaterial(items): Map<refId, { productPct, activePct, strengthBasisPct, sources: ExpandedItem[] }>
```

### 4.5 `strength.ts`

```ts
strengthOf(item, material) = item.strengthBasisPct × (material.impact ?? 100)
// FO: tidak dihitung. Pelarut kategori Solvent dengan impact null: 0.
strengthTable(ctx) -> rows per bahan { weighPct (dari baris langsung), productPct, strengthPct, impactMissing, via[] }
strengthBasisCoverage = Σ productPct item non-FO   // "dihitung dari X% formula"
realPyramid(ctx) -> per tier { target, filled (Σ line.pct), active (Σ activePct ingredient, tanpa user_solvent & tanpa hidden solvent) }
```

### 4.6 `aroma.ts` — pie dominasi facet

```ts
aromaShares(items, materials, tierFilter?: Tier): { facet, pct, contributors: {name, pct}[] }[]
// untuk tiap item ingredient/user_solvent dengan facet tidak kosong:
//   s = strengthOf(item); L1 = Σ facets[f]
//   share[f] += s × facets[f] / L1
// normalisasi ke 100; urutkan; UI ambil 6 teratas + "Lainnya"

tierVector(items, materials, tier): Record<facet, number>
// Σ strengthOf(item) × facets  (tanpa L1), lalu normalisasi L2 -> dipakai bridger antar tier
```

### 4.7 `solvents.ts`

```ts
solventReport(items, materials, directLines): SolventRow[]
// SolventRow { solventId, name, directPct, fromDilution: [{lineName, pct}], fromAccords: [{accordName, pct}],
//              hiddenFromSupplier: [{materialName, pct}], explicitTotal, effectiveTotal }
// explicitTotal  = direct + fromDilution + fromAccords
// effectiveTotal = explicitTotal + hiddenFromSupplier
suggestDirectAdjustment(row, targetEffectivePct) -> { newDirectPct }   // max(0, direct − (effective − target))
```
Bahan dianggap pelarut kalau `is_solvent = true` **atau** muncul sebagai `user_solvent`/`hiddenSolvent`.

### 4.8 `price.ts` + `cost.ts`

```ts
pickTier(batchG, settings, override?): number
// override ?? rule pertama dengan batchG < maxBatchExclusive (null = tak terbatas)

pricePerUnit(material, tier): { price: number | null; usedTier: number | null; fallback: boolean }
// 1) prices[tier] ada -> pakai
// 2) tidak ada -> tier terdekat yang LEBIH KECIL (harga/g lebih mahal = konservatif)
// 3) tidak ada juga -> tier terdekat yang lebih besar
// 4) tidak ada harga sama sekali -> null (baris ditandai "harga belum ada")
// harga per unit = price / tier

costBreakdown(ctx): { tier, rows: {name, grams, pricePerG, cost, sharePct, fallback, usedTier}[], total, perGram, per100g, missing: string[] }
// grams = productPct / 100 × batchG ; hanya item kind material (ingredient & user_solvent) + FO
// hidden solvent TIDAK dihargai terpisah (sudah termasuk harga produk supplier)
```

### 4.9 `facetize.ts` — menghitung facet dari odour profile (dipakai saat import)

Port dari skrip Python yang sudah divalidasi, konfigurasi lengkap di `seed/facet-keywords.json`:
```
1. teks = odour_profile lowercase; gabungkan frasa ("bois de rose" -> "bois-de-rose")
2. token = split non-huruf; buang duplikat (pertahankan urutan pertama)
3. untuk token ke-i dari n: bobot = 1.0 − 0.5 × i/n; tambahkan ke semua facet yang memuat keyword itu
4. token di nama + sinonim: +0.4 per facet cocok
5. family supplier -> facet (tabel family_to_facet) +0.4
   pengecualian: family Herbal dan 'spicy' ada di 3 token pertama -> facet spicy
6. 'sweet' ada tapi facet gourmand belum -> gourmand 0.25
7. sub-facet rose/white menambah floral 0.4 × bobotnya
8. normalisasi L2; buang facet < 0.08
9. kalau nama cocok manual_overrides -> pakai override
```
Kandidat bridger (`is_bridge_candidate`): kategori ada di daftar `bridge_candidate.categories`, punya facet, impact < 1000, dan 4 token pertama tidak memuat kata off-note. Tier hint awal dari `note_tier_hint_from_family`.

### 4.10 `bridge.ts`

```ts
sim(a, b) = Σ a[f] × b[f]                         // vektor L2 -> cosine
status(s) = s >= 0.45 ? 'connected' : s >= 0.20 ? 'loose' : 'gap'
top(v)    = facet dengan bobot >= 0.3

suggestBridges(A: Vec, B: Vec, ctx, excludeIds, opts { onlyStock, limit = 5 })
  untuk tiap material X dengan isBridgeCandidate && !excludeIds.has(X.id) (&& stok kalau onlyStock):
    sa = sim(X, A); sb = sim(X, B)
    rule = aturan X dengan (facet_a ∈ top(A) dan facet_b ∈ top(B)) atau sebaliknya
    lewati kalau !rule && (sa < 0.15 || sb < 0.15)
    skor = (sa + sb) ? 2·sa·sb/(sa+sb) : 0
    rule            -> skor = max(skor, 0.3) + 0.3
    fungsi bridger  -> +0.05
    impact > 500    -> −0.1
    alasan = rule?.note ?? `nyambung ke A lewat ${facet terbesar X·A}, ke B lewat ${facet terbesar X·B}`
  urutkan, ambil limit

crossTierBridges(ctx)  -> untuk pasangan (top,mid), (mid,base), (top,base): tierVector + status + suggestBridges
withinTierBridges(ctx) -> untuk tiap tier, pasangan baris langsung (accord pakai tierVector dari isi accord-nya)
recommendTier(X, pair) -> lihat file 02 §4.6
starterDose(X)         -> impact ≤ 150 ? 1 : 0.5   (% dari formula)
```
Ambang diambil dari settings. Implementasi acuan sudah ada dan berjalan di `bridge-finder.html`.

### 4.11 `rules.ts`

`runRules(ctx, derived) -> Warning[]` untuk R1–R12 (file 02 §4.5). Setiap warning: `{ code, level, message, lineIds?, action? }`. `action` opsional untuk tombol cepat (normalisasi tier, terapkan saran pelarut).

### 4.12 Satu pintu: `analyze.ts`

```ts
analyze(ctx): {
  items, merged, strength, realPyramid, aroma: { all, top, mid, base },
  solvents, cost, bridges: { crossTier, withinTier }, warnings, coverage
}
```
Editor memanggil `analyze` tiap state berubah (debounce 150 ms). Untuk formula ≤ 40 baris + accord, ini jauh di bawah 10 ms; tidak perlu web worker.

---

## 5. Server Actions — `app/actions/`

| Action | Isi |
|---|---|
| `createFormula(input)` | buat formula + draf v0 + baris kosong |
| `saveDraft(versionId, patch)` | autosave draf: batch, piramida, override tier, baris (upsert/hapus) |
| `saveVersion(formulaId, changeNote)` | salin draf jadi versi tersimpan; validasi piramida 100 & tiap tier terisi |
| `duplicateFormula(formulaId)` | salin versi terakhir ke formula baru |
| `setVersionStatus(versionId, status, at?)` | mixed/diluted (dari v1) |
| `useAccordVersion(lineId, accordVersionId)` | pindah baris accord ke versi baru |
| `toggleStock(materialId)` | tambah/hapus `user_stock` |
| `previewImport(formData)` | parse xlsx -> hitung diff -> simpan `import_batches` status previewed -> kembalikan ringkasan |
| `applyImport(importId)` | jalankan perubahan dalam satu transaksi (RPC Postgres `apply_import(import_id)`) |
| `updateMaterial(id, patch)` | admin: field user/supplier, override impact (alasan wajib) |
| `setMaterialFacets(id, facets)` | admin: facet manual, set `facets_manual = true` |
| `recomputeFacets(id?)` | hitung ulang facet otomatis (satu atau semua non-manual) |
| `upsertBridgeRule / deleteBridgeRule` | admin |
| `updateSettings(patch)` | settings user |
| `saveCostSheet(input)` | dari v1 + snapshot harga konsentrat |

Loader read-only di `lib/data/`: `loadFormulaContext(versionId)`, `searchMaterials(q, filters)`, `listAccordsForPicker(ownerId)`.

---

## 6. Import Pricelist Ecofragrantica

### 6.1 Sheet yang dibaca

File contoh: `Pricelist_Ecofragrantica_2026.xlsx`. Isinya beberapa sheet; yang dipakai adalah **sheet daftar RM lengkap** — dideteksi dari isinya, **bukan dari nama sheet** (nama sheet terpotong dan bisa berubah).

**Deteksi:** cari baris yang memuat sel `Name Raw Materials`, `Synonym Name`, dan `CAS-NUMBER`. Baris itu header. Di file 2026 ada tiga sheet berformat ini (Aromachemical, Essential Oil, Specialty Accord) dengan isi tumpang tindih — gabungkan semuanya lalu dedupe berdasarkan `name_normalized`. Hasil di file 2026: **459 bahan unik**.

**Pemetaan kolom** (berdasarkan teks header, bukan posisi):

| Header | Kolom DB |
|---|---|
| Name Raw Materials | `name` |
| Synonym Name | `synonym` ("-" → null) |
| Family | `family` |
| Kategori | `category` |
| Odour Profile | `odour_profile` |
| CAS-NUMBER | `cas_number` (simpan sebagai teks; angka seperti `5033018` tetap teks) |
| `5`, `10`, `50`, `100`, `500` (header numerik) | `rm_prices` per `tier_size` |
| Kategori Fungsi | `function_category` (lowercase; kosong → null) |
| Relative Odor Impact | `odor_impact` |
| Fragrance Agent / Flavoring Agent | `fr_fl` |
| Link Profile TGSC / Scentree | `tgsc_url` ("-" → null) |

**Lewati baris** yang: nama kosong, kolom `No` bukan angka, atau isinya mengulang header.

**Sheet opsional (P1):**
- Sheet dengan header `Single Notes Name` → bahan kategori `Single Notes` (kolom: Sub Family → family, Odour Profile, SKU INDUK → personal_note, harga 5/10/50/100/500).
- Sheet dengan header `Nama Inspired by Ecofragrantica` → `fragrance_oils` milik user yang upload.
- `Sheet1` (pricelist ringkas, nama & harga dibulatkan) **diabaikan**. Formatnya beda dan harganya tidak selalu sama dengan sheet lengkap.

### 6.2 Tanggal pricelist
Cari sel bertipe tanggal di 5 baris teratas sheet mana pun (file 2026 punya `26 Apr 2026` di Sheet1). Kalau tidak ada, pakai hari ini. User bisa mengubahnya di pratinjau.

### 6.3 Normalisasi nama
```ts
normalizeName(s) = s.normalize('NFKC')
  .replace(/[⁠​-‍﻿]/g, '')   // file Eco memuat karakter tak terlihat
  .toLowerCase().replace(/[^a-z0-9]+/g, '')
```

### 6.4 Pencocokan ke data yang sudah ada
1. `name_normalized` sama → bahan yang sama
2. Tidak ketemu, dan CAS-nya unik di file **dan** unik di DB → bahan yang sama (nama di DB diperbarui)
3. Selain itu → bahan baru

### 6.5 Pratinjau (disimpan di `import_batches.summary`)
- **Baru**: N bahan (+ daftar)
- **Harga berubah**: daftar dengan harga lama → baru per tier, dan selisih %
- **Data supplier berubah**: odour/impact/fungsi/family (diff per field)
- **Terdeteksi encer dari nama**: daftar hasil `parseSupplierDilution` (bisa dikoreksi sebelum diterapkan)
- **Tidak ada lagi di file**: tidak dihapus, hanya ditandai "tidak ada di pricelist terbaru"
- **Tidak berubah**: hitungan saja
- **Baris dilewati**: daftar + alasan

### 6.6 Terapkan (satu transaksi)
- Upsert `raw_materials` — **hanya kolom supplier**. Kolom user tidak disentuh.
- Insert `rm_prices` dengan `effective_date = pricelist_date` (harga lama tetap sebagai riwayat)
- Hitung facet (`facetize`) untuk bahan baru dan bahan yang odour-nya berubah, **kecuali `facets_manual = true`**
- Bahan baru: set `note_tier_hint` dari family, `is_solvent = true` untuk kategori Solvent + Benzyl Benzoate/Benzyl Salicylate/IPM
- Petakan token pelarut supplier ke `supplier_solvent_id` (TEC → "Triethyl Citrate / TEC", BB → "Benzyl Benzoate", ETHA → "Ethanol FG 96%", DPG → "Dipropylene Glycol / DPG")
- Status batch → `applied`

---

## 7. Struktur Folder

```
app/
  (main)/
    page.tsx                         # dashboard
    formulas/page.tsx
    formulas/new/page.tsx
    formulas/[id]/page.tsx
    formulas/[id]/edit/page.tsx
    formulas/[id]/weigh/page.tsx
    materials/page.tsx
    materials/[id]/page.tsx
    costing/page.tsx
  admin/
    import/page.tsx
    materials/page.tsx
    bridge-rules/page.tsx
    settings/page.tsx
  actions/                           # server actions (§5)
components/
  editor/  PyramidInput, TierCard, LineRow, LockToggle, DilutionPopover, RatioDialog, MaterialPicker
  analysis/ AnalysisPanel, AromaDonut, StrengthChart, RealPyramid, SolventTable, CostTable, BridgePanel, WarningList
  shared/  ImpactBadge, FacetBars, PriceTierBadge, StarStock, EmptyState, StatTile
lib/
  calc/  types.ts allocate.ts supplierDilution.ts expand.ts strength.ts aroma.ts solvents.ts
         price.ts cost.ts facetize.ts bridge.ts rules.ts analyze.ts
         __tests__/*.test.ts
  data/  loadFormulaContext.ts searchMaterials.ts
  import/ parseEcoXlsx.ts diffImport.ts
  settings.ts  supabase/{server,client}.ts
stores/editorStore.ts                # Zustand: draf + undo sederhana
supabase/
  migrations/*.sql
  seed/  facets.sql  (dibangkitkan dari facet-keywords.json)
seed/
  facet-keywords.json  seed-bridge-rules.csv  calc-fixture-01.json
```

---

## 8. Seed & Urutan Setup

1. Migrasi skema (§3)
2. Seed `facets` dari `seed/facet-keywords.json` (warna dari file 04 §1.6)
3. Upload pricelist pertama lewat `/admin/import` (bukan seed SQL) — supaya jalur import teruji sejak hari pertama
4. Seed `bridge_rules` dari `seed/seed-bridge-rules.csv` (setelah bahan ada)
5. Buat profil dummy `DEV_OWNER_ID` dengan role admin

---

## 9. Migrasi dari v1 (kalau v1 sudah dibangun)

```sql
-- 1. kategori formula
alter table formulas add column category formula_category, add column pyramid_mode boolean not null default false;
update formulas set category = case when type in ('accord','base','booster') then 'accord' else 'fragrance' end;
alter table formulas alter column category set not null;

-- 2. piramida & batch di versi
alter table formula_versions rename column batch_size_g to batch_g;
alter table formula_versions add column top_pct numeric(7,4), add column mid_pct numeric(7,4),
  add column base_pct numeric(7,4), add column price_tier_override numeric(10,2);

-- 3. baris: gram -> persen, sub_formula -> accord, solvent teks -> FK
alter table formula_lines add column tier tier_key not null default 'all',
  add column pct numeric(9,5), add column is_locked boolean not null default true,
  add column user_solvent_id uuid references raw_materials(id);
update formula_lines l set pct = l.weight_g * 100 / t.total
  from (select formula_version_id, sum(weight_g) total from formula_lines group by 1) t
  where t.formula_version_id = l.formula_version_id;
alter table formula_lines rename column dilution_pct to user_dilution_pct;
alter table formula_lines rename column sub_formula_version_id to accord_version_id;
-- line_type: ganti enum value 'sub_formula' -> 'accord' (alter type ... rename value)
-- solvent teks: petakan manual 'DPG','TEC','BB' ke id bahan, sisanya biarkan null + catat di note
-- setelah diverifikasi: drop column weight_g, solvent
```
Formula v1 masuk sebagai mode piramida OFF (tier `all`), semua baris terkunci. User bisa mengaktifkan piramida dan memindahkan baris ke tier.

---

## 10. Fixture Test Wajib — `seed/calc-fixture-01.json`

Satu formula contoh yang **semua angkanya sudah dihitung**. Test Vitest harus mereproduksi angka ini (toleransi: rupiah & persen komposisi 0,01; % kekuatan & pie 0,1 karena ekspektasi dibulatkan 1 desimal).

**Input:** batch 10 g, piramida 15/25/60, harga tier 10 g (pricelist 2026).

| Tier | Bahan | % timbang | Dilusi user | Dilusi supplier | Impact | Harga tier 10 g |
|---|---|---|---|---|---|---|
| top | Bergamot Oil Italy FCF | 10 🔒 | 100 | 100 | 100 | Rp128.000 |
| top | Dihydromyrcenol | 5 | 100 | 100 | 100 | Rp80.000 |
| mid | Hedione | 20 | 100 | 100 | 65 | Rp18.504 |
| mid | Indole 50 BB | 5 | 100 | 50 (BB) | 350 | Rp83.002,4 |
| base | Iso E Super | 25 | 100 | 100 | 40 | Rp15.504 |
| base | Ambroxan | 5 | 10 (BB) | 100 | 400 | Rp220.050 |
| base | Ethylene Brassylate / Musk T | 20 | 100 | 100 | 40 | Rp33.300 |
| base | Benzyl Benzoate | 10 | 100 | 100 | 18 | Rp16.002 |

**Ekspektasi:**

| Hasil | Nilai |
|---|---|
| Alokasi Top setelah tambah DHM, sebelum edit | 7,5 / 7,5 |
| Alokasi Top setelah Bergamot diketik 10 | 10 / 5 |
| Komposisi nyata (% produk) | Bergamot 10 · DHM 5 · Hedione 20 · Indole 50 BB 5 · Iso E 25 · Ambroxan 0,5 · Musk T 20 · **BB 14,5** |
| BB tersembunyi dari supplier | 2,5 → **BB efektif 17,0** |
| Piramida nyata (aktif, tanpa pelarut) | Top 15 · Mid 22,5 · Base 45,5 |
| % kekuatan | Indole **25,7** · Hedione 19,1 · Bergamot 14,7 · Iso E 14,7 · Musk T 11,7 · DHM 7,3 · BB 3,8 · Ambroxan 2,9 |
| R5 (dominan) | terpicu untuk Indole 50 BB (5% → 25,7%) |
| Pie (facet dari `bridge-db.json`) | Floral 19,8 · Citrus 16,6 · Animalic 12,3 · Woody 9,0 · Musk 7,4 · Amber 6,7 · Lainnya 28,2 |
| HPP batch | **Rp38.607,46** · Rp3.860,75/g |
| Rincian biaya | Bergamot 12.800 · Musk T 6.660 · Indole 4.150,12 · DHM 4.000 · Iso E 3.876 · Hedione 3.700,80 · BB 2.320,29 · Ambroxan 1.100,25 |
| Ganti batch ke 3 g | persen sama, tier tetap 10 g, HPP batch = 38.607,46 × 0,3 = Rp11.582,24 |
| Ganti batch ke 120 g | tier 100 g, persen sama |

Angka pie bergantung pada facet hasil `facetize`; kalau implementasi TS menghasilkan facet berbeda dari `bridge-db.json`, perbaiki port-nya sampai sama — skrip Python adalah acuan.
