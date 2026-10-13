import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "../env";
import type { Database } from "./database.types";

/**
 * Klien berbasis sesi user. Menghormati RLS.
 *
 * Dipakai penuh mulai fase 5. Sebelum itu dia tetap ada supaya alur auth bisa
 * dipasang tanpa mengubah struktur.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Dipanggil dari Server Component: cookie tidak bisa ditulis di
            // sini. Middleware yang menyegarkan sesinya.
          }
        },
      },
    },
  );
}
