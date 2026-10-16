"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { readFormulaWorkbook } from "@/lib/import/formulaWorkbook";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Mengubah berkas Excel yang diunggah jadi baris mentah.
 *
 * Cuma itu. Mencocokkan nama ke bahan dan memeriksa persen dikerjakan di
 * matchFormulaRows() di sisi editor — dengan katalog yang sama yang dipakai
 * editor, termasuk bahan yang baru dibuat dan belum dimuat ulang.
 */
export async function parseFormulaFile(
  form: FormData,
): Promise<ActionResult<{ row: number; values: Record<string, unknown> }[]>> {
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Pilih berkas Excel dulu.");
  if (file.size > MAX_BYTES) return fail("Berkasnya lebih dari 2 MB — formula tidak sebesar itu.");
  if (!/\.xlsx$/i.test(file.name)) {
    return fail("Harus berkas .xlsx. Kalau dari Google Sheets: File → Download → Microsoft Excel.");
  }

  try {
    const rows = await readFormulaWorkbook(await file.arrayBuffer());
    if (!rows.length) return fail("Lembar Formula masih kosong.");
    return ok(rows);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Berkasnya tidak bisa dibaca.");
  }
}
