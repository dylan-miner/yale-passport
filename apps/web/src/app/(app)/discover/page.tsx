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
          <div className="h-40 animate-pulse rounded-3xl bg-yale-night/80 md:h-48" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 w-20 animate-pulse rounded-full bg-line-soft"
              />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-line-soft bg-white"
              />
            ))}
          </div>
        </div>
      }
    >
      <DiscoverData />
    </Suspense>
  );
}
