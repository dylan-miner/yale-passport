// Shared helpers for HTTP smoke tests — signs in as the demo user exactly
// like the browser does and returns a replayable Cookie header.

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Returns { cookieHeader, userClient } — userClient is the same signed-in
// client used to mint the cookie, handy for user-scoped RPC calls.
export async function signInDemo() {
  const jar = new Map<string, string>();
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () =>
          [...jar.entries()].map(([name, value]) => ({ name, value })),
        setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)),
      },
    },
  );
  const { error } = await userClient.auth.signInWithPassword({
    email: "demo@passport.yale",
    password: process.env.DEMO_USER_PASSWORD ?? "yale-passport-demo",
  });
  if (error) throw new Error(`Demo sign-in failed: ${error.message}`);
  const cookieHeader = [...jar.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return { cookieHeader, userClient };
}

let failures = 0;
export function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
export function finish() {
  console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
