import { Suspense } from "react";
import { requireUser, getMyProfile } from "@/lib/auth";
import { getMatchesForProfile } from "@/lib/matching";
import type { MatchSummary } from "@/lib/matching";
import { ConnectView } from "./connect-view";

async function ConnectData() {
  const { supabase, user } = await requireUser();
  const profile = await getMyProfile(supabase, user.id);
  if (!profile) return null;

  const matches = await getMatchesForProfile(profile.id);

  // Contact release uses the user's own RLS client — get_match_contact only
  // returns data for mutual matches where the caller is a participant.
  const withContact = await Promise.all(
    matches.map(async (m) => {
      if (m.status !== "mutual") return m;
      const { data } = await supabase.rpc("get_match_contact", {
        p_match_id: m.id,
      });
      return { ...m, contact: (data?.[0] ?? null) as MatchSummary["contact"] };
    }),
  );

  return <ConnectView initialMatches={withContact} profileId={profile.id} />;
}

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Connect
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold">
              Introductions
            </h1>
          </div>
          <div className="animate-pulse rounded-3xl border border-line bg-white p-8 text-sm text-ink-soft">
            Loading your introductions…
          </div>
        </div>
      }
    >
      <ConnectData />
    </Suspense>
  );
}
