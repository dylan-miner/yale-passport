import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { confirmLocation, getTravelContext } from "@/lib/location/lifecycle";
import { sendLocationNotice } from "@/lib/location/proactive";
import { logEngagement } from "@/lib/concierge/store";
import type { Profile } from "@/lib/types";

// Voluntary location reporting — does NOT require location_detection consent
// (that consent only gates automatic detection in /api/location/detect).
// Idempotent: equivalent reports collapse; notification failure leaves the
// confirmed signal intact.

const bodySchema = z.object({
  city: z.string().min(2).max(80),
  kind: z.enum(["travel", "relocation"]),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  // Where the report came from — we never accept or persist coordinates.
  source: z.enum(["manual", "browser", "ip"]).default("manual"),
});

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { city, kind, starts_on, ends_on, source } = parsed.data;

  const { signal, deduped } = await confirmLocation({
    profile,
    city,
    kind,
    source,
    startsOn: starts_on ?? null,
    endsOn: ends_on ?? null,
  });

  await logEngagement(
    kind === "relocation" ? "relocation_confirmed" : "travel_confirmed",
    profile.id,
    { city, deduped, source },
  );

  // Notify on new signals and on "return home" closures alike — deduped
  // repeats skip the composer entirely.
  const returnedHome =
    kind === "travel" && norm(city) === norm(profile.current_city);
  let notice: { sent: boolean; reason?: string } = {
    sent: false,
    reason: "deduped",
  };
  if (!deduped) {
    try {
      if (returnedHome) {
        // Back at the residence city: trips closed by confirmLocation above.
        // A short welcome-home note, same dedupe+delivery protections.
        notice = await sendLocationNotice({
          profile,
          signal: { ...signal, kind: "travel" },
          returnedHome: true,
        });
      } else {
        notice = await sendLocationNotice({ profile, signal });
      }
    } catch (err) {
      console.error("location notice error:", err);
      notice = { sent: false, reason: "error" };
    }
  }

  // Fresh context for the client (relocation may have changed residence).
  const refreshed = kind === "relocation" ? { ...profile, current_city: city } : profile;
  const ctx = await getTravelContext(refreshed as Profile);

  return NextResponse.json({
    ok: true,
    deduped,
    signal: { id: signal.id, city: signal.city, kind: signal.kind },
    notice,
    activeTrip: ctx.activeTrip,
    currentCity: refreshed.current_city,
  });
}
