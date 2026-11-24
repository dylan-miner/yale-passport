"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export type ChatMessage = {
  id: string;
  sender: "user" | "concierge";
  body: string;
  at: string;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ConciergeAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yale font-display text-xs font-semibold text-white">
      P
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <ConciergeAvatar />
      <div className="rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

export function ConciergeChat({
  initialMessages,
  firstName,
  city,
}: {
  initialMessages: ChatMessage[];
  firstName: string;
  city: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function send(text: string) {
    const body = text.trim();
    if (!body || pending) return;

    setError(null);
    setInput("");
    setPending(true);
    const optimistic: ChatMessage = {
      id: `local-${crypto.randomUUID()}`,
      sender: "user",
      body,
      at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        replies: { id: string; sender_type: string; body: string; created_at: string }[];
      };
      setMessages((prev) => [
        ...prev,
        ...data.replies.map((r) => ({
          id: r.id,
          sender: "concierge" as const,
          body: r.body,
          at: r.created_at,
        })),
      ]);
    } catch {
      setError("Couldn't reach the concierge. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const suggestions =
    messages.length === 0
      ? [
          `Find Yale alumni in ${city}`,
          "What events are coming up?",
          "What's on my profile?",
        ]
      : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Concierge
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Yale Passport</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Texts with {firstName} · same thread you&apos;ll get over SMS
        </p>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-3 pb-4">
        {messages.length === 0 && !pending && (
          <div className="rounded-3xl border border-dashed border-line bg-white/60 p-6 text-center">
            <p className="font-display text-lg italic text-ink">
              Say hi — or try one of these.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink transition hover:border-yale hover:text-yale"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.sender === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] md:max-w-[70%]">
                <div className="rounded-2xl rounded-br-md bg-yale px-4 py-2.5 text-sm leading-relaxed text-white">
                  {m.body}
                </div>
                <p className="mt-1 text-right text-[11px] text-ink-soft">
                  {formatTime(m.at)}
                </p>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-end gap-2">
              <ConciergeAvatar />
              <div className="max-w-[80%] md:max-w-[70%]">
                <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md border border-line bg-white px-4 py-2.5 text-sm leading-relaxed text-ink">
                  {m.body}
                </div>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {formatTime(m.at)}
                </p>
              </div>
            </div>
          ),
        )}
        {pending && <TypingBubble />}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="sticky bottom-16 flex items-center gap-2 rounded-full border border-line bg-white p-1.5 shadow-sm md:bottom-6"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Text Passport…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-full bg-transparent px-3.5 py-2 text-sm outline-none placeholder:text-ink-soft"
          aria-label="Message the concierge"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yale text-white transition disabled:opacity-40"
          aria-label="Send message"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 -translate-x-px translate-y-px rotate-45"
          >
            <path d="M10.894 2.553a1 1 0 0 0-1.788 0l-7 14a1 1 0 0 0 1.169 1.409l5-1.429A1 1 0 0 0 9 15.571V11a1 1 0 1 1 2 0v4.571a1 1 0 0 0 .725.962l5 1.428a1 1 0 0 0 1.17-1.408l-7-14Z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
