"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";

const DEMO_EMAIL = "demo@passport.yale";

export type AuthFormState = {
  error?: string;
  sent?: boolean;
};

async function destinationFor(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const profile = await getMyProfile(supabase, userId);
  return profile ? "/discover" : "/onboarding";
}

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  redirect(await destinationFor(supabase, data.user.id));
}

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email first." };

  const origin =
    (await headers()).get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { error: error.message };
  return { sent: true };
}

// Signs the stage demo account in without exposing its password to the
// browser — credentials stay in server env vars.
export async function signInDemo(): Promise<AuthFormState> {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) return { error: "Demo account is not configured." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password,
  });
  if (error) return { error: `Demo sign-in failed: ${error.message}` };

  redirect(await destinationFor(supabase, data.user.id));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
