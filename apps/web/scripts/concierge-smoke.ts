// Concierge end-to-end smoke test — signs in as the demo user, drives real
// HTTP requests through /api/concierge (route → engine → OpenAI → Supabase),
// asserts DB side effects with the service role, then restores state.
//
// Non-destructive: picks a synthetic counterpart with no existing match to
// the demo user and deletes only what it creates.
//
// Usage: npm run concierge:smoke
// Requires the dev server running at APP_URL (default http://localhost:3000)
// and OpenAI credits.

process.loadEnvFile(".env.local");

import { APP_URL, adminClient, signInDemo, check, finish } from "./e2e-helpers";

const admin = adminClient();
let cookieHeader = "";

const runStart = new Date().toISOString();
async function toolRan(tool: string): Promise<boolean> {
  const { count } = await admin
    .from("engagement_events")
    .select("id", { count: "exact", head: true })
    .eq("type", "concierge_tool")
    .eq("meta->>tool", tool)
    .gte("created_at", runStart);
  return (count ?? 0) > 0;
}
async function say(text: string): Promise<string> {
  const res = await fetch(`${APP_URL}/api/concierge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({ message: text }),
  });
  if (!res.ok) throw new Error(`POST /api/concierge → ${res.status}`);
  const data = (await res.json()) as {
    replies: { body: string }[];
  };
  const reply = data.replies.map((r) => r.body).join("\n");
  console.log(`\n> ${text}\n${reply}`);
  return reply;
}

async function main() {
  ({ cookieHeader } = await signInDemo());

  const { data: sam } = await admin
    .from("profiles")
    .select("*")
    .eq("personal_email", "demo@passport.yale")
    .single();
  if (!sam) throw new Error("Demo profile not found — run npm run seed");
  const originalCity = sam.current_city as string;

  // Preflight: cheapest possible OpenAI call so an invalid/unfunded key fails
  // here with a clear message instead of 7 confusing check failures.
  const ping = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "ok" }],
      max_tokens: 1,
    }),
  });
  if (!ping.ok) {
    const body = await ping.text();
    console.error(`OpenAI preflight failed (${ping.status}): ${body}`);
    console.error("Fix OPENAI_API_KEY / billing, then re-run this script.");
    process.exit(2);
  }

  // Unauthenticated request is rejected
  const unauth = await fetch(`${APP_URL}/api/concierge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hi" }),
  });
  check("unauthenticated POST → 401", unauth.status === 401);

  // 1. Events tool
  let r = await say("What Yale events are coming up in Boston?");
  check("list_events tool ran", await toolRan("list_events"));

  // 2. Alumni search
  r = await say("Any Yale alumni in Boston working in startups or tech?");
  check("search_alumni tool ran", await toolRan("search_alumni"));

  // 3. Profile update requires confirmation
  r = await say("I just moved to Chicago for a new job.");
  const { data: during } = await admin
    .from("profiles")
    .select("current_city")
    .eq("id", sam.id)
    .single();
  check(
    "move is not applied before confirmation",
    during!.current_city === originalCity,
    `still ${during!.current_city}`,
  );

  r = await say("yes, please update it");
  const { data: after } = await admin
    .from("profiles")
    .select("current_city")
    .eq("id", sam.id)
    .single();
  check(
    "confirmed city update writes through",
    after!.current_city === "Chicago",
    `now ${after!.current_city}`,
  );

  const { data: signal } = await admin
    .from("location_signals")
    .select("city,kind,confirmed")
    .eq("profile_id", sam.id)
    .order("created_at", { ascending: false })
    .limit(1);
  check(
    "relocation signal logged",
    signal?.[0]?.city === "Chicago" && signal[0].kind === "relocation",
  );

  // Restore the demo city so the match test is deterministic; final cleanup
  // below also covers failures before this point.
  await admin
    .from("profiles")
    .update({ current_city: originalCity })
    .eq("id", sam.id);
  await admin
    .from("location_signals")
    .delete()
    .eq("profile_id", sam.id)
    .eq("city", "Chicago");

  // 4. Match proposal → awaiting_counterpart. Uses a synthetic counterpart
  // with no existing match to Sam so user's own data is never touched.
  const { data: samMatches } = await admin
    .from("matches")
    .select("initiator_id,counterpart_id")
    .or(`initiator_id.eq.${sam.id},counterpart_id.eq.${sam.id}`);
  const usedIds = new Set(
    (samMatches ?? []).flatMap((m) => [m.initiator_id, m.counterpart_id]),
  );
  const { data: candidates } = await admin
    .from("profiles")
    .select("id,full_name")
    .eq("is_synthetic", true)
    .neq("id", sam.id)
    .order("full_name");
  let cp: { id: string; full_name: string } | undefined;
  for (const c of candidates ?? []) {
    if (usedIds.has(c.id)) continue;
    const { data: ok } = await admin.rpc("has_consent", {
      p_profile_id: c.id,
      p_key: "introductions",
    });
    if (ok) {
      cp = c;
      break;
    }
  }
  if (!cp) throw new Error("No unmatched synthetic alum available for smoke");
  console.log(`\nMatch counterpart: ${cp.full_name}`);

  r = await say(`Can you introduce me to ${cp.full_name}?`);
  const { data: match } = await admin
    .from("matches")
    .select("id,status")
    .eq("initiator_id", sam.id)
    .eq("counterpart_id", cp.id)
    .gte("created_at", runStart)
    .limit(1);
  const createdMatchId = match?.[0]?.id;
  check(
    "intro request creates awaiting_counterpart match",
    match?.[0]?.status === "awaiting_counterpart",
    match?.[0]?.status,
  );

  // 5. Duplicate match is refused
  r = await say(`Introduce me to ${cp.full_name} please`);
  const { data: dupes } = await admin
    .from("matches")
    .select("id")
    .eq("initiator_id", sam.id)
    .eq("counterpart_id", cp.id);
  check("duplicate match refused", dupes!.length === 1);

  // 6. Contact info is never handed out
  r = await say(`What's ${cp.full_name.split(" ")[0]}'s phone number?`);
  check("contact info withheld", !/\d{3}[-.\s]\d{3}[-.\s]\d{4}|\d{10,}/.test(r));

  // 7. GET returns persisted history
  const getRes = await fetch(`${APP_URL}/api/concierge`, {
    headers: { Cookie: cookieHeader },
  });
  const thread = (await getRes.json()) as { messages: { body: string }[] };
  check(
    "history persisted via GET",
    getRes.ok && thread.messages.length >= 10,
    `${thread.messages?.length} messages`,
  );

  // --- restore state: remove only what this run created ---
  if (createdMatchId) {
    await admin.from("matches").delete().eq("id", createdMatchId);
  }
  await admin
    .from("profiles")
    .update({ current_city: originalCity })
    .eq("id", sam.id);
  await admin
    .from("location_signals")
    .delete()
    .eq("profile_id", sam.id)
    .eq("city", "Chicago");
  console.log("\nRestored demo state (city, signals, test match).");

  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
