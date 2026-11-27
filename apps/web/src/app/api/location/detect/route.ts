import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTravelContext } from "@/lib/location/lifecycle";
import { nearestMetro } from "@/lib/location/metros";

// Automatic detection only — consent-gated, and writes NOTHING. It resolves
// coordinates (or the Vercel IP-city header) to a metro name and tells the
// client whether a confirmation prompt is warranted. Raw coordinates/IP are
// never persisted.

const bodySchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: consented } = await supabase.rpc("has_consent", {
    p_profile_id: profile.id,
    p_key: "location_detection",
  });
  if (!consented) {
    return NextResponse.json(
      { error: "Location detection not consented", actionable: false },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let city: string | null = null;
  let source: "browser" | "ip" | null = null;
  if (parsed.data.lat !== undefined && parsed.data.lng !== undefined) {
    city = nearestMetro(parsed.data.lat, parsed.data.lng);
    if (city) source = "browser";
  }
  if (!city) {
    // Vercel sets x-vercel-ip-city (URL-encoded) on the edge; absent locally.
    const headerCity = request.headers.get("x-vercel-ip-city");
    if (headerCity) {
      try {
        city = decodeURIComponent(headerCity);
      } catch {
        city = headerCity;
      }
      source = "ip";
    }
  }
  if (!city || !source) {
    return NextResponse.json({ actionable: false, detectedCity: null });
  }

  const ctx = await getTravelContext(profile);
  const sameAsResidence = norm(city) === norm(ctx.residenceCity);
  const sameAsTrip = norm(city) === norm(ctx.activeTrip?.city);

  // Dedupe only against OPEN confirmed signals — a closed/superseded signal
  // for this city is history, and being detected here again is new context.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("location_signals")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("confirmed", true)
    .is("closed_at", null)
    .ilike("city", city)
    .gte("created_at", since)
    .limit(1);

  return NextResponse.json({
    detectedCity: city,
    source,
    residenceCity: ctx.residenceCity,
    activeTrip: ctx.activeTrip,
    actionable: !sameAsResidence && !sameAsTrip && !recent?.length,
    returnedHome: sameAsResidence && !!ctx.activeTrip,
  });
}
