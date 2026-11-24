import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

async function LoginGuard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const linkError = params?.error === "link";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");
  return <LoginForm linkError={linkError} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <Suspense fallback={null}>
        <LoginGuard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
