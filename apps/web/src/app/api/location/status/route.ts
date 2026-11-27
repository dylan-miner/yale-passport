import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTravelContext } from "@/lib/location/lifecycle";

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: detectionConsent } = await supabase.rpc("has_consent", {
    p_profile_id: profile.id,
    p_key: "location_detection",
  });
  const ctx = await getTravelContext(profile);

  return NextResponse.json({
    detectionConsent: !!detectionConsent,
    currentCity: profile.current_city,
    homeCity: profile.home_city,
    activeTrip: ctx.activeTrip,
  });
}
