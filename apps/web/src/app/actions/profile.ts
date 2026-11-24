"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CONSENT_KEYS, type ConsentKey } from "@/lib/types";

const listFrom = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required"),
  grad_year: z.coerce.number().int().min(1900).max(2100),
  personal_email: z.union([z.literal(""), z.string().trim().email()]),
  phone_e164: z.union([z.literal(""), z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number")]),
  home_city: z.string().trim().min(1, "Home city is required"),
  current_city: z.string().trim().min(1, "Current city is required"),
  industry: z.string().trim(),
  company: z.string().trim(),
  role_title: z.string().trim(),
  linkedin_url: z.union([z.literal(""), z.string().trim().url()]),
  portfolio_url: z.union([z.literal(""), z.string().trim().url()]),
  availability_text: z.string().trim(),
});

const toNull = (s: string) => (s === "" ? null : s);

function readProfile(formData: FormData) {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    grad_year: formData.get("grad_year"),
    personal_email: formData.get("personal_email"),
    phone_e164: formData.get("phone_e164"),
    home_city: formData.get("home_city"),
    current_city: formData.get("current_city"),
    industry: formData.get("industry"),
    company: formData.get("company"),
    role_title: formData.get("role_title"),
    linkedin_url: formData.get("linkedin_url"),
    portfolio_url: formData.get("portfolio_url"),
    availability_text: formData.get("availability_text"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const p = parsed.data;
  return {
    row: {
      full_name: p.full_name,
      grad_year: p.grad_year,
      personal_email: toNull(p.personal_email),
      phone_e164: toNull(p.phone_e164),
      home_city: p.home_city,
      current_city: p.current_city,
      industry: toNull(p.industry),
      company: toNull(p.company),
      role_title: toNull(p.role_title),
      linkedin_url: toNull(p.linkedin_url),
      portfolio_url: toNull(p.portfolio_url),
      availability_text: toNull(p.availability_text),
      interests: listFrom(formData.get("interests")),
      networking_goals: listFrom(formData.get("networking_goals")),
    },
  };
}

export type ProfileFormState = { error?: string; saved?: boolean };

export async function completeOnboarding(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();
  const parsed = readProfile(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({ ...parsed.row, user_id: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const consents = CONSENT_KEYS.map((key) => ({
    profile_id: profile.id,
    key,
    granted: formData.get(`consent_${key}`) === "on",
  }));
  const { error: consentError } = await supabase.from("consents").insert(consents);
  if (consentError) return { error: consentError.message };

  redirect("/discover");
}

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();
  const parsed = readProfile(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("profiles")
    .update(parsed.row)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { saved: true };
}

export async function setConsent(key: ConsentKey, granted: boolean) {
  if (!CONSENT_KEYS.includes(key)) return { error: "Unknown consent key" };
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) return { error: "No profile found" };

  const { error } = await supabase.from("consents").upsert(
    { profile_id: profile.id, key, granted },
    { onConflict: "profile_id,key" },
  );
  if (error) return { error: error.message };
  return {};
}
