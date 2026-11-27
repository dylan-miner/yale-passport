import { Suspense, type ReactNode } from "react";
import { AppNav } from "@/components/nav";
import { LocationPrompt } from "@/components/location-prompt";
import { requireUser } from "@/lib/auth";

// Gates routed content on a session; redirects to /login before rendering
// children if there isn't one.
async function AuthGate({ children }: { children: ReactNode }) {
  await requireUser();
  return <>{children}</>;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 md:pb-10 md:pt-8">
        <Suspense fallback={null}>
          <AuthGate>
            <LocationPrompt />
            {children}
          </AuthGate>
        </Suspense>
      </main>
    </div>
  );
}
