"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

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

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Markdown-lite: **bold**, *italic*, and "- " bullets — enough for the
// concierge's actual output without shipping a full markdown parser.
function renderBody(text: string): ReactNode {
  return (
    <>
      {text.split("\n").map((line, li) => {
        const trimmed = line.trimStart();
        const bullet = /^[-•]\s+/.test(trimmed);
        const content = bullet ? trimmed.replace(/^[-•]\s+/, "") : line;
        const parts = content
          .split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g)
          .map((seg, i) => {
            if (
              seg.startsWith("**") &&
              seg.endsWith("**") &&
              seg.length > 4
            ) {
              return (
                <strong key={i} className="font-semibold">
                  {seg.slice(2, -2)}
                </strong>
              );
            }
            if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
              return <em key={i}>{seg.slice(1, -1)}</em>;
            }
            return <span key={i}>{seg}</span>;
          });
        if (bullet) {
          return (
            <span key={li} className="flex gap-2">
              <span className="shrink-0 text-ink-soft">•</span>
              <span>{parts}</span>
            </span>
          );
        }
        if (content === "") return <span key={li} className="block h-2" />;
        return (
          <span key={li} className="block">
            {parts}
          </span>
        );
      })}
    </>
  );
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
      <div className="rounded-2xl rounded-bl-md border border-line-soft bg-white px-4 py-3">
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

type Row =
  | { kind: "sep"; key: string; label: string }
  | { kind: "group"; key: string; sender: "user" | "concierge"; items: ChatMessage[] };

// Date separators + sender grouping (consecutive same-sender messages
// within a few minutes share one bubble stack).
function buildRows(messages: ChatMessage[]): Row[] {
  const rows: Row[] = [];
  let lastDay = "";
  let group: ChatMessage[] = [];
  let groupSender: ChatMessage["sender"] | null = null;
  let groupAt = 0;

  const flush = () => {
    if (!group.length || !groupSender) return;
    rows.push({
      kind: "group",
      key: group[0].id,
      sender: groupSender,
      items: group,
    });
    group = [];
    groupSender = null;
  };

  for (const m of messages) {
    const day = new Date(m.at).toDateString();
    const t = new Date(m.at).getTime();
    if (day !== lastDay) {
      flush();
      rows.push({ kind: "sep", key: `sep-${day}`, label: dayLabel(m.at) });
      lastDay = day;
    }
    const sameStreak = m.sender === groupSender && t - groupAt < 5 * 60 * 1000;
    if (!sameStreak) flush();
    group.push(m);
    groupSender = m.sender;
    groupAt = t;
  }
  flush();
  return rows;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => buildRows(messages), [messages]);

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
    <div className="flex h-[calc(100dvh-12rem)] flex-col overflow-hidden rounded-2xl border border-line-soft bg-white shadow-[0_1px_2px_rgba(21,34,56,0.05)] md:h-[calc(100dvh-8.5rem)]">
      {/* Slim navy chat header — the concierge is a presence, not a page */}
      <header className="flex items-center gap-3 bg-yale px-4 py-3 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 font-display text-sm font-semibold">
          P
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold leading-tight">
            Passport Concierge
          </p>
          <p className="text-xs text-white/70">
            Texting with {firstName} — intros, events, and moves
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/80">
          {city}
        </span>
      </header>

      {/* Thread */}
      <div
        ref={scrollRef}
        className="flex min-h-[40dvh] flex-1 flex-col gap-1 overflow-y-auto bg-paper px-4 py-4 md:min-h-0"
      >
        {messages.length === 0 && !pending && (
          <div className="m-auto max-w-sm text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-yale/10 font-display text-base font-semibold text-yale">
              P
            </div>
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

        {rows.map((row) =>
          row.kind === "sep" ? (
            <div key={row.key} className="my-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-line-soft" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                {row.label}
              </span>
              <div className="h-px flex-1 bg-line-soft" />
            </div>
          ) : row.sender === "user" ? (
            <div key={row.key} className="flex flex-col items-end gap-1">
              {row.items.map((m, i) => (
                <div key={m.id} className="max-w-[80%] md:max-w-[70%]">
                  <div className="whitespace-pre-wrap rounded-2xl rounded-br-md bg-yale px-4 py-2.5 text-sm leading-relaxed text-white">
                    {renderBody(m.body)}
                  </div>
                  {i === row.items.length - 1 && (
                    <p className="mb-1.5 mt-1 text-right text-[11px] text-ink-soft">
                      {formatTime(m.at)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div key={row.key} className="flex items-end gap-2">
              <ConciergeAvatar />
              <div className="flex max-w-[80%] flex-col gap-1 md:max-w-[70%]">
                {row.items.map((m, i) => (
                  <div key={m.id}>
                    <div className="rounded-2xl rounded-bl-md border border-line-soft bg-white px-4 py-2.5 text-sm leading-relaxed text-ink">
                      {renderBody(m.body)}
                    </div>
                    {i === row.items.length - 1 && (
                      <p className="mb-1.5 mt-1 text-[11px] text-ink-soft">
                        {formatTime(m.at)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
        {pending && <TypingBubble />}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="flex items-center justify-between border-t border-line-soft bg-red-50 px-4 py-2 text-sm text-red-800">
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

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t border-line-soft bg-white p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:pb-2.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Text Passport…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-full bg-paper px-4 py-2.5 text-sm outline-none placeholder:text-ink-soft focus:ring-2 focus:ring-yale/20"
          aria-label="Message the concierge"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yale text-white transition hover:bg-yale-deep disabled:opacity-40"
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
