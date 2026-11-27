import { Suspense } from "react";
import Image from "next/image";
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

function PhotoPanel({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Image
        src="/photos/yale-campus.jpg"
        alt="Harkness Tower on the Yale campus"
        fill
        priority
        className="object-cover"
        sizes="(min-width: 768px) 46vw, 100vw"
      />
      <div className="absolute inset-0 bg-yale-night/55" />
      <div className="absolute inset-x-0 bottom-0 hidden p-10 md:block">
        <p className="font-display text-2xl italic leading-snug text-white">
          &ldquo;Your Yale network,
          <br />
          wherever you land.&rdquo;
        </p>
        <p className="mt-3 text-sm text-white/75">
          Warm introductions to local alumni — for recent graduates who just
          moved.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  return (
    <main className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* Photo panel: full-height side rail on desktop, top band on mobile */}
      <PhotoPanel className="relative hidden md:block md:w-[46%]" />
      <PhotoPanel className="relative h-44 md:hidden" />

      <div className="flex flex-1 items-center justify-center px-6 py-10 md:py-0">
        <Suspense fallback={null}>
          <LoginGuard searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
