import "server-only";
// ──────────────────────────────────────────────────────────────────────────
// SIMULATION ONLY — synthetic counterpart responses for demos and testing.
//
// This module exists solely so the double opt-in flow can be exercised
// end-to-end without a second real user. It only ever acts on profiles with
// is_synthetic = true, and only when they owe a response. Nothing in the
// production matching path (index.ts) calls into this module.
// ──────────────────────────────────────────────────────────────────────────
import { createAdminClient } from "@/lib/supabase/admin";
import type { Match, Profile } from "@/lib/types";
import { respondToMatch, type RespondResult } from "./index";

// Resolve a match as the synthetic counterpart. Returns an error for real
// counterparts or matches that aren't awaiting their response.
export async function simulateCounterpartResponse(args: {
  matchId: string;
  decision: "accept" | "decline";
}): Promise<RespondResult> {
  const supabase = createAdminClient();
  const { data: m } = await supabase
    .from("matches")
    .select("*")
    .eq("id", args.matchId)
    .maybeSingle();
  if (!m) return { ok: false, message: "Match not found." };
  const match = m as Match;

  if (match.status !== "awaiting_counterpart") {
    return {
      ok: false,
      message: `Nothing to simulate — this match is '${match.status}'.`,
    };
  }

  const { data: counterpart } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", match.counterpart_id)
    .single();
  if (!counterpart) return { ok: false, message: "Counterpart not found." };
  const cp = counterpart as Profile;
  if (!cp.is_synthetic) {
    return {
      ok: false,
      message:
        "Simulation only works for synthetic alumni — real users respond for themselves.",
    };
  }

  return respondToMatch({
    matchId: args.matchId,
    actor: cp,
    accept: args.decision === "accept",
  });
}
