import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { respondToMatch } from "@/lib/matching";

const bodySchema = z.object({
  action: z.enum(["accept", "decline"]),
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

  const result = await respondToMatch({
    matchId: id,
    actor: profile,
    accept: parsed.data.action === "accept",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
