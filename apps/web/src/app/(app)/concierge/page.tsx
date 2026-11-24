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
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Concierge
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold">
              Yale Passport
            </h1>
          </div>
          <div className="animate-pulse rounded-3xl border border-line bg-white p-8 text-sm text-ink-soft">
            Loading your conversation…
          </div>
        </div>
      }
    >
      <ConciergeThread />
    </Suspense>
  );
}
