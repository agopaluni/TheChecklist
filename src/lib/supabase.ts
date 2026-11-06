import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The whole app talks to Supabase from the browser. All rules live in Postgres
// functions (supabase/migrations), so there is no server-side API layer to keep in sync.
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true } },
    );
  }
  return client;
}

export const googleSignInEnabled = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "true";
