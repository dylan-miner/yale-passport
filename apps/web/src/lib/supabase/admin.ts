import "server-only";
import { createClient } from "@supabase/supabase-js";

// Privileged service-role client — bypasses RLS.
// Server-only: never import from client components or expose to the browser.
// Callers must perform their own authorization checks before using this.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env vars",
    );
  }

  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
