import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { simulateCounterpartResponse } from "@/lib/matching/simulator";

// SIMULATION endpoint — drives a synthetic counterpart's response so the
// double opt-in flow can be demoed/tested without a second real user. The
// simulator itself refuses to act on real profiles.

const bodySchema = z.object({
  decision: z.enum(["accept", "decline"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await simulateCounterpartResponse({
    matchId: id,
    decision: parsed.data.decision,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
