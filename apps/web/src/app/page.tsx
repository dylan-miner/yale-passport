import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth";

async function RootRedirect(): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const profile = await getMyProfile(supabase, user.id);
  redirect(profile ? "/discover" : "/onboarding");
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <RootRedirect />
    </Suspense>
  );
}
