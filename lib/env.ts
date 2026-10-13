/**
 * Variabel lingkungan. Hanya yang aman dibaca di client ada di file ini.
 *
 * SUPABASE_SERVICE_ROLE_KEY TIDAK pernah disentuh di sini — dia hanya dibaca
 * di lib/supabase/admin.ts yang ditandai server-only, supaya tidak mungkin
 * ikut ke bundle browser.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

/** true kalau kredensial Supabase sudah terisi. */
export function isConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/**
 * Daftar env yang belum terisi, untuk ditampilkan di layar setup.
 * Error "terjadi kesalahan" tanpa penjelasan adalah hal yang paling tidak
 * berguna yang bisa ditampilkan sebuah aplikasi.
 */
export function missingEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}
