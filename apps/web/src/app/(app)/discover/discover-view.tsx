"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  CityResource,
  DirectoryProfile,
  Event,
  MatchStatus,
} from "@/lib/types";

export type DiscoverData = {
  me: { id: string; city: string };
  alumni: DirectoryProfile[];
  events: Event[];
  resources: CityResource[];
  matchStatus: Record<string, MatchStatus>;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString([], { weekday: "short" }),
    date: d.toLocaleDateString([], { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

const RESOURCE_LABEL: Record<CityResource["type"], string> = {
  club: "Club",
  group_chat: "Group chat",
  contact: "Contact",
  link: "Link",
};

export function DiscoverView({ data }: { data: DiscoverData }) {
  const [city, setCity] = useState(data.me.city);
  const [matchStatus, setMatchStatus] = useState(data.matchStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const cities = useMemo(() => {
    const all = new Set<string>([
      data.me.city,
      ...data.alumni.map((a) => a.current_city),
      ...data.events.map((e) => e.city),
    ]);
    return [...all].sort((a, b) =>
      a === data.me.city ? -1 : b === data.me.city ? 1 : a.localeCompare(b),
    );
  }, [data]);

  const alumniInCity = data.alumni.filter((a) => a.current_city === city);
  const eventsInCity = data.events.filter((e) => e.city === city);
  const resourcesInCity = data.resources.filter((r) => r.city === city);
  const isHome = city === data.me.city;

  async function requestIntro(alumniId: string, name: string) {
    setBusy(alumniId);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId }),
      });
      const body = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(body.message ?? "Couldn't send that request.");
      } else {
        setMatchStatus((prev) => ({
          ...prev,
          [alumniId]: "awaiting_counterpart",
        }));
        setNotice(`Intro request sent to ${name.split(" ")[0]} — find it on the Connect tab.`);
      }
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setBusy(null);
    }
  }

  function IntroButton({ a }: { a: DirectoryProfile }) {
    const status = matchStatus[a.id];
    if (status === "mutual") {
      return (
        <Link
          href="/connect"
          className="rounded-full bg-affirm/15 px-4 py-1.5 text-xs font-semibold text-affirm"
        >
          Connected →
        </Link>
      );
    }
    if (status === "awaiting_counterpart" || status === "proposed") {
      return (
        <span className="rounded-full bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-800">
          Requested
        </span>
      );
    }
    return (
      <button
        onClick={() => void requestIntro(a.id, a.full_name)}
        disabled={busy !== null}
        className="rounded-full bg-yale px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-yale-deep disabled:opacity-40"
      >
        {busy === a.id ? "…" : "Request intro"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Discover
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">
          {isHome ? `${city} is yours` : `Visiting ${city}?`}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {isHome
            ? "Alumni, events, and communities where you live."
            : "Who and what's there when you travel — your home base stays put."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {cities.map((c) => (
          <button
            key={c}
            onClick={() => setCity(c)}
            className={
              c === city
                ? "rounded-full bg-yale px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-line bg-white px-4 py-1.5 text-sm text-ink transition hover:border-yale/50"
            }
          >
            {c}
            {c === data.me.city && c !== city ? " ·" : ""}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-affirm/30 bg-affirm-soft px-4 py-2 text-sm text-affirm">
          {notice}
        </div>
      )}

      {/* Alumni */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Alumni in {city}
          </h2>
          <Link href="/concierge" className="text-xs text-yale hover:underline">
            Ask the concierge instead →
          </Link>
        </div>
        {alumniInCity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-6 text-sm text-ink-soft">
            No alumni opted into the directory here yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {alumniInCity.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border border-line bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yale/10 font-display text-sm font-semibold text-yale">
                      {initials(a.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {a.full_name}{" "}
                        <span className="text-ink-soft">
                          &lsquo;{String(a.grad_year).slice(-2)}
                        </span>
                      </p>
                      <p className="truncate text-xs text-ink">
                        {[a.role_title, a.company]
                          .filter(Boolean)
                          .join(" at ") || a.industry}
                      </p>
                    </div>
                  </div>
                  <IntroButton a={a} />
                </div>
                {a.interests.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.interests.slice(0, 4).map((i) => (
                      <span
                        key={i}
                        className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] text-ink-soft"
                      >
                        {i}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Events */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Events in {city}
        </h2>
        {eventsInCity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-6 text-sm text-ink-soft">
            Nothing scheduled right now.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {eventsInCity.map((e) => {
              const d = fmtDate(e.starts_at);
              return (
                <div
                  key={e.id}
                  className="flex gap-4 rounded-2xl border border-line bg-white p-4"
                >
                  <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-yale/10 py-2">
                    <span className="text-[10px] font-semibold uppercase text-yale">
                      {d.day}
                    </span>
                    <span className="font-display text-base font-semibold text-yale">
                      {d.date}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{e.title}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {d.time} · {[e.venue, e.neighborhood].filter(Boolean).join(", ")}
                    </p>
                    {e.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-ink-soft">
                        {e.description}
                      </p>
                    )}
                    {e.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {e.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-paper px-2 py-0.5 text-[10px] text-ink-soft"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Resources */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Communities in {city}
        </h2>
        {resourcesInCity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-6 text-sm text-ink-soft">
            No clubs or group chats listed yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {resourcesInCity.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{r.name}</p>
                  <p className="text-xs text-ink-soft">
                    {RESOURCE_LABEL[r.type]}
                  </p>
                  {r.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-ink-soft">
                      {r.description}
                    </p>
                  )}
                </div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-yale transition hover:border-yale/50"
                  >
                    Open →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
