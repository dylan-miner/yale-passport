"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Consent-gated location prompt mounted once in the app layout.
// - If detection is consented: tries browser geolocation, falls back to the
//   Vercel IP-city header (detect route), and prompts when the resolved city
//   differs from the user's context — or when they're back home with an
//   open trip.
// - Voluntary reporting does NOT depend on detection consent; manual entry
//   lives on the Discover page (and works for everyone).
// - Dismissals are remembered per-city for 7 days — we never re-nag.

type Trip = { city: string; since: string; endsOn: string | null } | null;

type Prompt =
  | { mode: "away"; city: string; source: "browser" | "ip" }
  | { mode: "returned"; homeCity: string; tripCity: string; source: "browser" | "ip" }
  | { mode: "thanks"; text: string };

const DISMISS_KEY = "passport.locPrompt.dismissed";

function dismissedRecently(city: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const { city: c, at } = JSON.parse(raw) as { city: string; at: number };
    return (
      c.toLowerCase() === city.toLowerCase() &&
      Date.now() - at < 7 * 24 * 60 * 60 * 1000
    );
  } catch {
    return false;
  }
}

function rememberDismiss(city: string) {
  try {
    localStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ city, at: Date.now() }),
    );
  } catch {
    /* private mode — fine */
  }
}

export function LocationPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const statusRes = await fetch("/api/location/status").catch(() => null);
      if (!statusRes?.ok) return;
      const status = (await statusRes.json()) as {
        detectionConsent: boolean;
        activeTrip: Trip;
      };
      if (!status.detectionConsent) return;

      const detect = async (coords?: { lat: number; lng: number }) => {
        const r = await fetch("/api/location/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coords ?? {}),
        }).catch(() => null);
        return r?.ok
          ? ((await r.json()) as {
              detectedCity: string | null;
              source: "browser" | "ip";
              residenceCity: string;
              activeTrip: Trip;
              actionable: boolean;
              returnedHome: boolean;
            })
          : null;
      };

      let d = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>(
            (resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 8000,
                maximumAge: 5 * 60 * 1000,
              }),
          );
          d = await detect({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        } catch {
          // Denied/unavailable → IP header fallback (works on Vercel only).
          d = await detect();
        }
      } else {
        d = await detect();
      }
      if (cancelled || !d) return;

      if (d.returnedHome && d.activeTrip) {
        setPrompt({
          mode: "returned",
          homeCity: d.residenceCity,
          tripCity: d.activeTrip.city,
          source: d.source,
        });
      } else if (
        d.actionable &&
        d.detectedCity &&
        !dismissedRecently(d.detectedCity)
      ) {
        setPrompt({ mode: "away", city: d.detectedCity, source: d.source });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm(args: {
    city: string;
    kind: "travel" | "relocation";
    source: "browser" | "ip" | "manual";
    endsOn?: string;
    backHome?: boolean;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/location/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: args.city,
          kind: args.kind,
          source: args.source,
          ends_on: args.endsOn || null,
        }),
      });
      if (!res.ok) {
        setPrompt(null);
        return;
      }
      setPrompt({
        mode: "thanks",
        text:
          args.kind === "relocation"
            ? `Done — ${args.city} is home now. I'll send recommendations your way.`
            : args.backHome
              ? `Welcome home — you're back on ${args.city}.`
              : `Got it — I'll find who's worth meeting in ${args.city}.`,
      });
      router.refresh();
      setTimeout(() => setPrompt(null), 3500);
    } finally {
      setBusy(false);
    }
  }

  if (!prompt) return null;

  if (prompt.mode === "thanks") {
    return (
      <div className="mb-5 rounded-2xl border border-affirm/30 bg-affirm-soft px-5 py-3.5 text-sm text-affirm">
        {prompt.text}
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-yale/25 bg-white p-5 shadow-sm">
      {prompt.mode === "away" ? (
        <>
          <p className="text-sm font-medium text-ink">
            Looks like you&rsquo;re in{" "}
            <span className="font-display font-semibold">{prompt.city}</span>.
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            I can line up who&rsquo;s worth meeting, events, and communities
            while you&rsquo;re there — or update your home base if you moved.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              disabled={busy}
              onClick={() =>
                void confirm({
                  city: prompt.city,
                  kind: "travel",
                  source: prompt.source,
                  endsOn,
                })
              }
              className="rounded-full bg-yale px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-yale-deep disabled:opacity-40"
            >
              Just visiting
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void confirm({
                  city: prompt.city,
                  kind: "relocation",
                  source: prompt.source,
                })
              }
              className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-ink transition hover:border-yale/50 disabled:opacity-40"
            >
              I moved here
            </button>
            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
              until
              <input
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
                className="rounded-lg border border-line bg-paper px-2 py-1 text-xs text-ink"
              />
            </label>
            <button
              onClick={() => {
                rememberDismiss(prompt.city);
                setPrompt(null);
              }}
              className="ml-auto text-xs text-ink-soft hover:text-ink"
            >
              Not now
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-ink">
            Welcome back to{" "}
            <span className="font-display font-semibold">
              {prompt.homeCity}
            </span>{" "}
            — done with {prompt.tripCity}?
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              disabled={busy}
              onClick={() =>
                void confirm({
                  city: prompt.homeCity,
                  kind: "travel",
                  source: prompt.source,
                  backHome: true,
                })
              }
              className="rounded-full bg-yale px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-yale-deep disabled:opacity-40"
            >
              I&rsquo;m back home
            </button>
            <button
              onClick={() => setPrompt(null)}
              className="text-xs text-ink-soft hover:text-ink"
            >
              Still in {prompt.tripCity}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
