/**
 * Apakah isi draf benar-benar berbeda dari versi tersimpan terakhir.
 *
 * Dipakai untuk menolak "Simpan versi" yang tidak mengubah apa pun: v3 yang
 * identik dengan v2 membuat riwayat dan halaman banding menyesatkan — dua
 * versi yang terlihat seperti percobaan berbeda padahal sama persis.
 *
 * Yang dibandingkan hanya ISI RESEP: target piramida dan baris (tier, bahan,
 * persen, dilusi, pelarut). Ukuran batch dan tier harga sengaja tidak: persen
 * adalah sumber kebenaran, dan mengganti batch dari 3 g ke 120 g tidak
 * membuat formula baru.
 */

export type VersionContent = {
  top_pct: number | null;
  mid_pct: number | null;
  base_pct: number | null;
  lines: {
    tier: string;
    line_type: string;
    raw_material_id: string | null;
    accord_version_id: string | null;
    fo_id: string | null;
    pct: number;
    user_dilution_pct: number | null;
    user_solvent_id: string | null;
  }[];
};

/** Presisi penyimpanan persen (5 desimal) — selisih di bawahnya bukan perubahan. */
const r5 = (n: number | null | undefined) =>
  n == null ? null : Math.round(Number(n) * 1e5) / 1e5;

function signature(v: VersionContent): string {
  const lines = v.lines
    .map((l) =>
      [
        l.tier,
        l.line_type,
        l.raw_material_id ?? l.accord_version_id ?? l.fo_id ?? "",
        r5(l.pct),
        r5(l.user_dilution_pct ?? 100),
        (l.user_dilution_pct ?? 100) < 100 ? (l.user_solvent_id ?? "") : "",
      ].join("|"),
    )
    // Urutan baris tidak mengubah resep.
    .sort();
  return JSON.stringify([r5(v.top_pct), r5(v.mid_pct), r5(v.base_pct), lines]);
}

export function sameContent(a: VersionContent, b: VersionContent): boolean {
  return signature(a) === signature(b);
}
