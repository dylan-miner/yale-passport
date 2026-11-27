import { Suspense } from "react";
import { requireUser, getMyProfile } from "@/lib/auth";
import {
  getConversationMessages,
  getOrCreateConciergeConversation,
} from "@/lib/concierge/store";
import { ConciergeChat, type ChatMessage } from "./chat";

async function ConciergeThread() {
  const { supabase, user } = await requireUser();
  const profile = await getMyProfile(supabase, user.id);
  if (!profile) return null; // AuthGate in the layout redirects

  const conversation = await getOrCreateConciergeConversation(profile.id);
  const rows = await getConversationMessages(conversation.id, 100);
  const messages: ChatMessage[] = rows.map((m) => ({
    id: String(m.id),
    sender: m.sender_type === "user" ? "user" : "concierge",
    body: m.body,
    at: m.created_at,
  }));

  return (
    <ConciergeChat
      initialMessages={messages}
      firstName={profile.full_name.split(" ")[0]}
      city={profile.current_city}
    />
  );
}

export default function ConciergePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-12rem)] flex-col overflow-hidden rounded-2xl border border-line-soft bg-white md:h-[calc(100dvh-8.5rem)]">
          <div className="flex items-center gap-3 bg-yale px-4 py-3">
            <div className="h-9 w-9 animate-pulse rounded-full bg-white/15" />
            <div className="h-4 w-40 animate-pulse rounded bg-white/15" />
          </div>
          <div className="flex-1 bg-paper p-6 text-sm text-ink-soft">
            Loading your conversation…
          </div>
        </div>
      }
    >
      <ConciergeThread />
    </Suspense>
  );
}
