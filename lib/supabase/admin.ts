import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Klien service-role. MELEWATI RLS.
 *
 * Boleh dipakai hanya di: skrip seed, import CSV admin, dan migrasi — plus
 * seluruh server action selama fase 1-4 sementara auth belum ada.
 *
 * Setelah fase 5, hentikan pemakaiannya di jalur request normal. Lihat
 * lib/supabase/db.ts — itu satu-satunya tempat yang perlu diubah.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local, lalu restart dev server.",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
