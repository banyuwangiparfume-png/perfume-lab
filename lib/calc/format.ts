/**
 * Pembulatan hanya terjadi di TAMPILAN. Penyimpanan selalu angka penuh.
 * Berat 3 desimal, persen 1 desimal — sesuai 04-uiux-design-admin.md §3.
 */

const gram = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const pct = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const plain = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

/** Em-dash, bukan "0". Impact kosong tidak sama dengan impact 0. */
export const EMPTY = "\u2014";

export const fmtGram = (n: number | null | undefined) =>
  n == null ? EMPTY : gram.format(n);

export const fmtPct = (n: number | null | undefined) =>
  n == null ? EMPTY : `${pct.format(n)}%`;

export const fmtIdr = (n: number | null | undefined) =>
  n == null ? EMPTY : `Rp${idr.format(n)}`;

export const fmtNum = (n: number | null | undefined) =>
  n == null ? EMPTY : plain.format(n);

/** "0,500 g @ 10% = 0,050 g murni" — teks pencegah kesalahan termahal di app ini. */
export function dilutionHint(weightG: number, dilutionPct: number): string {
  const neat = weightG * (dilutionPct / 100);
  if (dilutionPct >= 100) return `${fmtGram(weightG)} g neat`;
  return `${fmtGram(weightG)} g @ ${fmtNum(dilutionPct)}% = ${fmtGram(neat)} g murni`;
}

export function fmtDilution(dilutionPct: number): string {
  return dilutionPct >= 100 ? "Neat" : `${fmtNum(dilutionPct)}%`;
}
