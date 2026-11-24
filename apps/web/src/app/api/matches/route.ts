import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatchesForProfile, requestIntro } from "@/lib/matching";

const postSchema = z.object({
  alumni_id: z.string().uuid(),
});

export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matches = await getMatchesForProfile(profile.id);

  // Contact release goes through get_match_contact with the USER's own client —
  // the DB itself enforces mutual status + participation via auth.uid().
  const supabase = await createClient();
  const withContact = await Promise.all(
    matches.map(async (m) => {
      if (m.status !== "mutual") return { ...m, contact: null };
      const { data } = await supabase.rpc("get_match_contact", {
        p_match_id: m.id,
      });
      return { ...m, contact: (data?.[0] ?? null) as MatchContact | null };
    }),
  );

  return NextResponse.json({
    profile_id: profile.id,
    matches: withContact,
  });
}

type MatchContact = {
  full_name: string;
  personal_email: string | null;
  phone_e164: string | null;
  linkedin_url: string | null;
};

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await requestIntro({
    initiator: profile,
    alumniId: parsed.data.alumni_id,
    channel: "app",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
