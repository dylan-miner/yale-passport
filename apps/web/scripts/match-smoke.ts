// Match flow end-to-end smoke test — request → double opt-in → mutual →
// contact release, plus consent enforcement, state transitions, duplicate
// prevention, and unauthorized-access checks. Runs over real HTTP against
// /api/matches with the synthetic alumni simulator.
//
// Non-destructive: picks a synthetic counterpart with no existing match to
// the demo user and deletes only the rows it creates.
//
// Usage: npm run match:smoke   (dev server must be running)

process.loadEnvFile(".env.local");

import { APP_URL, adminClient, signInDemo, check, finish } from "./e2e-helpers";

const admin = adminClient();
let cookieHeader = "";
let userClient: Awaited<ReturnType<typeof signInDemo>>["userClient"];

async function post(path: string, body: unknown, auth = true) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const get = (path: string) =>
  fetch(`${APP_URL}${path}`, { headers: { Cookie: cookieHeader } });

async function main() {
  ({ cookieHeader, userClient } = await signInDemo());

  const { data: sam } = await admin
    .from("profiles")
    .select("id,full_name")
    .eq("personal_email", "demo@passport.yale")
    .single();
  if (!sam) throw new Error("Demo profile not found — run npm run seed");

  // Pick a synthetic counterpart with introductions consent and NO existing
  // match to Sam — never touches data the user created in the UI.
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
    .neq("id", sam.id);
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
  console.log(`Counterpart: ${cp.full_name}\n`);

  const createdMatchIds: string[] = [];

  // --- unauthorized access ---
  check("unauth POST /api/matches → 401", (await post("/api/matches", { alumni_id: cp.id }, false)).status === 401);
  check("unauth GET /api/matches → 401", (await fetch(`${APP_URL}/api/matches`)).status === 401);

  // --- request intro ---
  let r = await post("/api/matches", { alumni_id: cp.id });
  check("intro request accepted", r.status === 200, JSON.stringify(r.data).slice(0, 80));
  const matchId = r.data.match?.id as string;
  if (matchId) createdMatchIds.push(matchId);
  check("match is awaiting_counterpart", r.data.match?.status === "awaiting_counterpart");

  // --- duplicate prevention ---
  r = await post("/api/matches", { alumni_id: cp.id });
  check("duplicate request refused", r.status === 409);

  // --- initiator can't respond while waiting ---
  r = await post(`/api/matches/${matchId}/respond`, { action: "accept" });
  check("initiator respond while waiting → 403", r.status === 403);

  // --- contact withheld before mutual (DB-enforced, user client) ---
  let { data: contact } = await userClient.rpc("get_match_contact", {
    p_match_id: matchId,
  });
  check("contact withheld before mutual", (contact?.length ?? 0) === 0);

  // --- counterpart notification landed in their concierge thread ---
  const { data: cpConvo } = await admin
    .from("conversations")
    .select("id")
    .eq("kind", "concierge")
    .eq("profile_a", cp.id)
    .single();
  const { data: cpMsgs } = await admin
    .from("messages")
    .select("body")
    .eq("conversation_id", cpConvo!.id)
    .order("created_at", { ascending: false })
    .limit(1);
  check(
    "counterpart notified via concierge thread",
    (cpMsgs?.[0]?.body ?? "").includes(sam.full_name),
  );

  // --- decline path (simulated synthetic response) ---
  r = await post(`/api/matches/${matchId}/simulate`, { decision: "decline" });
  check("simulated decline → declined", r.data.status === "declined");
  const { data: declined } = await admin
    .from("matches")
    .select("status,counterpart_response,resolved_at")
    .eq("id", matchId)
    .single();
  check(
    "declined state persisted",
    declined!.status === "declined" &&
      declined!.counterpart_response === "declined" &&
      !!declined!.resolved_at,
  );

  // --- accept path → mutual ---
  r = await post("/api/matches", { alumni_id: cp.id });
  const mutualId = r.data.match?.id as string;
  if (mutualId) createdMatchIds.push(mutualId);
  r = await post(`/api/matches/${mutualId}/simulate`, { decision: "accept" });
  check("simulated accept → mutual", r.data.status === "mutual" && r.data.mutual === true);

  const { data: mutual } = await admin
    .from("matches")
    .select("status,intro_draft,resolved_at")
    .eq("id", mutualId)
    .single();
  check("intro draft generated", (mutual!.intro_draft ?? "").length > 40);

  // match conversation created + seeded with the intro
  const { data: matchConvo } = await admin
    .from("conversations")
    .select("id")
    .eq("kind", "match")
    .eq("match_id", mutualId)
    .single();
  check("match conversation created", !!matchConvo);
  const { data: convoMsgs } = await admin
    .from("messages")
    .select("sender_type,body")
    .eq("conversation_id", matchConvo!.id);
  check(
    "intro posted to match conversation",
    convoMsgs!.length === 1 && convoMsgs![0].sender_type === "concierge",
  );

  // contact released after mutual — via the user's own client
  ({ data: contact } = await userClient.rpc("get_match_contact", {
    p_match_id: mutualId,
  }));
  check(
    "contact released after mutual",
    !!contact?.[0]?.personal_email || !!contact?.[0]?.phone_e164,
    contact?.[0]?.personal_email ?? undefined,
  );
  check(
    "contact is the counterpart, not self",
    contact?.[0]?.full_name === cp.full_name,
  );

  // GET surface includes contact for mutual only
  const list = await (await get("/api/matches")).json();
  const mutualEntry = list.matches.find((x: { id: string }) => x.id === mutualId);
  check(
    "GET exposes contact on mutual only",
    !!mutualEntry?.contact &&
      list.matches.every(
        (x: { status: string; contact: unknown }) =>
          x.status === "mutual" || x.contact === null,
      ),
  );

  // --- authorization: stranger can't respond ---
  // A match Sam isn't part of (two synthetic alumni)
  const otherAlum = (candidates ?? []).filter(
    (c) => c.id !== cp.id && c.id !== sam.id,
  );
  const { data: foreignMatch } = await admin
    .from("matches")
    .insert({
      initiator_id: otherAlum[0].id,
      counterpart_id: otherAlum[1].id,
      status: "awaiting_counterpart",
      initiator_response: "accepted",
    })
    .select("id")
    .single();
  createdMatchIds.push(foreignMatch!.id);
  r = await post(`/api/matches/${foreignMatch!.id}/respond`, { action: "accept" });
  check("stranger cannot respond to others' match", r.status === 403);

  // --- consent enforcement: intros refused for non-consented alumni ---
  const { data: noConsent } = await admin
    .from("consents")
    .select("profile_id")
    .eq("key", "introductions")
    .eq("granted", false)
    .limit(1);
  if (noConsent?.length) {
    r = await post("/api/matches", { alumni_id: noConsent[0].profile_id });
    check("intro refused without introductions consent", r.status === 409);
  } else {
    console.log("SKIP  intro refused without introductions consent — no opted-out alumni in seed");
  }

  // --- cleanup: only rows this run created ---
  await admin.from("matches").delete().in("id", createdMatchIds);
  console.log(`\nCleaned up ${createdMatchIds.length} test matches.`);

  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
