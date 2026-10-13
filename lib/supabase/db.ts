import "server-only";

import { createAdminClient } from "./admin";

/**
 * SATU-SATUNYA titik tempat server action mengambil koneksi database.
 *
 * Fase 1-4: memakai service-role key dan satu owner_id dummy tetap, karena
 * auth belum dipasang. RLS tetap AKTIF di database — kita hanya melewatinya
 * sementara, bukan mematikannya, supaya policy-nya ikut teruji begitu auth
 * masuk.
 *
 * Fase 5 (lihat 05-auth-payment-deploy.md §1.2 langkah 5): ganti isi fungsi ini
 * dengan createServerSupabase() dari ./server, dan getOwnerId() di lib/owner.ts
 * dengan user dari sesi. Setelah itu service-role hanya dipakai di skrip seed,
 * import CSV admin, dan migrasi.
 */
export function getDb() {
  return createAdminClient();
}
