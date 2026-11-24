import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser, getMyProfile } from "@/lib/auth";
import type { Consent } from "@/lib/types";
import { ProfileView } from "./profile-view";

async function ProfileLoader() {
  const { supabase, user } = await requireUser();
  const profile = await getMyProfile(supabase, user.id);
  if (!profile) redirect("/onboarding");

  const { data: consents } = await supabase
    .from("consents")
    .select("profile_id, key, granted, updated_at")
    .eq("profile_id", profile.id);

  return (
    <ProfileView
      profile={profile}
      consents={(consents ?? []) as Consent[]}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileLoader />
    </Suspense>
  );
}

