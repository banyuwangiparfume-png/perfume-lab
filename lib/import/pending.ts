/**
 * Kunci sessionStorage untuk berkas formula yang dipilih di halaman "Formula
 * baru": halaman itu membaca berkasnya, membuat formula, lalu editor yang
 * membuka dialog import dengan isi berkas tersebut. Satu konstanta untuk
 * kedua sisi supaya tidak bisa diam-diam berbeda.
 */
export const PENDING_IMPORT_PREFIX = "pn:pending-import:";
