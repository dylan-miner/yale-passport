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
