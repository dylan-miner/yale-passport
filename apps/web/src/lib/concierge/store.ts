import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Channel,
  Conversation,
  Direction,
  Message,
  SenderType,
} from "@/lib/types";

// Conversation/message persistence for the concierge engine.
// Uses the service role — callers must authorize access BEFORE calling these
// (the API route verifies the conversation belongs to the signed-in user).

export async function getOrCreateConciergeConversation(
  profileId: string,
): Promise<Conversation> {
  const supabase = createAdminClient();
  const { data: existing, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("kind", "concierge")
    .eq("profile_a", profileId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing as Conversation;

  const { data, error: insertError } = await supabase
    .from("conversations")
    .insert({ kind: "concierge", profile_a: profileId, profile_b: null })
    .select("*")
    .single();
  if (insertError) throw insertError;

  // First-run welcome — deterministic template (no LLM). The concierge
  // speaks first; that's the product.
  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name,current_city")
    .eq("id", profileId)
    .single();
  const first = prof?.full_name?.split(" ")[0] ?? "there";
  const city = prof?.current_city ?? "your city";
  await supabase.from("messages").insert({
    conversation_id: data.id,
    sender_type: "concierge",
    channel: "app",
    direction: "outbound",
    body: `Hey ${first} — I'm your Passport concierge. I can point you to who's worth meeting in ${city}, flag events, and make introductions when you're ready. What are you looking for?`,
  });

  return data as Conversation;
}

export async function appendMessage(args: {
  conversationId: string;
  senderType: SenderType;
  senderProfileId?: string | null;
  channel: Channel;
  direction: Direction;
  body: string;
}): Promise<Message> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: args.conversationId,
      sender_type: args.senderType,
      sender_profile_id: args.senderProfileId ?? null,
      channel: args.channel,
      direction: args.direction,
      body: args.body,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50,
): Promise<Message[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as Message[];
}

export async function getRecentMessages(
  conversationId: string,
  limit = 24,
): Promise<Message[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Message[]).reverse();
}

// Post a concierge-authored message into the user's concierge thread —
// used by proactive flows (location notices, match notifications) so the
// same thread the user replies to carries all outreach.
export async function notifyConcierge(
  profileId: string,
  body: string,
  channel: Channel = "app",
): Promise<Message> {
  const conversation = await getOrCreateConciergeConversation(profileId);
  return appendMessage({
    conversationId: conversation.id,
    senderType: "concierge",
    channel,
    direction: "outbound",
    body,
  });
}

export async function logEngagement(
  type: string,
  profileId: string | null,
  meta: Record<string, unknown> = {},
) {
  const supabase = createAdminClient();
  await supabase.from("engagement_events").insert({
    profile_id: profileId,
    type,
    meta,
  });
}
