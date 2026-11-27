import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LocationSignal, Profile } from "@/lib/types";

// ─── Trip lifecycle ────────────────────────────────────────────────────────
// Geography-driven, not date-driven:
//  - A trip activates when a confirmed 'travel' signal lands in a city that
//    is not the user's residence (starts_on, if set, must be today or past).
//  - A trip closes when (a) any newer confirmed signal arrives for the user —
//    including "I'm back home" (travel signal at the residence city) — or
//    (b) a relocation lands, which supersedes travel context entirely.
//  - ends_on NEVER closes a trip. It only sharpens event recommendations.
//  - Native background location plugs in here later by writing the same
//    signals — lifecycle logic is pure over the signals table.
// ─────────────────────────────────────────────────────────────────────────

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export type ActiveTrip = {
  city: string;
  since: string;
  endsOn: string | null;
};

// The user's current geographic context: an open trip, or their residence.
export async function getTravelContext(profile: Profile): Promise<{
  activeTrip: ActiveTrip | null;
  residenceCity: string;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("location_signals")
    .select("city,starts_on,ends_on,created_at")
    .eq("profile_id", profile.id)
    .eq("kind", "travel")
    .eq("confirmed", true)
    .is("closed_at", null)
    .order("created_at", { ascending: false })
    .limit(8);

  // Most recent STARTED open signal wins. An unstarted (future-dated) trip
  // doesn't shadow a current one; a started signal at the residence city
  // means the user is home.
  const today = new Date().toISOString().slice(0, 10);
  const sig = (data ?? []).find(
    (s) => !s.starts_on || s.starts_on <= today,
  );
  const awayFromHome = sig && norm(sig.city) !== norm(profile.current_city);

  return {
    activeTrip:
      sig && awayFromHome
        ? { city: sig.city, since: sig.created_at, endsOn: sig.ends_on }
        : null,
    residenceCity: profile.current_city,
  };
}

// Confirm a location report. Voluntary reporting does NOT require the
// detection consent — that consent only gates automatic detect. Idempotent:
// an equivalent open confirmed signal within 14d returns deduped:true.
export async function confirmLocation(args: {
  profile: Profile;
  city: string;
  kind: "travel" | "relocation";
  source: "manual" | "browser" | "ip" | "sms";
  startsOn?: string | null;
  endsOn?: string | null;
}): Promise<{ signal: LocationSignal; deduped: boolean }> {
  const { profile, kind, source } = args;
  const city = args.city.trim();
  const supabase = createAdminClient();

  // Idempotency: same open confirmed signal within 14 days → return existing.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("location_signals")
    .select("*")
    .eq("profile_id", profile.id)
    .eq("kind", kind)
    .eq("confirmed", true)
    .is("closed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (recent?.[0] && norm(recent[0].city) === norm(city)) {
    return { signal: recent[0] as LocationSignal, deduped: true };
  }

  // A present-tense signal supersedes STARTED open trips only — a
  // future-dated trip the user already logged is a plan, not the present,
  // and survives. A future-dated new signal closes nothing at all.
  const today = new Date().toISOString().slice(0, 10);
  if (!args.startsOn || args.startsOn <= today) {
    await supabase
      .from("location_signals")
      .update({ closed_at: new Date().toISOString() })
      .eq("profile_id", profile.id)
      .eq("kind", "travel")
      .is("closed_at", null)
      .or(`starts_on.is.null,starts_on.lte.${today}`);
  }

  const { data: signal, error } = await supabase
    .from("location_signals")
    .insert({
      profile_id: profile.id,
      city,
      source,
      kind,
      confirmed: true,
      starts_on: args.startsOn ?? null,
      ends_on: args.endsOn ?? null,
    })
    .select("*")
    .single();
  if (error) {
    // Concurrent equivalent report won the insert race (unique partial
    // index on open confirmed signals) — return it as deduped.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("location_signals")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("kind", kind)
        .eq("confirmed", true)
        .is("closed_at", null)
        .ilike("city", city)
        .limit(1);
      if (existing?.[0]) {
        return { signal: existing[0] as LocationSignal, deduped: true };
      }
    }
    throw error;
  }

  if (kind === "relocation") {
    // Relocation supersedes travel context; home_city is never auto-mutated.
    await supabase
      .from("profiles")
      .update({ current_city: city })
      .eq("id", profile.id);
  }

  return { signal: signal as LocationSignal, deduped: false };
}
