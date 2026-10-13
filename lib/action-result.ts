/**
 * Hasil server action. Error selalu berupa pesan yang bisa ditindaklanjuti —
 * "terjadi kesalahan" tidak membantu siapa pun.
 */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; field?: string };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T) {
  return { ok: true, data } as ActionResult<T>;
}

export function fail(error: string, field?: string): ActionResult<never> {
  return { ok: false, error, field };
}

/**
 * Menerjemahkan error Postgres jadi pesan yang masuk akal buat user.
 * Kode constraint dicocokkan dengan nama yang dipakai di migrasi.
 */
export function describeDbError(error: {
  message: string;
  code?: string;
  details?: string | null;
}): string {
  const m = error.message ?? "";

  if (m.includes("change_note_required_after_v1")) {
    return "Versi ke-2 ke atas wajib punya catatan perubahan. Catatan ini yang bikin kamu belajar — tulis singkat saja.";
  }
  if (m.includes("ref_matches_type")) {
    return "Ada baris yang jenisnya tidak cocok dengan komponen yang dipilih. Cek lagi toggle Bahan / FO / Formula di baris itu.";
  }
  if (m.includes("weight_positive")) {
    return "Ada baris yang beratnya 0 atau kosong. Semua baris harus punya berat.";
  }
  if (m.includes("dilution_range")) {
    return "Dilusi harus di atas 0% dan maksimal 100%.";
  }
  if (m.includes("dilute_after_mix")) {
    return "Tanggal pengenceran tidak boleh lebih awal dari tanggal pencampuran. Ethanol ditambahkan SETELAH fase minyak istirahat.";
  }
  if (m.includes("no_self_reference")) {
    return "Formula tidak bisa memakai dirinya sendiri sebagai komponen.";
  }
  if (m.includes("siklus")) {
    return "Baris sub-formula membentuk siklus — ada formula yang akhirnya memakai dirinya sendiri.";
  }
  if (m.includes("sarang sub-formula")) {
    return m;
  }
  if (m.includes("tidak bisa diubah barisnya")) {
    return "Versi ini sudah dinilai, jadi barisnya tidak bisa diubah lagi. Duplikat jadi versi baru supaya catatan penciuman yang lama tetap nyambung ke formula yang benar.";
  }
  if (m.includes("formula_versions_formula_id_version_no_key")) {
    return "Nomor versi bentrok — kemungkinan ada tab lain yang baru menyimpan versi. Muat ulang halaman lalu coba lagi.";
  }
  if (m.includes("raw_materials_cas_global_uniq")) {
    return "CAS number ini sudah dipakai bahan lain di master global.";
  }
  if (error.code === "23503") {
    return "Data yang dirujuk sudah tidak ada. Muat ulang halaman lalu coba lagi.";
  }

  return m || "Gagal menyimpan. Coba lagi.";
}
