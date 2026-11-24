import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser, getMyProfile } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

async function OnboardingLoader() {
  const { supabase, user } = await requireUser();
  const profile = await getMyProfile(supabase, user.id);
  if (profile) redirect("/discover");
  return <OnboardingForm email={user.email ?? ""} />;
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col px-4 py-8">
      <Suspense fallback={null}>
        <OnboardingLoader />
      </Suspense>
    </main>
  );
}
