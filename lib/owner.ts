import "server-only";

/**
 * Sumber owner_id. Titik tukar kedua untuk fase 5.
 *
 * Fase 1-4: satu UUID dummy tetap, yang barisnya dibuat oleh
 * supabase/seed/seed.sql. Semua kueri yang butuh owner_id tetap jalan, jadi
 * kolom owner_id dan RLS ikut teruji sejak awal.
 *
 * Fase 5: ganti isinya dengan user dari sesi server —
 *   const { data: { user } } = await (await createServerSupabase()).auth.getUser()
 *   if (!user) redirect("/login")
 *   return user.id
 * Lalu pindahkan kepemilikan data pengembangan ke akun asli dengan SQL di
 * 05-auth-payment-deploy.md §1.2 langkah 7.
 */
export const DEV_OWNER_ID =
  process.env.DEV_OWNER_ID ?? "00000000-0000-0000-0000-000000000001";

export async function getOwnerId(): Promise<string> {
  return DEV_OWNER_ID;
}
