# Fase 3 — Tech Stack & Data Model

> Lanjutan dari file 01 dan 02. Berisi stack final, skema database lengkap, server actions, dan struktur folder.

---

## 1. Stack

| Lapisan | Pilihan |
|---|---|
| Framework | **Next.js 14+ (App Router)**, TypeScript |
| Database | **Supabase** (Postgres + Auth + Storage) |
| ORM / client | `@supabase/supabase-js` + `@supabase/ssr` |
| Styling | **Tailwind CSS** + **shadcn/ui** |
| Chart | **Recharts** |
| Form | **react-hook-form** + **zod** |
| Tabel | **TanStack Table** (untuk daftar bahan yang panjang) |
| State server | React Server Components + Server Actions |
| Export PDF | **@react-pdf/renderer** (atau print stylesheet kalau mau lebih cepat) |
| Parse CSV | **papaparse** |
| Deploy (dev) | **Vercel** |
| Deploy (prod nanti) | **VPS + Coolify / Docker**, Supabase self-host opsional |

**Catatan portabilitas VPS.** Karena nanti pindah ke VPS, hindari API yang hanya ada di Vercel (`@vercel/kv`, `@vercel/blob`, Edge Runtime khusus). Pakai Node runtime standar dan Supabase untuk semua penyimpanan. Dengan begitu pindahnya cukup `next build` + `next start` di belakang reverse proxy, tanpa menulis ulang apa pun.

---

## 2. Prinsip Desain Data

1. **Simpan berat, hitung persen.** Yang ditimbang adalah gram. Persen selalu turunan. Jangan pernah menyimpan persen sebagai sumber kebenaran — pembulatan akan merusak reproduksi formula.
2. **Simpan berat seperti ditimbang + dilusi secara terpisah.** Berat murni adalah turunan. Instruksi penimbangan memakai berat timbang, semua kalkulasi memakai berat murni.
3. **Versi tidak pernah diubah setelah dievaluasi.** Begitu sebuah versi punya evaluasi, perubahan harus membuat versi baru. Kalau tidak, catatan penciuman jadi menggantung ke formula yang sudah berbeda.
4. **Data supplier dan koreksi user disimpan di kolom berbeda.** Import ulang tidak boleh menghapus hasil belajar user.
5. **`owner_id` + RLS ada sejak hari pertama** meski aplikasinya single-user, supaya membuka akses untuk murid nanti tidak perlu migrasi.
6. **Baris formula punya tiga jenis, dan ketiganya berperilaku berbeda.** Lihat bagian 2.1 — ini menentukan seluruh lapisan kalkulasi dan rules.

### 2.1 Tiga Jenis Baris Formula

Formula tidak hanya berisi raw material. Dalam praktik, satu formula bisa mencampur tiga hal yang sifatnya berbeda:

| Jenis | Apa itu | Isi bahannya | Punya nilai impact? |
|---|---|---|---|
| `raw_material` | bahan baku tunggal | 1 molekul | ya, dari master RM |
| `fo` | bibit parfum jadi dari pihak ketiga | **tidak diketahui**, biasanya 30–80 bahan | **tidak** |
| `sub_formula` | versi formula lain (accord / booster buatan sendiri) | diketahui, tercatat di app | ya, bisa dihitung |

Perbedaan ini bukan detail administratif — kalau ketiganya diperlakukan sama, seluruh analisa jadi salah:

**FO tidak punya satu nilai impact.** FO adalah parfum lengkap, bukan molekul. Memberinya satu angka impact itu mengarang data. Karena itu:
- baris FO **dikeluarkan** dari perhitungan % kekuatan
- baris FO **tetap dihitung** untuk berat, persen berat, dan biaya
- hasil % kekuatan ditandai sebagai "dihitung dari bagian non-FO saja"

**FO menyembunyikan puluhan bahan.** Rule "jumlah bahan" tidak boleh menghitung satu FO sebagai satu bahan. Satu FO berisi 30–80 bahan yang tidak terlihat. Inilah alasan struktural kenapa mencampur dua FO hampir selalu menghasilkan formula yang tidak terkendali — dan app harus memberitahukan itu, bukan diam.

**Sub-formula harus bisa dibentangkan.** Kalau "Jasmine Accord v3" (8 bahan) dipakai sebagai satu baris, app harus bisa melihat 8 bahan di baliknya saat menjalankan rules — kalau tidak, formula dengan 3 sub-formula akan lolos rule "maksimal 12 bahan" padahal isinya 24 bahan.

Untuk perhitungan % kekuatan, membentangkan sub-formula dan memakai impact rata-ratanya menghasilkan angka yang **sama persis** secara matematis:

```
impact_agregat(S) = Σ(berat_murni_i × impact_i) / Σ(berat_murni_i)
```

Jadi tampilan boleh memakai bentuk ringkas (satu baris), tapi **rules checker wajib berjalan di atas bentuk yang sudah dibentangkan**.

---

## 3. Skema Database

### 3.1 Enum

```sql
create type function_category as enum ('diffuser','modifier','bridger','fixative');
create type formula_type      as enum ('accord','base','booster','full_perfume','experiment');
create type formula_source    as enum ('own','ecofragrantica','kurdlab','other');
create type version_status    as enum ('draft','mixed','evaluated','locked');
create type eval_medium       as enum ('blotter','skin','fabric');
create type transition_verdict as enum ('smooth','broken','muddy');
create type user_role         as enum ('user','admin');
create type line_type         as enum ('raw_material','fo','sub_formula');
```

### 3.2 `profiles`

Menyambung ke `auth.users`. Dibuat sejak awal walau auth belum aktif — selama pembangunan isi satu baris dummy.

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
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid references profiles(id) on delete cascade,
  -- NULL = bahan master global (hasil import pricelist)
  -- terisi = bahan tambahan milik user

  name                text not null,
  synonym             text,
  cas_number          text,
  family              text,              -- Woody, Floral, Musk/Animalic, Green, Citrus, ...
  category            text,              -- Aromachemical, Aldehyde, Natural Isolate, ...
  odour_profile       text,              -- deskriptor mentah dari supplier
  function_category   function_category,

  odor_impact         numeric(10,2),     -- dari supplier; 100 = baseline
  odor_impact_override numeric(10,2),    -- koreksi user
  odor_impact_note    text,              -- alasan koreksi

  default_dilution_pct numeric(6,3) default 100,  -- bentuk yang biasa dipakai user
  default_solvent      text,

  ifra_cat4_limit_pct numeric(6,3),      -- disiapkan, tidak divalidasi di v1
  tgsc_url            text,
  supplier            text,
  personal_note       text,
  is_active           boolean not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on raw_materials (owner_id);
create index on raw_materials (function_category);
create unique index raw_materials_cas_global_uniq
  on raw_materials (cas_number) where owner_id is null and cas_number is not null;
```

**Kolom turunan (hitung di aplikasi, jangan disimpan):**
```ts
effective_impact = odor_impact_override ?? odor_impact   // boleh null
```

### 3.4 `rm_prices`

Harga per tier, dengan riwayat.

```sql
create table rm_prices (
  id               uuid primary key default gen_random_uuid(),
  raw_material_id  uuid not null references raw_materials(id) on delete cascade,
  tier_grams       numeric(10,2) not null,     -- 5, 10, 50, 100, 500
  price_idr        numeric(14,2) not null,
  supplier         text,
  effective_date   date not null default current_date,
  created_at       timestamptz not null default now()
);

create index on rm_prices (raw_material_id, effective_date desc);
```

```ts
price_per_gram = price_idr / tier_grams
```
Untuk kalkulasi HPP, pakai tier terbesar yang realistis dibeli (default 500 g) dari `effective_date` terbaru. Simpan pilihan tier ini sebagai setting, jangan hardcode.

### 3.5 `fragrance_oils`

FO sengaja ditaruh di tabel terpisah, bukan diberi flag di `raw_materials`. Alasannya: FO tidak punya CAS, tidak punya `function_category`, dan tidak punya `odor_impact`. Kalau dicampur ke tabel yang sama, setiap kueri dan setiap fungsi kalkulasi harus menulis pengecualian — dan satu pengecualian yang kelupaan akan menghasilkan angka yang salah tanpa ada yang sadar.

```sql
create table fragrance_oils (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references profiles(id) on delete cascade,

  name           text not null,          -- "Tabbac 28"
  inspired_by    text,                   -- "Maison Alhambra Tabac"
  supplier       text,
  family         text,                   -- Woody, Oriental, Floral, Fresh, Gourmand, Tobacco
  sub_family     text,                   -- opsional, lebih spesifik
  note_pyramid   text,                   -- catatan top/heart/base dari supplier, teks bebas
  price_per_gram numeric(12,2),
  dep_pct        numeric(6,3) default 0, -- fixative yang sudah ditambahkan ke bibit
  personal_note  text,
  is_active      boolean not null default true,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on fragrance_oils (owner_id, is_active);
```

**Tidak ada kolom `odor_impact` di tabel ini, dan jangan pernah ditambahkan.** Kalau suatu saat tergoda mengisinya dengan angka tebakan supaya rules bisa jalan, itu artinya rules-nya yang harus diperbaiki, bukan datanya yang dikarang.

Kolom `family` wajib diisi — dipakai Rule 7 untuk memeriksa jarak antar FO saat ada lebih dari satu FO dalam satu formula.

### 3.6 `formulas`

```sql
create table formulas (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references profiles(id) on delete cascade,
  name              text not null,
  description       text,
  type              formula_type not null default 'experiment',
  target_category   text,                 -- Floral, Woody, Oriental, Fresh, Gourmand, Spicy
  source            formula_source not null default 'own',
  source_note       text,
  parent_formula_id uuid references formulas(id) on delete set null,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on formulas (owner_id, is_archived);
```

### 3.7 `formula_versions`

```sql
create table formula_versions (
  id                uuid primary key default gen_random_uuid(),
  formula_id        uuid not null references formulas(id) on delete cascade,
  version_no        integer not null,
  label             text,                  -- "v3 — Ambroxan turun ke 2%"
  change_note       text,                  -- WAJIB untuk version_no > 1
  parent_version_id uuid references formula_versions(id) on delete set null,
  batch_size_g      numeric(10,3) not null default 10,
  status            version_status not null default 'draft',
  mixed_at          timestamptz,           -- kapan benar-benar dicampur
  created_at        timestamptz not null default now(),

  unique (formula_id, version_no)
);

create index on formula_versions (formula_id, version_no desc);
create index on formula_versions (status) where status = 'mixed';
```

`parent_version_id` memungkinkan percabangan: v3 melahirkan v4a (tanpa bahan X) dan v4b (bahan X dua kali lipat) untuk subtraction test.

Index terakhir melayani panel "menunggu dievaluasi" di dashboard.

### 3.8 `formula_lines`

Satu baris bisa merujuk ke salah satu dari tiga hal (lihat bagian 2.1). Karena itu ketiga kolom referensi boleh null, dan sebuah check constraint memastikan **tepat satu** yang terisi dan cocok dengan `line_type`.

```sql
create table formula_lines (
  id                 uuid primary key default gen_random_uuid(),
  formula_version_id uuid not null references formula_versions(id) on delete cascade,

  line_type          line_type not null default 'raw_material',
  raw_material_id    uuid references raw_materials(id)   on delete restrict,
  fo_id              uuid references fragrance_oils(id)  on delete restrict,
  sub_formula_version_id uuid references formula_versions(id) on delete restrict,

  weight_g           numeric(12,4) not null,          -- BERAT SEPERTI DITIMBANG
  dilution_pct       numeric(6,3) not null default 100,
  solvent            text,                            -- DPG, TEC, IPM, Ethanol, Jojoba

  note               text,
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),

  constraint weight_positive check (weight_g > 0),
  constraint dilution_range  check (dilution_pct > 0 and dilution_pct <= 100),

  constraint ref_matches_type check (
    (line_type = 'raw_material'
       and raw_material_id is not null and fo_id is null and sub_formula_version_id is null)
 or (line_type = 'fo'
       and fo_id is not null and raw_material_id is null and sub_formula_version_id is null)
 or (line_type = 'sub_formula'
       and sub_formula_version_id is not null and raw_material_id is null and fo_id is null)
  ),

  constraint no_self_reference check (sub_formula_version_id <> formula_version_id)
);

create index on formula_lines (formula_version_id, sort_order);
create index on formula_lines (sub_formula_version_id) where sub_formula_version_id is not null;
```

**Jangan tambahkan kolom `percentage`.** Persen selalu dihitung ulang dari berat.

**Dilusi pada baris FO dan sub-formula.** Keduanya biasanya dipakai neat (100%), tapi kolomnya tetap berlaku — kadang accord disimpan dalam bentuk encer di rak. Rumusnya identik: `berat_murni = weight_g × dilution_pct / 100`.

**Pencegahan siklus.** Check constraint di atas hanya mencegah baris yang merujuk ke dirinya sendiri. Siklus tak langsung (A memakai B, B memakai A) harus dicegah di aplikasi sebelum menyimpan: telusuri rantai `sub_formula_version_id`, tolak kalau menemukan versi yang sudah ada di jalur, dan **batasi kedalaman maksimal 3 tingkat**. Lebih dalam dari itu, formula jadi tidak bisa dibaca manusia dan hampir pasti tanda struktur yang keliru.

```ts
// lib/calc/cycle.ts
export function assertNoCycle(versionId: string, subIds: string[], depth = 0): void
// lempar error dengan pesan yang menyebut nama formula penyebabnya, bukan UUID
```

### 3.9 `evaluations`

```sql
create table evaluations (
  id                 uuid primary key default gen_random_uuid(),
  formula_version_id uuid not null references formula_versions(id) on delete cascade,
  owner_id           uuid not null references profiles(id) on delete cascade,

  evaluator_name     text not null,        -- bisa orang lain, bukan cuma pemilik akun
  medium             eval_medium not null default 'blotter',
  diluted_in         text,                 -- "20% in ethanol"
  maceration_days    integer,
  evaluated_at       timestamptz not null default now(),

  overall_note       text,
  rating             smallint check (rating between 1 and 5),
  transition_verdict transition_verdict,

  created_at         timestamptz not null default now()
);

create index on evaluations (formula_version_id, evaluated_at desc);
```

`evaluator_name` sengaja teks bebas, bukan FK ke profiles. Orang yang mencium belum tentu punya akun — dan memaksa mereka punya akun akan membunuh kebiasaan minta pendapat orang lain, padahal itu justru yang mau didorong karena anosmia parsial.

### 3.10 `evaluation_points`

```sql
create table evaluation_points (
  id              uuid primary key default gen_random_uuid(),
  evaluation_id   uuid not null references evaluations(id) on delete cascade,
  minutes_elapsed integer not null,         -- 5, 30, 60, 180, 360, atau custom
  dominant_note   text,
  descriptors     text[],                   -- {'creamy','woody','tajam'}
  intensity       smallint check (intensity between 1 and 10),
  note            text,

  unique (evaluation_id, minutes_elapsed)
);

create index on evaluation_points (evaluation_id, minutes_elapsed);
```

Tipe `text[]` dipilih supaya pencarian deskriptor gampang (`descriptors @> ARRAY['creamy']`) tanpa tabel tag terpisah. Kalau nanti butuh normalisasi deskriptor, itu migrasi kecil.

### 3.11 `packaging_items`

```sql
create table packaging_items (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  name          text not null,              -- "Botol 35ml", "Dus", "Sticker"
  unit_cost_idr numeric(14,2) not null,
  unit          text not null default 'pcs',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
```

### 3.12 `cost_sheets` + `cost_sheet_items`

```sql
create table cost_sheets (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references profiles(id) on delete cascade,
  name               text not null,
  formula_version_id uuid references formula_versions(id) on delete set null,

  bottle_volume_ml   numeric(8,2) not null,
  fill_volume_ml     numeric(8,2) not null,
  density_assumed    numeric(6,3) not null default 1.0,

  fo_pct             numeric(6,3) not null default 30,
  fo_price_per_g     numeric(12,2) not null,
  booster_pct        numeric(6,3) not null default 6,
  ethanol_pct        numeric(6,3) not null default 59,
  water_pct          numeric(6,3) not null default 3,
  solubilizer_pct    numeric(6,3) not null default 2,
  solvent_cost_idr   numeric(12,2) not null default 0,   -- ethanol+aquades+poly20 digabung
  misc_cost_idr      numeric(12,2) not null default 0,

  het_price_idr      numeric(14,2),
  net_price_idr      numeric(14,2),        -- setelah potongan marketplace

  created_at         timestamptz not null default now()
);

create table cost_sheet_items (
  id                 uuid primary key default gen_random_uuid(),
  cost_sheet_id      uuid not null references cost_sheets(id) on delete cascade,
  packaging_item_id  uuid not null references packaging_items(id) on delete restrict,
  quantity           numeric(10,2) not null default 1
);
```

Harga FO disimpan di cost sheet, bukan di raw_materials, karena FO adalah bibit jadi dari pihak ketiga — bukan raw material tunggal.

### 3.13 RLS

Aktifkan di semua tabel. Pola untuk tabel milik user:

```sql
alter table formulas enable row level security;

create policy "own rows" on formulas
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```

Untuk `raw_materials` yang punya baris global:

```sql
create policy "read global + own" on raw_materials
  for select using (owner_id is null or owner_id = auth.uid());

create policy "write own only" on raw_materials
  for insert with check (owner_id = auth.uid());

create policy "update own only" on raw_materials
  for update using (owner_id = auth.uid());

create policy "admin writes global" on raw_materials
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
```

`fragrance_oils` memakai pola "own rows" yang sama seperti `formulas` — tidak ada baris global, karena FO adalah stok pribadi tiap orang.

Tabel anak (`formula_lines`, `evaluation_points`, `cost_sheet_items`) dilindungi lewat join ke induknya:

```sql
create policy "via parent" on formula_lines
  for all using (
    exists (
      select 1 from formula_versions v
      join formulas f on f.id = v.formula_id
      where v.id = formula_lines.formula_version_id and f.owner_id = auth.uid()
    )
  );
```

**Selama fase 1–4 (belum ada auth):** pakai service-role key di server actions dan satu UUID dummy tetap sebagai `owner_id`. Jangan nonaktifkan RLS — biarkan aktif supaya policy-nya ikut teruji sejak awal.

---

## 4. Lapisan Kalkulasi

Semua rumus ditaruh di satu tempat: `lib/calc/`. Harus **fungsi murni** tanpa akses database, supaya bisa dipakai di server maupun client (panel live di editor) dan gampang ditulis unit test-nya.

```ts
// lib/calc/types.ts
export type CalcLine = {
  id: string
  lineType: 'raw_material' | 'fo' | 'sub_formula'
  label: string                 // nama RM / FO / formula
  weightG: number               // berat seperti ditimbang
  dilutionPct: number           // 100 = neat
  pricePerGram: number | null

  // hanya untuk raw_material
  functionCategory?: FunctionCategory | null
  family?: string | null
  impact?: number | null        // effective_impact

  // hanya untuk fo
  foFamily?: string | null

  // hanya untuk sub_formula — sudah di-resolve saat memuat data
  subLines?: CalcLine[]
}
```

```ts
// lib/calc/expand.ts
/**
 * Membentangkan baris sub_formula jadi raw material penyusunnya,
 * dengan berat diskalakan proporsional. Baris FO TIDAK dibentangkan
 * karena isinya memang tidak diketahui — dia tetap jadi satu baris.
 * Dipakai oleh rules checker, bukan oleh tampilan tabel.
 */
export function expandLines(lines: CalcLine[], depth = 0): CalcLine[]
```

```ts
// lib/calc/formula.ts
export function computeFormula(lines: CalcLine[]) {
  const weighedTotal = sum(lines.map(l => l.weightG))
  const neat    = lines.map(l => l.weightG * l.dilutionPct / 100)
  const neatTotal = sum(neat)
  const neatPct = neat.map(n => neatTotal ? n / neatTotal * 100 : 0)

  // ---- % KEKUATAN: hanya dari baris yang punya impact ----
  // FO dikecualikan (tidak punya impact).
  // sub_formula ikut, memakai impact agregat tertimbang dari penyusunnya.
  const impactOf = (l: CalcLine): number | null =>
    l.lineType === 'fo'           ? null
  : l.lineType === 'sub_formula'  ? aggregateImpact(l.subLines ?? [])
  : (l.impact ?? null)

  const scored   = lines.map((l, i) => ({ l, i, imp: impactOf(l) }))
  const scorable = scored.filter(s => s.imp != null)

  // basis persen dihitung ULANG hanya dari bagian yang bisa dinilai,
  // supaya % kekuatan tetap berjumlah 100 dan tidak terdilusi oleh FO
  const scorableNeat = sum(scorable.map(s => neat[s.i]))
  const contrib = scorable.map(s => (neat[s.i] / scorableNeat * 100) * s.imp!)
  const contribTotal = sum(contrib)

  const strengthPct = new Map<string, number | null>()
  lines.forEach(l => strengthPct.set(l.id, null))
  scorable.forEach((s, k) =>
    strengthPct.set(s.l.id, contribTotal ? contrib[k] / contribTotal * 100 : 0))

  const foNeatShare = sum(
    lines.filter(l => l.lineType === 'fo').map((_, i) => neat[i])
  ) / (neatTotal || 1) * 100

  return {
    rows: lines.map((l, i) => ({
      ...l,
      neatWeightG: neat[i],
      weightPct:   weighedTotal ? l.weightG / weighedTotal * 100 : 0,
      neatPct:     neatPct[i],
      strengthPct: strengthPct.get(l.id),     // null untuk baris FO
    })),
    totals: { weighedG: weighedTotal, neatG: neatTotal, costPerGram: ... },

    strengthBasis: scorableNeat / (neatTotal || 1) * 100,  // berapa % formula yang ikut dinilai
    foNeatShare,                                           // dipakai Rule 6
    hasFO: lines.some(l => l.lineType === 'fo'),
    foCount: lines.filter(l => l.lineType === 'fo').length,

    strengthComplete: scorable.every(s => s.imp != null)
                   && !lines.some(l => l.lineType === 'fo'),
    missingImpact: lines
      .filter(l => l.lineType === 'raw_material' && l.impact == null)
      .map(l => l.label),
  }
}

function aggregateImpact(sub: CalcLine[]): number | null {
  const parts = sub.filter(l => l.lineType !== 'fo')
  if (!parts.length || parts.some(l => (l.impact ?? null) == null)) return null
  const w = parts.map(l => l.weightG * l.dilutionPct / 100)
  return sum(parts.map((l, i) => w[i] * l.impact!)) / sum(w)
}
```

**Aturan tampilan yang mengikuti dari kode di atas.** Kalau `strengthBasis < 100`, kolom % kekuatan tidak boleh ditampilkan polos seolah mewakili seluruh formula. Beri label di atas tabel:

> % kekuatan dihitung dari **{strengthBasis}%** formula ini. Bagian FO tidak ikut dinilai karena isinya tidak diketahui.

Ini bukan kekurangan yang perlu disembunyikan — justru itu kenyataan yang harus user pahami saat bekerja dengan bibit jadi.

```ts
// lib/calc/scale.ts
export function scaleTo(lines: CalcLine[], targetG: number) {
  const factor = targetG / sum(lines.map(l => l.weightG))
  return lines.map(l => ({ ...l, weightG: round(l.weightG * factor, 3) }))
}
```

```ts
// lib/rules/index.ts
export function runRules(
  result: FormulaResult,
  expanded: CalcLine[],        // hasil expandLines() — WAJIB, bukan opsional
): Finding[]
// Finding = { rule, level: 'info'|'warning'|'critical', message, actionHint? }
```

**Rules checker berjalan di atas daftar yang sudah dibentangkan**, bukan daftar baris mentah. Kalau tidak, formula berisi 3 sub-formula akan terbaca sebagai "3 bahan" padahal isinya 24.

```ts
// lib/rules/thresholds.ts  — satu tempat untuk semua angka ambang
export const T = {
  maxMaterials: 12,
  minFixativeShare: 15,
  maxPushShare: 85,          // diffuser + modifier
  minLeadShare: 20,
  maxLeadShare: 60,
  swallowRatio: 3,
  swallowMinShare: 25,
  negligibleShare: 1,
  minFamiliesForBridgeCheck: 3,

  // FO
  minFoShare: 85,            // Rule 6 — di bawah ini karakter FO mulai tertutup
  foLeadShare: 70,           // Rule 7 — kalau ada 2 FO, salah satu harus sebesar ini
  foHiddenMaterials: 40,     // perkiraan jumlah bahan di dalam 1 FO, untuk Rule 1
  maxSubFormulaDepth: 3,
}
```

`foHiddenMaterials` adalah perkiraan kasar, bukan fakta — dipakai hanya untuk menyusun kalimat peringatan, tidak pernah untuk perhitungan angka yang ditampilkan sebagai hasil.

```ts
// lib/calc/costing.ts
export function computeCostSheet(input: CostSheetInput): CostBreakdown
```

**Unit test wajib** untuk `computeFormula`, `expandLines`, dan `scaleTo`. Lima kasus yang harus ada:

1. Bahan dengan dilusi 10% kontribusinya memang sepersepuluh
2. Satu bahan impact null → `strengthComplete` false, dan bahan itu **tidak** dianggap nol
3. Baris FO → `strengthPct` null, tapi `weightPct` dan biaya tetap terhitung
4. Formula berisi sub-formula → hasil % kekuatannya **identik** dengan formula yang sama ditulis datar (bahan sub-formula ditulis satu per satu). Ini membuktikan rumus impact agregat benar.
5. Sub-formula yang merujuk balik ke induknya → `assertNoCycle` melempar error, bukan hang

---

## 5. Server Actions

Pakai Server Actions, bukan route handler, kecuali untuk yang butuh streaming atau dipanggil pihak luar.

```
app/actions/materials.ts
  listMaterials(filter)
  getMaterial(id)
  createMaterial(input)
  updateMaterial(id, input)
  setImpactOverride(id, value, note)
  importMaterialsCsv(rows)            -> { created, updated, failed[] }
  upsertPrices(materialId, tiers[])

app/actions/fragrance-oils.ts
  listFragranceOils(filter)
  getFragranceOil(id)
  createFragranceOil(input)
  updateFragranceOil(id, input)
  archiveFragranceOil(id)

app/actions/formulas.ts
  listFormulas(filter)
  getFormula(id)                      -> formula + semua versi (ringkas)
  createFormula(input)                -> ikut membuat versi v1 kosong
  updateFormula(id, input)
  archiveFormula(id)
  duplicateFormula(id)

app/actions/versions.ts
  getVersion(id)                      -> versi + baris + bahan ter-join
  createVersion(formulaId, input)     -> version_no = max + 1
  duplicateVersion(versionId, note)   -> salin semua baris, parent_version_id terisi
  updateVersionMeta(id, input)        -> label, change_note, batch_size, status, mixed_at
  saveLines(versionId, lines[])       -> ganti seluruh baris dalam satu transaksi
  markMixed(versionId, mixedAt)
  compareVersions(ids[])
  resolveVersionTree(versionId)       -> versi + baris + sub-formula ter-resolve
                                         sampai kedalaman maks, untuk expandLines()
  listUsableAsSubFormula(excludeId)   -> versi yang boleh dipakai sebagai komponen
                                         (tidak menyebabkan siklus)

app/actions/evaluations.ts
  createEvaluation(input)
  upsertPoint(evaluationId, point)    -> mendukung simpan parsial
  getEvaluation(id)
  listPendingEvaluation()             -> versi 'mixed' tanpa evaluasi, untuk dashboard

app/actions/costing.ts
  listPackaging() / upsertPackaging()
  createCostSheet(input)
  updateCostSheet(id, input)
  getCostSheet(id)
```

**Aturan `saveLines`:** jalankan di satu transaksi (RPC Postgres atau hapus-lalu-sisipkan dalam satu fungsi), supaya tidak pernah ada versi yang separuh tersimpan. Tolak penyimpanan kalau versi berstatus `evaluated` atau `locked` — arahkan ke `duplicateVersion`.

---

## 6. Struktur Folder

```
/app
  layout.tsx
  page.tsx                          # dashboard
  /materials
    page.tsx
    [id]/page.tsx
  /fo
    page.tsx                        # daftar FO
    [id]/page.tsx
  /formulas
    page.tsx
    new/page.tsx
    [id]/
      page.tsx
      edit/page.tsx
      compare/page.tsx
  /evaluations
    new/page.tsx
    [id]/page.tsx
  /costing
    page.tsx
    [id]/page.tsx
  /admin
    materials/page.tsx
    packaging/page.tsx
  /actions
    materials.ts
    fragrance-oils.ts
    formulas.ts
    versions.ts
    evaluations.ts
    costing.ts

/components
  /ui                               # shadcn
  /formula
    LineEditor.tsx                  # tabel baris yang bisa diedit
    LineTypeToggle.tsx              # RM / FO / sub-formula per baris
    ComponentPicker.tsx             # picker bertab: Bahan · FO · Formula saya
    DilutionSelect.tsx
    StrengthTable.tsx
    StrengthChart.tsx               # berat vs kekuatan berdampingan
    FunctionDonut.tsx
    RulesPanel.tsx
    ScaleDialog.tsx
    VersionPicker.tsx
    VersionDiff.tsx
  /evaluation
    TimelineInput.tsx               # 5/30/60/180/360
    DescriptorTags.tsx
    EvaluationCard.tsx
  /costing
    CostSheetForm.tsx
    CostBreakdownTable.tsx
  /shared
    StatTile.tsx
    EmptyState.tsx
    ImpactBadge.tsx

/lib
  /calc
    types.ts
    formula.ts
    expand.ts                       # bentangkan sub-formula
    cycle.ts                        # deteksi siklus + batas kedalaman
    scale.ts
    costing.ts
    formula.test.ts
    expand.test.ts
  /rules
    index.ts
    thresholds.ts
  /supabase
    server.ts
    client.ts
    middleware.ts
  /csv
    parseMaterials.ts
  utils.ts

/supabase
  /migrations
    0001_enums.sql
    0002_core_tables.sql
    0003_costing.sql
    0004_rls.sql
  /seed
    materials.csv
    seed.sql
```

---

## 7. Seed Data

Isi `supabase/seed/materials.csv` dari pricelist supplier. Baris global (`owner_id` null).

Kolom CSV:
```
name, synonym, cas_number, family, category, odour_profile,
function_category, odor_impact, tgsc_url,
price_5g, price_10g, price_50g, price_100g, price_500g
```

**Prioritaskan sekitar 40 bahan yang benar-benar dimiliki lebih dulu**, bukan seluruh 427 baris pricelist. Coverage data untuk bahan yang dimiliki hampir 100% (impact + kategori fungsi lengkap), sementara coverage seluruh katalog hanya 72%. Daftar bahan yang sedikit tapi datanya bersih jauh lebih berguna daripada katalog besar yang bolong — dan untuk murid kelas nanti, pilihan yang terbatas memang disengaja.

Mapping `function_category` dari pricelist: `Diffuser` → `diffuser`, `Modifier` → `modifier`, `Bridger` → `bridger`, `Fixative` → `fixative`. Baris dengan kolom kosong tetap diimpor, tapi `odor_impact` dibiarkan null supaya Rule 5 bisa mendeteksinya — jangan diisi angka tebakan.
