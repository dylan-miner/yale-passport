import "server-only";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Channel, Message, Profile } from "@/lib/types";
import {
  appendMessage,
  getOrCreateConciergeConversation,
  getRecentMessages,
  logEngagement,
} from "./store";
import { buildConciergeTools } from "./tools";

const MODEL = process.env.CONCIERGE_MODEL ?? "gpt-4o-mini";

// Alumni recommended in a recent proactive location notice — injected so
// follow-ups like "yes, introduce me" act on a real alumni_id, not memory.
async function getPendingRecommendations(
  profileId: string,
): Promise<{ alumni_id: string; name: string; canIntro: boolean }[]> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("engagement_events")
    .select("meta,created_at")
    .eq("profile_id", profileId)
    .eq("type", "location_notice_sent")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  const recs = data?.[0]?.meta?.recommendations;
  return Array.isArray(recs) ? recs : [];
}

function buildSystemPrompt(
  profile: Profile,
  pendingRecs: { alumni_id: string; name: string; canIntro: boolean }[] = [],
): string {
  const name = profile.full_name.split(" ")[0] ?? "there";
  const identity = [
    profile.role_title && profile.company
      ? `${profile.role_title} at ${profile.company}`
      : (profile.company ?? profile.industry ?? null),
    profile.grad_year ? `Yale '${String(profile.grad_year).slice(-2)}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `You are the Passport concierge — a warm, proactive personal assistant helping ${name}, a recent Yale graduate, build a network in ${profile.current_city ?? "their new city"}. You communicate over SMS, so replies must be brief and conversational: 1–3 short sentences, plain text, no markdown, no bullet points unless you're listing 2+ results (then use short lines). Never use emoji unless the user does first.

About ${name}: ${identity || "recent Yale grad"}. Home city: ${profile.home_city ?? "unknown"}. Interests: ${profile.interests.join(", ") || "not set"}. Networking goals: ${profile.networking_goals.join(", ") || "not set"}. Today is ${new Date().toDateString()}.

You can:
- Search the alumni directory and suggest people to meet (search_alumni). Always call search_alumni before talking about any alumni — never answer from memory, and never say someone "isn't in the directory" without searching first this turn. When the user names a specific person, pass their name to search_alumni's name field and don't filter by city — alumni can live anywhere.
- Propose introductions (propose_match). Intros are double opt-in: you send the request, the other person must accept. When the user asks for an introduction to a named person and your search returned them, call propose_match in the SAME response — do NOT ask "want me to send it?" or any other confirmation first. The user's request is already the confirmation; the counterpart's accept/decline is the consent step. Never share anyone's contact info — contact details are exchanged automatically only after a mutual match.
- Recommend events (list_events) and local alumni resources like clubs and group chats (list_city_resources).
- Read and update the user's profile (get_my_profile, update_profile).

Rules:
- For any profile change (new city, new job, updated interests, etc.), first reply confirming the exact change in plain language ("Got it — want me to update your city to Chicago?") and only call update_profile after the user explicitly confirms. For low-stakes details like availability you may also confirm first.
- Keep messages short. This is texting, not email.
- If the user asks for someone's contact info, explain that Passport exchanges contact details automatically once both people opt in — offer to request the intro instead.
- If the user says something ambiguous, ask a short clarifying question rather than guessing.
- If a tool reports an error or no results, say so briefly and offer an alternative.
- Today you reach ${name} in-app; the same conversation may later continue over SMS.${pendingContext(profile, pendingRecs)}`;
}

function pendingContext(
  profile: Profile,
  pendingRecs: { alumni_id: string; name: string; canIntro: boolean }[],
): string {
  const list = pendingRecs
    .filter((r) => r.canIntro)
    .map((r) => `${r.name} (alumni_id: ${r.alumni_id})`)
    .join("; ");
  if (!list) return "";
  const name = profile.full_name.split(" ")[0];
  return `\n\nCONTEXT — you recently sent ${name} a proactive message recommending these alumni: ${list}. If they reply affirmatively ("yes", "introduce me", "connect us", or naming one of them), call propose_match directly with that alumni_id — do not search first and do not re-ask for confirmation; their reply is the confirmation.`;
}

function toModelMessages(history: Message[]): ModelMessage[] {
  return history.map((m) => ({
    role: m.sender_type === "user" ? "user" : "assistant",
    content: m.body,
  }));
}

export type EngineResult = {
  replies: Message[];
  conversationId: string;
};

// Channel-agnostic entry point. The in-app route calls this directly; the
// Twilio webhook (M5) will call the same function with channel: "sms" and
// deliver `replies` over SMS instead of returning them in the response.
export async function handleConciergeMessage(args: {
  profile: Profile;
  text: string;
  channel: Channel;
}): Promise<EngineResult> {
  const { profile, text, channel } = args;
  const body = text.trim();
  if (!body) return { replies: [], conversationId: "" };

  const conversation = await getOrCreateConciergeConversation(profile.id);

  await appendMessage({
    conversationId: conversation.id,
    senderType: "user",
    senderProfileId: profile.id,
    channel,
    direction: "inbound",
    body,
  });
  await logEngagement("concierge_message_in", profile.id, { channel });

  const [history, pendingRecs] = await Promise.all([
    getRecentMessages(conversation.id, 24),
    getPendingRecommendations(profile.id),
  ]);

  let replyText: string;
  try {
    const result = await generateText({
      model: openai(MODEL),
      system: buildSystemPrompt(profile, pendingRecs),
      messages: toModelMessages(history),
      tools: buildConciergeTools(profile, channel),
      stopWhen: stepCountIs(6),
      temperature: 0.4,
    });
    replyText =
      result.text.trim() ||
      "Sorry — I blanked for a second. Can you say that another way?";
  } catch (err) {
    console.error("concierge engine error:", err);
    replyText =
      "Sorry, I hit a snag on my end. Give me a second and try that again?";
  }

  const reply = await appendMessage({
    conversationId: conversation.id,
    senderType: "concierge",
    channel,
    direction: "outbound",
    body: replyText,
  });
  await logEngagement("concierge_message_out", profile.id, { channel });

  return { replies: [reply], conversationId: conversation.id };
}
