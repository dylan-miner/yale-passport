import "server-only";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";
import { notifyConcierge, logEngagement } from "@/lib/concierge/store";
import { getCityRecommendations, type CityDigest } from "./recommend";

const MODEL = process.env.CONCIERGE_MODEL ?? "gpt-4o-mini";
const MAX_LEN = 320;

function templateMessage(
  profile: Profile,
  kind: "travel" | "relocation",
  digest: CityDigest,
  returnedHome: boolean,
): string {
  const first = profile.full_name.split(" ")[0];
  const alums = digest.alumni.map((a) => a.name.split(" ")[0]).join(", ");
  const parts: string[] = [];
  parts.push(
    returnedHome
      ? `Welcome back to ${digest.city}, ${first}.`
      : kind === "relocation"
        ? `Welcome to ${digest.city}, ${first} — you're officially here.`
        : `In ${digest.city} for a bit, ${first}? Good timing.`,
  );
  if (digest.alumni.length)
    parts.push(
      `${digest.alumni.length} opted-in alum${digest.alumni.length > 1 ? "s" : ""} here${alums ? ` incl. ${alums}` : ""} — say the word and I'll request an intro.`,
    );
  if (digest.events.length) {
    const e = digest.events[0];
    parts.push(`Also: ${e.title}.`);
  }
  if (digest.resources.length)
    parts.push(`${digest.resources[0].name} is worth joining too.`);
  return parts.join(" ").slice(0, MAX_LEN);
}

async function composeMessage(
  profile: Profile,
  kind: "travel" | "relocation",
  digest: CityDigest,
  returnedHome: boolean,
): Promise<string> {
  const fallback = templateMessage(profile, kind, digest, returnedHome);
  const situation = returnedHome
    ? `just returned home to ${digest.city} after a trip`
    : kind === "relocation"
      ? `just moved permanently to ${digest.city}`
      : `visiting ${digest.city} temporarily`;
  try {
    const { text } = await generateText({
      model: openai(MODEL),
      temperature: 0.6,
      system: `You are the Passport concierge sending ONE proactive message (≤${MAX_LEN} chars — strictly enforce). Warm, plain, conversational SMS style; 2-3 short sentences max. Use ONLY facts from the digest provided — never invent people, events, dates, or places. If the digest is thin (no alumni, events, or resources), say something short and human instead of padding. No emoji, no markdown, no links.`,
      prompt: `User: ${profile.full_name.split(" ")[0]} (interests: ${[...profile.interests, ...profile.networking_goals].join(", ") || "—"}).\nSituation: ${situation}.\nVerified digest JSON: ${JSON.stringify(digest)}`,
    });
    const clean = text.trim();
    // Validate: enforce length + non-empty; otherwise use the verified template.
    if (!clean || clean.length > MAX_LEN) return fallback;
    return clean;
  } catch (err) {
    console.error("location notice compose failed:", err);
    return fallback;
  }
}

// Persist a proactive concierge message for a confirmed location change.
// Idempotent: same city+kind within 14d, or this exact signal already
// notified → skipped. Notification failure never throws — the caller's
// confirmation is already committed and stays valid.
export async function sendLocationNotice(args: {
  profile: Profile;
  signal: { id: number; city: string; kind: string; ends_on?: string | null };
  returnedHome?: boolean;
}): Promise<{ sent: boolean; reason?: string }> {
  const { profile, signal } = args;
  const kind = signal.kind === "relocation" ? "relocation" : "travel";
  const returnedHome = !!args.returnedHome;
  const supabase = createAdminClient();

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: prior } = await supabase
    .from("engagement_events")
    .select("id,meta")
    .eq("profile_id", profile.id)
    .eq("type", "location_notice_sent")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  const dupe = (prior ?? []).find(
    (e) =>
      e.meta?.signal_id === signal.id ||
      (e.meta?.city === signal.city &&
        e.meta?.kind === kind &&
        !!e.meta?.returned_home === returnedHome),
  );
  if (dupe) return { sent: false, reason: "deduped" };

  const digest = await getCityRecommendations({
    profile,
    city: signal.city,
    endsOn: signal.ends_on ?? null,
  });
  const text = await composeMessage(profile, kind, digest, returnedHome);

  try {
    await notifyConcierge(profile.id, text);
  } catch (err) {
    console.error("location notice delivery failed:", err);
    await logEngagement("location_notice_failed", profile.id, {
      signal_id: signal.id,
      city: signal.city,
      kind,
    });
    return { sent: false, reason: "delivery_failed" };
  }

  // Persist recommendation context — the concierge engine injects this so
  // follow-ups like "yes, introduce me" act on real alumni_ids.
  await logEngagement("location_notice_sent", profile.id, {
    signal_id: signal.id,
    city: signal.city,
    kind,
    returned_home: returnedHome,
    recommendations: digest.alumni.map((a) => ({
      alumni_id: a.alumni_id,
      name: a.name,
      canIntro: a.canIntro,
    })),
    events: digest.events.map((e) => ({ title: e.title, when: e.when })),
    ends_on: signal.ends_on ?? null,
  });
  return { sent: true };
}
