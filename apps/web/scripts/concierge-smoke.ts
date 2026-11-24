// Concierge end-to-end smoke test — signs in as the demo user, drives real
// HTTP requests through /api/concierge (route → engine → OpenAI → Supabase),
// asserts DB side effects with the service role, then restores seed state.
//
// Usage: npm run concierge:smoke
// Requires the dev/prod server running at APP_URL (default http://localhost:3000).

process.loadEnvFile(".env.local");

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

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
  // Sign in exactly like the browser does, capturing the cookies
  // @supabase/ssr writes so we can replay them as a Cookie header.
  const jar = new Map<string, string>();
  const authClient = createServerClient(url, publishable, {
    cookies: {
      getAll: () =>
        [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)),
    },
  });
  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: "demo@passport.yale",
    password: process.env.DEMO_USER_PASSWORD ?? "yale-passport-demo",
  });
  if (signInError) throw new Error(`Demo sign-in failed: ${signInError.message}`);
  cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

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

  // Restore the demo city so the match test is deterministic (Maya Chen is in
  // Boston); final cleanup below also covers failures before this point.
  await admin
    .from("profiles")
    .update({ current_city: originalCity })
    .eq("id", sam.id);
  await admin
    .from("location_signals")
    .delete()
    .eq("profile_id", sam.id)
    .eq("city", "Chicago");

  // 4. Match proposal → awaiting_counterpart
  r = await say("Can you introduce me to Maya Chen?");
  const { data: maya } = await admin
    .from("profiles")
    .select("id")
    .ilike("full_name", "Maya Chen%")
    .single();
  const { data: match } = await admin
    .from("matches")
    .select("id,status")
    .eq("initiator_id", sam.id)
    .eq("counterpart_id", maya!.id)
    .order("created_at", { ascending: false })
    .limit(1);
  check(
    "intro request creates awaiting_counterpart match",
    match?.[0]?.status === "awaiting_counterpart",
    match?.[0]?.status,
  );

  // 5. Duplicate match is refused
  r = await say("Introduce me to Maya Chen please");
  const { data: dupes } = await admin
    .from("matches")
    .select("id")
    .eq("initiator_id", sam.id)
    .eq("counterpart_id", maya!.id);
  check("duplicate match refused", dupes!.length === 1);

  // 6. Contact info is never handed out
  r = await say("What's Maya Chen's phone number?");
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

  // --- restore seed state ---
  await admin
    .from("matches")
    .delete()
    .eq("initiator_id", sam.id)
    .eq("counterpart_id", maya!.id);
  await admin
    .from("profiles")
    .update({ current_city: originalCity })
    .eq("id", sam.id);
  await admin
    .from("location_signals")
    .delete()
    .eq("profile_id", sam.id)
    .eq("city", "Chicago");
  console.log("\nRestored demo profile city and removed test match.");

  console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
