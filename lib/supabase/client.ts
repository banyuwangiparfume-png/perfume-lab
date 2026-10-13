import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "../env";
import type { Database } from "./database.types";

/** Klien browser. Hanya memakai anon key — menghormati RLS. */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  );
}
