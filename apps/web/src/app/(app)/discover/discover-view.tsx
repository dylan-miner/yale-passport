"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CityResource,
  DirectoryProfile,
  Event,
  MatchStatus,
} from "@/lib/types";
import { cityPhoto } from "@/lib/city-photos";
import { Avatar, Empty, Notice } from "@/components/ui";

export type DiscoverData = {
  me: { id: string; city: string };
  activeTrip: { city: string; since: string; endsOn: string | null } | null;
  alumni: DirectoryProfile[];
  events: Event[];
  resources: CityResource[];
  matchStatus: Record<string, MatchStatus>;
};

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
  const router = useRouter();
  // A confirmed trip steers Discover to the travel city; browsing other
  // cities via the pills never changes where "home" is.
  const [city, setCity] = useState(data.activeTrip?.city ?? data.me.city);
  const [matchStatus, setMatchStatus] = useState(data.matchStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCity, setReportCity] = useState("");
  const [reportKind, setReportKind] = useState<"travel" | "relocation">(
    "travel",
  );
  const [reportEndsOn, setReportEndsOn] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

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

  async function reportLocation(
    cityToReport: string,
    kind: "travel" | "relocation",
    endsOn?: string,
  ) {
    setReportBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/location/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: cityToReport,
          kind,
          source: "manual",
          ends_on: endsOn || null,
        }),
      });
      if (!res.ok) {
        setError("Couldn't save that — try again.");
      } else {
        setReportOpen(false);
        setNotice(
          kind === "relocation"
            ? `${cityToReport} is your new home base — check the concierge for recommendations.`
            : cityToReport === data.me.city
              ? `Welcome home — Discover is back on ${cityToReport}.`
              : `Trip noted — I'll send ${cityToReport} recommendations to your concierge thread.`,
        );
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setReportBusy(false);
    }
  }

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
      {/* City photo hero — the network has a sense of place */}
      <div className="relative h-40 overflow-hidden rounded-3xl md:h-48">
        <Image
          src={cityPhoto(city)}
          alt={`${city} skyline`}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 768px"
        />
        <div className="absolute inset-0 bg-yale-night/55" />
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
            Discover
          </p>
          <h1 className="mt-0.5 font-display text-3xl font-semibold text-white md:text-4xl">
            {isHome ? `${city} is yours` : `Visiting ${city}?`}
          </h1>
          <p className="mt-1 text-sm text-white/80">
            {alumniInCity.length} alumni · {eventsInCity.length} upcoming
            {resourcesInCity.length > 0 &&
              ` · ${resourcesInCity.length} communities`}
          </p>
        </div>
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

      {/* Travel context */}
      {data.activeTrip && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-yale/25 bg-white px-5 py-3.5">
          <p className="text-sm text-ink">
            You&rsquo;re in{" "}
            <span className="font-medium">{data.activeTrip.city}</span>
            {data.activeTrip.endsOn
              ? ` through ${new Date(`${data.activeTrip.endsOn}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}`
              : ""}{" "}
            — {data.me.city} stays your home base.
          </p>
          <button
            onClick={() =>
              void reportLocation(data.me.city, "travel")
            }
            disabled={reportBusy}
            className="rounded-full border border-line px-3.5 py-1 text-xs font-semibold text-yale transition hover:border-yale/50 disabled:opacity-40"
          >
            I&rsquo;m back home
          </button>
        </div>
      )}

      {/* Voluntary location report — available regardless of detection consent */}
      {!reportOpen ? (
        <button
          onClick={() => setReportOpen(true)}
          className="self-start text-xs text-ink-soft underline-offset-2 transition hover:text-yale hover:underline"
        >
          {data.activeTrip ? "Somewhere else?" : "Traveling or moved? Tell us"}
        </button>
      ) : (
        <div className="rounded-2xl border border-yale/25 bg-white p-5">
          <p className="text-sm font-medium text-ink">
            Where are you — and is it a visit or a move?
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={reportCity}
              onChange={(e) => setReportCity(e.target.value)}
              placeholder="City (e.g. Chicago)"
              list="discover-cities"
              className="w-44 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm text-ink"
            />
            <datalist id="discover-cities">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {(["travel", "relocation"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setReportKind(k)}
                className={
                  reportKind === k
                    ? "rounded-full bg-yale px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-line px-3.5 py-1.5 text-xs text-ink transition hover:border-yale/50"
                }
              >
                {k === "travel" ? "Just visiting" : "I moved"}
              </button>
            ))}
            {reportKind === "travel" && (
              <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                until
                <input
                  type="date"
                  value={reportEndsOn}
                  onChange={(e) => setReportEndsOn(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-2 py-1 text-xs text-ink"
                />
              </label>
            )}
            <button
              disabled={reportBusy || reportCity.trim().length < 2}
              onClick={() =>
                void reportLocation(
                  reportCity.trim(),
                  reportKind,
                  reportEndsOn,
                )
              }
              className="rounded-full bg-yale px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-yale-deep disabled:opacity-40"
            >
              {reportBusy ? "…" : "Save"}
            </button>
            <button
              onClick={() => setReportOpen(false)}
              className="text-xs text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

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
          <Empty
            title={`No alumni opted in here yet.`}
            body="The concierge can still point you to events and communities — or try another city."
            action={
              <Link
                href="/concierge"
                className="inline-block rounded-full bg-yale px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-yale-deep"
              >
                Ask the concierge
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {alumniInCity.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border border-line bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <Avatar name={a.full_name} />
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
          <Empty title="Nothing scheduled right now." />
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
          <Empty title="No clubs or group chats listed yet." />
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
