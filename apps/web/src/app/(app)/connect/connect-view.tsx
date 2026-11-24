"use client";

import { useState } from "react";
import type { MatchSummary } from "@/lib/matching";

type Match = MatchSummary;

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatusChip({ status }: { status: Match["status"] }) {
  const styles: Record<Match["status"], string> = {
    proposed: "bg-amber-100 text-amber-800",
    awaiting_counterpart: "bg-amber-100 text-amber-800",
    mutual: "bg-emerald-100 text-emerald-800",
    declined: "bg-ink/5 text-ink-soft",
    expired: "bg-ink/5 text-ink-soft",
  };
  const labels: Record<Match["status"], string> = {
    proposed: "Suggested",
    awaiting_counterpart: "Waiting",
    mutual: "Connected",
    declined: "Declined",
    expired: "Expired",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function PersonRow({ m }: { m: Match }) {
  const c = m.counterpart;
  const work =
    [c.role_title, c.company].filter(Boolean).join(" at ") || c.industry;
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yale/10 font-display text-sm font-semibold text-yale">
        {initials(c.full_name)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-ink">
            {c.full_name}{" "}
            <span className="text-ink-soft">
              &lsquo;{String(c.grad_year).slice(-2)}
            </span>
          </p>
          {c.is_synthetic && (
            <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              demo alum
            </span>
          )}
        </div>
        {work && <p className="truncate text-sm text-ink">{work}</p>}
        <p className="text-xs text-ink-soft">{c.current_city}</p>
      </div>
    </div>
  );
}

export function ConnectView({
  initialMatches,
  profileId,
}: {
  initialMatches: Match[];
  profileId: string;
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/matches");
    if (res.ok) {
      const data = (await res.json()) as { matches: Match[] };
      setMatches(data.matches);
    }
  }

  async function call(url: string, body: Record<string, string>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) setError(data.message ?? "Something went wrong.");
      await refresh();
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setBusy(null);
    }
  }

  const respond = (id: string, action: "accept" | "decline") =>
    call(`/api/matches/${id}/respond`, { action }, `respond-${id}`);
  const simulate = (id: string, decision: "accept" | "decline") =>
    call(`/api/matches/${id}/simulate`, { decision }, `sim-${id}`);

  const incoming = matches.filter(
    (m) =>
      (m.status === "awaiting_counterpart" &&
        m.counterpart_id === profileId) ||
      (m.status === "proposed" && m.initiator_id === profileId),
  );
  const outgoing = matches.filter(
    (m) =>
      m.status === "awaiting_counterpart" && m.initiator_id === profileId,
  );
  const mutual = matches.filter((m) => m.status === "mutual");
  const closed = matches.filter((m) =>
    ["declined", "expired"].includes(m.status),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Connect
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">
          Introductions
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Double opt-in — contact details unlock only when both of you say yes.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {matches.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line bg-white/60 p-8 text-center">
          <p className="font-display text-lg italic text-ink">
            No introductions yet.
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Ask your concierge — “find me someone in Boston in climate tech” —
            and requests will show up here.
          </p>
        </div>
      )}

      {incoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Wants to meet you
          </h2>
          {incoming.map((m) => (
            <div
              key={m.id}
              className="rounded-3xl border border-line bg-white p-5"
            >
              <PersonRow m={m} />
              {m.match_reason && (
                <p className="mt-3 text-sm text-ink-soft">{m.match_reason}</p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => void respond(m.id, "accept")}
                  disabled={busy !== null}
                  className="rounded-full bg-yale px-5 py-2 text-sm font-medium text-white transition disabled:opacity-40"
                >
                  {busy === `respond-${m.id}` ? "…" : "Accept intro"}
                </button>
                <button
                  onClick={() => void respond(m.id, "decline")}
                  disabled={busy !== null}
                  className="rounded-full border border-line px-5 py-2 text-sm text-ink transition hover:border-ink-soft disabled:opacity-40"
                >
                  Pass
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Waiting on them
          </h2>
          {outgoing.map((m) => (
            <div
              key={m.id}
              className="rounded-3xl border border-line bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <PersonRow m={m} />
                <StatusChip status={m.status} />
              </div>
              {m.match_reason && (
                <p className="mt-3 text-sm text-ink-soft">{m.match_reason}</p>
              )}
              {m.counterpart.is_synthetic && (
                <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                    Simulation — synthetic alum, no real person responds
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => void simulate(m.id, "accept")}
                      disabled={busy !== null}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    >
                      Simulate: they accept
                    </button>
                    <button
                      onClick={() => void simulate(m.id, "decline")}
                      disabled={busy !== null}
                      className="rounded-full border border-amber-300 px-4 py-1.5 text-xs text-amber-900 disabled:opacity-40"
                    >
                      Simulate: they pass
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {mutual.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Connected
          </h2>
          {mutual.map((m) => (
            <div
              key={m.id}
              className="rounded-3xl border border-emerald-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <PersonRow m={m} />
                <StatusChip status={m.status} />
              </div>
              {m.intro_draft && (
                <div className="mt-4 rounded-2xl rounded-bl-md border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
                  {m.intro_draft}
                </div>
              )}
              {m.contact ? (
                <div className="mt-4 grid gap-1.5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                    Shared with mutual consent
                  </p>
                  {m.contact.personal_email && (
                    <a
                      href={`mailto:${m.contact.personal_email}`}
                      className="text-ink underline decoration-emerald-300 underline-offset-2"
                    >
                      {m.contact.personal_email}
                    </a>
                  )}
                  {m.contact.phone_e164 && (
                    <a
                      href={`sms:${m.contact.phone_e164}`}
                      className="text-ink underline decoration-emerald-300 underline-offset-2"
                    >
                      {m.contact.phone_e164}
                    </a>
                  )}
                  {m.contact.linkedin_url && (
                    <a
                      href={m.contact.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink underline decoration-emerald-300 underline-offset-2"
                    >
                      LinkedIn →
                    </a>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-soft">
                  Contact details unavailable.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {closed.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Earlier
          </h2>
          {closed.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-2xl border border-line bg-white/60 px-4 py-3 opacity-70"
            >
              <p className="text-sm text-ink">
                {m.counterpart.full_name}
                <span className="text-ink-soft">
                  {" "}
                  · {m.status === "declined" ? "passed" : "expired"}
                </span>
              </p>
              <StatusChip status={m.status} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
