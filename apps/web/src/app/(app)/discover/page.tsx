import { Suspense } from "react";
import { requireUser, getMyProfile } from "@/lib/auth";
import { getMatchesForProfile } from "@/lib/matching";
import { getTravelContext } from "@/lib/location/lifecycle";
import { DiscoverView, type DiscoverData } from "./discover-view";

async function DiscoverData() {
  const { supabase, user } = await requireUser();
  const profile = await getMyProfile(supabase, user.id);
  if (!profile) return null;

  // Reads go through the user's own RLS client — directory_profiles already
  // enforces directory_visibility consent inside the view.
  const [alumni, events, resources, matches] = await Promise.all([
    supabase
      .from("directory_profiles")
      .select("*")
      .neq("id", profile.id)
      .order("full_name"),
    supabase
      .from("events")
      .select("*")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at"),
    supabase.from("city_resources").select("*").order("name"),
    getMatchesForProfile(profile.id),
  ]);

  const matchByCounterpart = new Map(
    matches.map((m) => [
      m.initiator_id === profile.id ? m.counterpart_id : m.initiator_id,
      m.status,
    ]),
  );

  const ctx = await getTravelContext(profile);

  const data: DiscoverData = {
    me: { id: profile.id, city: profile.current_city },
    activeTrip: ctx.activeTrip,
    alumni: alumni.data ?? [],
    events: events.data ?? [],
    resources: resources.data ?? [],
    matchStatus: Object.fromEntries(matchByCounterpart),
  };

  return <DiscoverView data={data} />;
}

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Discover
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold">
              Your city
            </h1>
          </div>
          <div className="animate-pulse rounded-3xl border border-line bg-white p-8 text-sm text-ink-soft">
            Loading…
          </div>
        </div>
      }
    >
      <DiscoverData />
    </Suspense>
  );
}
