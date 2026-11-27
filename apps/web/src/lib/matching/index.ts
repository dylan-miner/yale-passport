import "server-only";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Channel, Match, Profile } from "@/lib/types";
import {
  appendMessage,
  logEngagement,
  notifyConcierge,
} from "@/lib/concierge/store";

const MODEL = process.env.CONCIERGE_MODEL ?? "gpt-4o-mini";

// ---------- shared helpers ----------

const norm = (v: string | null | undefined) => (v ? v.trim().toLowerCase() : "");
const firstName = (p: Pick<Profile, "full_name">) => p.full_name.split(" ")[0];

// Safe fields shown on a match card — same surface as the directory view.
export type CounterpartCard = Pick<
  Profile,
  | "id"
  | "full_name"
  | "grad_year"
  | "current_city"
  | "industry"
  | "company"
  | "role_title"
  | "interests"
  | "networking_goals"
  | "is_synthetic"
>;

export type MatchSummary = Match & {
  counterpart: CounterpartCard;
  contact?: {
    full_name: string;
    personal_email: string | null;
    phone_e164: string | null;
    linkedin_url: string | null;
  } | null;
};

function counterpartCard(p: Profile): CounterpartCard {
  return {
    id: p.id,
    full_name: p.full_name,
    grad_year: p.grad_year,
    current_city: p.current_city,
    industry: p.industry,
    company: p.company,
    role_title: p.role_title,
    interests: p.interests,
    networking_goals: p.networking_goals,
    is_synthetic: p.is_synthetic,
  };
}

// ---------- request an introduction ----------

export type IntroResult =
  | { ok: true; match: Match; counterpartName: string; message: string }
  | { ok: false; message: string };

// Shared by the concierge tool and POST /api/matches. All authorization and
// consent checks live here — callers only supply the authenticated initiator.
export async function requestIntro(args: {
  initiator: Profile;
  alumniId: string;
  channel: Channel;
}): Promise<IntroResult> {
  const { initiator, alumniId, channel } = args;
  const supabase = createAdminClient();

  if (alumniId === initiator.id) {
    return { ok: false, message: "You can't request an intro to yourself." };
  }

  const { data: counterpart, error: cpError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", alumniId)
    .maybeSingle();
  if (cpError || !counterpart) {
    return { ok: false, message: "Alumni not found." };
  }
  const cp = counterpart as Profile;
  const cpFirst = firstName(cp);

  const { data: hasIntroConsent } = await supabase.rpc("has_consent", {
    p_profile_id: alumniId,
    p_key: "introductions",
  });
  if (!hasIntroConsent) {
    return {
      ok: false,
      message: `${cpFirst} hasn't opted into introductions, so I can't request one. Want me to look for someone similar?`,
    };
  }

  // (A→B) OR (B→A) — flat OR terms are each AND'd filters inside and() groups.
  const pair = `and(initiator_id.eq.${initiator.id},counterpart_id.eq.${alumniId}),and(initiator_id.eq.${alumniId},counterpart_id.eq.${initiator.id})`;
  const { data: existing } = await supabase
    .from("matches")
    .select("id,status")
    .or(pair)
    .in("status", ["proposed", "awaiting_counterpart", "mutual"])
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      message:
        existing.status === "mutual"
          ? "You two already matched — the intro is on your Connect tab."
          : "An introduction request is already in flight for this person. You'll hear back as soon as they respond.",
    };
  }

  const shared = [...initiator.interests, ...initiator.networking_goals]
    .map(norm)
    .filter((t) =>
      [...cp.interests, ...cp.networking_goals].map(norm).includes(t),
    )
    .filter((t, i, a) => a.indexOf(t) === i);
  const reason = [
    initiator.current_city && cp.current_city
      ? `Both in ${initiator.current_city}`
      : null,
    shared.length ? `shared interests: ${shared.slice(0, 3).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const { data: match, error: insertError } = await supabase
    .from("matches")
    .insert({
      initiator_id: initiator.id,
      counterpart_id: alumniId,
      context: "requested",
      status: "awaiting_counterpart",
      initiator_response: "accepted",
      counterpart_response: "pending",
      match_reason: reason || null,
      shared_interests: shared,
    })
    .select("*")
    .single();
  if (insertError) return { ok: false, message: insertError.message };

  await logEngagement("match_requested", initiator.id, {
    counterpart: alumniId,
    channel,
  });
  await notifyConcierge(
    alumniId,
    `Heads up — ${initiator.full_name} (Yale '${String(initiator.grad_year).slice(-2)}) asked me to introduce you two${reason ? ` — ${reason}` : ""}. Want me to connect you? Reply yes to accept or no to pass.`,
    channel,
  );

  return {
    ok: true,
    match: match as Match,
    counterpartName: cp.full_name,
    message: `Intro request sent to ${cpFirst}. It's double opt-in — I'll let you know the moment they respond.`,
  };
}

// ---------- respond / lifecycle ----------

export type RespondResult =
  | { ok: true; status: Match["status"]; mutual: boolean }
  | { ok: false; message: string };

// `actor` is the profile performing the response. For real users the API route
// derives it from the session; the simulator passes the synthetic profile.
export async function respondToMatch(args: {
  matchId: string;
  actor: Profile;
  accept: boolean;
}): Promise<RespondResult> {
  const { matchId, actor, accept } = args;
  const supabase = createAdminClient();

  const { data: m } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (!m) return { ok: false, message: "Match not found." };
  const match = m as Match;

  const isInitiator = actor.id === match.initiator_id;
  const isCounterpart = actor.id === match.counterpart_id;
  if (!isInitiator && !isCounterpart) {
    return { ok: false, message: "You are not a participant in this match." };
  }
  if (["mutual", "declined", "expired"].includes(match.status)) {
    return { ok: true, status: match.status, mutual: match.status === "mutual" };
  }
  if (isInitiator && match.status === "awaiting_counterpart") {
    return { ok: false, message: "You're waiting on the other person's response." };
  }
  if (isCounterpart && match.status === "proposed") {
    return { ok: false, message: "The initiator hasn't responded yet." };
  }

  const roleColumn = isInitiator ? "initiator_response" : "counterpart_response";

  if (!accept) {
    const { error } = await supabase
      .from("matches")
      .update({
        status: "declined",
        resolved_at: new Date().toISOString(),
        [roleColumn]: "declined",
      })
      .eq("id", matchId)
      .eq("status", match.status);
    if (error) return { ok: false, message: error.message };

    const otherId = isInitiator ? match.counterpart_id : match.initiator_id;
    await notifyConcierge(
      otherId,
      `${firstName(actor)} passed on the introduction this time — no worries, I'll keep looking.`,
    );
    await logEngagement("match_declined", actor.id, { match: matchId });
    return { ok: true, status: "declined", mutual: false };
  }

  const nextStatus: Match["status"] = isInitiator
    ? "awaiting_counterpart"
    : "mutual";
  const { error } = await supabase
    .from("matches")
    .update({
      status: nextStatus,
      [roleColumn]: "accepted",
      ...(nextStatus === "mutual"
        ? { resolved_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", matchId)
    .eq("status", match.status);
  if (error) return { ok: false, message: error.message };

  if (nextStatus === "awaiting_counterpart") {
    await logEngagement("match_initiator_accepted", actor.id, { match: matchId });
    return { ok: true, status: nextStatus, mutual: false };
  }

  await resolveMutual(matchId);
  return { ok: true, status: "mutual", mutual: true };
}

// Mutual reached: draft the intro, open the match conversation, notify both.
async function resolveMutual(matchId: string) {
  const supabase = createAdminClient();
  const { data: m } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (!m) return;
  const match = m as Match;

  const { data: people } = await supabase
    .from("profiles")
    .select("*")
    .in("id", [match.initiator_id, match.counterpart_id]);
  const initiator = people?.find((p) => p.id === match.initiator_id) as
    | Profile
    | undefined;
  const counterpart = people?.find((p) => p.id === match.counterpart_id) as
    | Profile
    | undefined;
  if (!initiator || !counterpart) return;

  const intro = await generateIntroDraft(initiator, counterpart, match);

  const { data: convo } = await supabase
    .from("conversations")
    .insert({
      kind: "match",
      match_id: matchId,
      profile_a: match.initiator_id,
      profile_b: match.counterpart_id,
    })
    .select("id")
    .single();
  if (convo) {
    await appendMessage({
      conversationId: convo.id,
      senderType: "concierge",
      channel: "app",
      direction: "outbound",
      body: intro,
    });
  }

  await supabase
    .from("matches")
    .update({ intro_draft: intro })
    .eq("id", matchId);

  await notifyConcierge(
    match.initiator_id,
    `${firstName(counterpart)} said yes — you're connected! Your intro and their contact details are on the Connect tab.`,
  );
  await notifyConcierge(
    match.counterpart_id,
    `You're connected with ${firstName(initiator)} — I sent your intro to the Connect tab along with their contact details.`,
  );
  await logEngagement("match_mutual", null, { match: matchId });
}

async function generateIntroDraft(
  a: Profile,
  b: Profile,
  match: Match,
): Promise<string> {
  const shared = (match.shared_interests ?? []) as string[];
  const fallback = `${firstName(a)}, meet ${firstName(b)} — ${b.full_name}, Yale '${String(b.grad_year).slice(-2)}${b.company ? `, ${b.role_title ?? ""} at ${b.company}` : ""} in ${b.current_city}. ${firstName(b)}, this is ${a.full_name}, Yale '${String(a.grad_year).slice(-2)}${a.company ? `, ${a.role_title ?? ""} at ${a.company}` : ""}. ${shared.length ? `You both care about ${shared.slice(0, 2).join(" and ")} — ` : ""}you're both in ${a.current_city}, so I'll leave it to you two from here.`;

  try {
    const { text } = await generateText({
      model: openai(MODEL),
      temperature: 0.7,
      system:
        "You write short, warm double-opt-in introductions for an alumni network, like a mutual friend texting both people. 2-4 sentences, plain text, no subject line. Mention one concrete thing they share. End by handing the conversation off to them.",
      prompt: `Introduce these two Yale alumni to each other (address both by first name):\n\n${a.full_name} ('${String(a.grad_year).slice(-2)}) — ${[a.role_title, a.company].filter(Boolean).join(" at ") || a.industry || "Yale alum"}, ${a.current_city}. Interests: ${a.interests.join(", ") || "—"}. Goals: ${a.networking_goals.join(", ") || "—"}.\n\n${b.full_name} ('${String(b.grad_year).slice(-2)}) — ${[b.role_title, b.company].filter(Boolean).join(" at ") || b.industry || "Yale alum"}, ${b.current_city}. Interests: ${b.interests.join(", ") || "—"}. Goals: ${b.networking_goals.join(", ") || "—"}.\n\nShared: ${shared.join(", ") || "Yale + same city"}. Context: ${match.match_reason ?? "mutual opt-in introduction"}.`,
    });
    return text.trim() || fallback;
  } catch (err) {
    console.error("intro generation failed:", err);
    return fallback;
  }
}

// ---------- queries ----------

export async function getMatchesForProfile(
  profileId: string,
): Promise<MatchSummary[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .or(`initiator_id.eq.${profileId},counterpart_id.eq.${profileId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const matches = (data ?? []) as Match[];
  if (matches.length === 0) return [];

  const otherIds = matches.map((m) =>
    m.initiator_id === profileId ? m.counterpart_id : m.initiator_id,
  );
  const { data: people } = await supabase
    .from("profiles")
    .select("*")
    .in("id", otherIds);
  const byId = new Map((people ?? []).map((p) => [p.id, p as Profile]));

  return matches.map((m) => {
    const otherId =
      m.initiator_id === profileId ? m.counterpart_id : m.initiator_id;
    return {
      ...m,
      counterpart: counterpartCard(byId.get(otherId)!),
    };
  });
}
