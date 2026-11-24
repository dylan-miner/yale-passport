import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { handleConciergeMessage } from "@/lib/concierge/engine";
import {
  getConversationMessages,
  getOrCreateConciergeConversation,
} from "@/lib/concierge/store";

const sendSchema = z.object({
  message: z.string().min(1).max(2000),
});

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const conversation = await getOrCreateConciergeConversation(profile.id);
  const messages = await getConversationMessages(conversation.id, 100);
  return NextResponse.json({
    conversationId: conversation.id,
    messages: messages.map((m) => ({
      id: m.id,
      sender_type: m.sender_type,
      body: m.body,
      channel: m.channel,
      created_at: m.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const { replies } = await handleConciergeMessage({
    profile,
    text: parsed.data.message,
    channel: "app",
  });

  return NextResponse.json({
    replies: replies.map((m) => ({
      id: m.id,
      sender_type: m.sender_type,
      body: m.body,
      created_at: m.created_at,
    })),
  });
}
