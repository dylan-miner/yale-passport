import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CityResource,
  DirectoryProfile,
  Event,
  Profile,
} from "@/lib/types";

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export type RecommendedAlum = {
  alumni_id: string;
  name: string;
  headline: string | null;
  shared: string[];
  canIntro: boolean;
};

export type RecommendedEvent = {
  title: string;
  when: string;
  where: string | null;
  tags: string[];
};

export type CityDigest = {
  city: string;
  alumni: RecommendedAlum[];
  events: RecommendedEvent[];
  resources: { name: string; type: CityResource["type"]; url: string | null }[];
};

// Personalized, consent-respecting recommendations for a city — NOT a
// generic digest. Alumni are ranked by shared networking goals and
// interests (goals weighted higher); only profiles with introductions
// consent are marked canIntro. Events are bounded to the trip window when
// an end date is known.
export async function getCityRecommendations(args: {
  profile: Profile;
  city: string;
  endsOn?: string | null;
  limit?: number;
}): Promise<CityDigest> {
  const { profile, city } = args;
  const limit = args.limit ?? 3;
  const supabase = createAdminClient();

  const [alumniRes, eventsRes, resourcesRes, consentRes] = await Promise.all([
    supabase
      .from("directory_profiles")
      .select("*")
      .ilike("current_city", city)
      .neq("id", profile.id),
    (() => {
      const now = new Date().toISOString();
      const until = args.endsOn
        ? new Date(`${args.endsOn}T23:59:59Z`).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return supabase
        .from("events")
        .select("*")
        .ilike("city", city)
        .gte("starts_at", now)
        .lte("starts_at", until)
        .order("starts_at")
        .limit(6);
    })(),
    supabase.from("city_resources").select("*").ilike("city", city).limit(8),
    // Batch: who in this city opted into introductions
    supabase
      .from("consents")
      .select("profile_id")
      .eq("key", "introductions")
      .eq("granted", true),
  ]);

  const introOk = new Set((consentRes.data ?? []).map((c) => c.profile_id));
  const myTags = new Set(
    [...profile.interests, ...profile.networking_goals].map(norm),
  );

  const scored = ((alumniRes.data ?? []) as DirectoryProfile[])
    .map((a) => {
      const goalOverlap = a.networking_goals.filter((g) => myTags.has(norm(g)));
      const interestOverlap = a.interests.filter((i) => myTags.has(norm(i)));
      const sameIndustry =
        profile.industry && norm(a.industry) === norm(profile.industry);
      const score =
        goalOverlap.length * 2 +
        interestOverlap.length +
        (sameIndustry ? 1 : 0);
      return { a, score, shared: [...goalOverlap, ...interestOverlap] };
    })
    .sort((x, y) => y.score - x.score);

  return {
    city,
    alumni: scored.slice(0, limit).map(({ a, shared }) => ({
      alumni_id: a.id,
      name: a.full_name,
      headline:
        [a.role_title, a.company].filter(Boolean).join(" at ") ||
        a.industry,
      shared,
      canIntro: introOk.has(a.id),
    })),
    events: ((eventsRes.data ?? []) as Event[]).map((e) => ({
      title: e.title,
      when: e.starts_at,
      where: [e.venue, e.neighborhood].filter(Boolean).join(", ") || null,
      tags: e.tags,
    })),
    resources: ((resourcesRes.data ?? []) as CityResource[]).map((r) => ({
      name: r.name,
      type: r.type,
      url: r.url,
    })),
  };
}
