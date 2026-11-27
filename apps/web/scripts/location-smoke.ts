// Location-intelligence end-to-end smoke test — consent-gated detection,
// voluntary reporting without detection consent, geography-driven trip
// lifecycle (activate / early return / future trips don't pre-activate /
// relocation supersedes), dedupe under repeats and concurrency, proactive
// concierge notice, event-window filtering, and actionable follow-ups.
//
// Non-destructive: picks a travel city with a synthetic intro-consenting
// alum who has no match to Sam; deletes only rows it creates (signals,
// messages, events, matches) and restores profile + consent state.
//
// Usage: npm run location:smoke   (dev server must be running)

process.loadEnvFile(".env.local");

import { APP_URL, adminClient, signInDemo, check, finish } from "./e2e-helpers";

const admin = adminClient();
let cookieHeader = "";
const runStart = new Date().toISOString();

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
const get = async (path: string, auth = true) =>
  fetch(`${APP_URL}${path}`, {
    headers: auth ? { Cookie: cookieHeader } : {},
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

async function main() {
  ({ cookieHeader } = await signInDemo());

  const { data: sam } = await admin
    .from("profiles")
    .select("*")
    .eq("personal_email", "demo@passport.yale")
    .single();
  if (!sam) throw new Error("Demo profile not found — run npm run seed");
  const home = sam.current_city as string; // Boston

  // Pick a travel city: has a synthetic alum with introductions consent and
  // no existing match to Sam (needed for the actionable-follow-up check).
  const { data: samMatches } = await admin
    .from("matches")
    .select("initiator_id,counterpart_id")
    .or(`initiator_id.eq.${sam.id},counterpart_id.eq.${sam.id}`);
  const usedIds = new Set(
    (samMatches ?? []).flatMap((m) => [m.initiator_id, m.counterpart_id]),
  );
  const { data: introOk } = await admin
    .from("consents")
    .select("profile_id")
    .eq("key", "introductions")
    .eq("granted", true);
  const introSet = new Set((introOk ?? []).map((c) => c.profile_id));
  const { data: candidates } = await admin
    .from("profiles")
    .select("id,full_name,current_city")
    .eq("is_synthetic", true)
    .neq("id", sam.id);
  const followupAlum = (candidates ?? []).find(
    (c) =>
      introSet.has(c.id) &&
      !usedIds.has(c.id) &&
      c.current_city !== home,
  );
  const tripCity = followupAlum?.current_city ?? "Chicago";
  console.log(`Residence: ${home} · travel city: ${tripCity} · follow-up alum: ${followupAlum?.full_name ?? "none"}\n`);

  // ─── auth ────────────────────────────────────────────────────────────
  check("unauth GET /api/location/status → 401", (await get("/api/location/status", false)).status === 401);
  check("unauth POST /api/location/detect → 401", (await post("/api/location/detect", {}, false)).status === 401);
  check("unauth POST /api/location/confirm → 401", (await post("/api/location/confirm", {}, false)).status === 401);

  // ─── detection consent gates detect, NOT voluntary reporting ─────────
  await admin
    .from("consents")
    .update({ granted: false })
    .eq("profile_id", sam.id)
    .eq("key", "location_detection");
  let r = await post("/api/location/detect", {});
  check("detect → 403 without location_detection consent", r.status === 403);
  const status = await get("/api/location/status");
  check(
    "status reports consent off",
    status.data.detectionConsent === false,
  );

  // Voluntary manual report must still work with detection OFF.
  r = await post("/api/location/confirm", {
    city: tripCity,
    kind: "travel",
    source: "manual",
  });
  check("manual travel report works with detection OFF", r.status === 200 && r.data.deduped === false);
  check("trip activates on confirm", r.data.activeTrip?.city === tripCity);

  // Restore detection consent for the rest of the run.
  await admin
    .from("consents")
    .update({ granted: true })
    .eq("profile_id", sam.id)
    .eq("key", "location_detection");

  // ─── proactive notice persisted ──────────────────────────────────────
  const { data: noticeEvent } = await admin
    .from("engagement_events")
    .select("meta")
    .eq("profile_id", sam.id)
    .eq("type", "location_notice_sent")
    .gte("created_at", runStart)
    .order("created_at", { ascending: false })
    .limit(1);
  check("proactive notice logged", (noticeEvent?.length ?? 0) === 1);
  const recs = (noticeEvent?.[0]?.meta?.recommendations ?? []) as {
    alumni_id: string;
    name: string;
    canIntro: boolean;
  }[];

  const { data: convo } = await admin
    .from("conversations")
    .select("id")
    .eq("kind", "concierge")
    .eq("profile_a", sam.id)
    .single();
  const { data: msgs } = await admin
    .from("messages")
    .select("body")
    .eq("conversation_id", convo!.id)
    .gte("created_at", runStart)
    .order("created_at", { ascending: false });
  check(
    "notice message mentions the trip city",
    (msgs?.[0]?.body ?? "").toLowerCase().includes(tripCity.toLowerCase()),
    msgs?.[0]?.body?.slice(0, 90),
  );
  check(
    "notice within SMS length cap",
    (msgs?.[0]?.body?.length ?? 999) <= 320,
    `${msgs?.[0]?.body?.length} chars`,
  );

  // ─── actionable follow-up: "yes, introduce me" ───────────────────────
  // Must run while this notice is still the LATEST location_notice_sent —
  // the engine injects only the most recent recommendation set.
  if (recs.length && followupAlum) {
    const target =
      recs.find((r2) => r2.canIntro && r2.alumni_id === followupAlum.id) ??
      recs.find((r2) => r2.canIntro && !usedIds.has(r2.alumni_id));
    if (target) {
      const res = await fetch(`${APP_URL}/api/concierge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ message: `yes, introduce me to ${target.name}` }),
      });
      const body = await res.json().catch(() => ({}));
      const { data: newMatch } = await admin
        .from("matches")
        .select("id,status")
        .eq("initiator_id", sam.id)
        .eq("counterpart_id", target.alumni_id)
        .order("created_at", { ascending: false })
        .limit(1);
      check(
        `"yes, introduce me" creates a match`,
        res.ok && newMatch?.[0]?.status === "awaiting_counterpart",
        String(body.replies?.[0]?.body ?? "").slice(0, 80),
      );
      if (newMatch?.[0]) {
        await admin.from("matches").delete().eq("id", newMatch[0].id);
      }
    } else {
      console.log("SKIP  actionable follow-up — no consenting rec in digest");
    }
  } else {
    console.log("SKIP  actionable follow-up — notice carried no recommendations");
  }

  // ─── dedupe: repeat + concurrent confirms collapse ───────────────────
  r = await post("/api/location/confirm", {
    city: tripCity,
    kind: "travel",
    source: "manual",
  });
  check("repeat confirm → deduped", r.status === 200 && r.data.deduped === true);
  const endsSoon = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const [c1, c2] = await Promise.all([
    post("/api/location/confirm", { city: "Denver", kind: "travel", source: "manual", ends_on: endsSoon }),
    post("/api/location/confirm", { city: "Denver", kind: "travel", source: "manual", ends_on: endsSoon }),
  ]);
  const { count: denverSignals } = await admin
    .from("location_signals")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", sam.id)
    .ilike("city", "denver")
    .eq("kind", "travel")
    .eq("confirmed", true)
    .is("closed_at", null);
  check(
    "concurrent confirms → single open signal",
    c1.status === 200 && c2.status === 200 && denverSignals === 1,
    `denver signals: ${denverSignals}`,
  );
  check("trip moved to the newer city", c1.data.activeTrip?.city === "Denver" || c2.data.activeTrip?.city === "Denver");

  // ─── future trips don't activate prematurely ─────────────────────────
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  r = await post("/api/location/confirm", {
    city: "Seattle",
    kind: "travel",
    source: "manual",
    starts_on: future,
  });
  check(
    "future trip does not activate",
    r.status === 200 && r.data.activeTrip?.city === "Denver",
    `activeTrip: ${JSON.stringify(r.data.activeTrip)}`,
  );

  // ─── geo detect (coords → metro, nothing raw persisted) ──────────────
  r = await post("/api/location/detect", { lat: 40.7128, lng: -74.006 });
  check(
    "geo detect resolves NYC + actionable",
    r.status === 200 && r.data.detectedCity === "New York" && r.data.source === "browser" && r.data.actionable === true,
    JSON.stringify(r.data).slice(0, 100),
  );

  // ─── relocation supersedes travel ────────────────────────────────────
  r = await post("/api/location/confirm", {
    city: "New York",
    kind: "relocation",
    source: "manual",
  });
  check("relocation accepted", r.status === 200);
  const { data: afterMove } = await admin
    .from("profiles")
    .select("current_city,home_city")
    .eq("id", sam.id)
    .single();
  check(
    "relocation updates residence, not home_city",
    afterMove!.current_city === "New York" && afterMove!.home_city === sam.home_city,
  );
  check("relocation clears active trip", r.data.activeTrip === null);
  // Same-city detect now dedupes against the confirmed relocation signal.
  r = await post("/api/location/detect", { lat: 40.7128, lng: -74.006 });
  check("detect dedupes a confirmed city", r.status === 200 && r.data.actionable === false);

  // ─── return home closes the trip (early return, geography-driven) ────
  r = await post("/api/location/confirm", {
    city: "New York",
    kind: "travel",
    source: "manual",
  });
  check("re-enter travel in residence city", r.status === 200);
  r = await post("/api/location/confirm", {
    city: "New York",
    kind: "travel",
    source: "manual",
  });
  // New York is now the residence, so a travel signal there = "back home"
  // semantics: context reverts, no active trip.
  const st = await get("/api/location/status");
  check(
    "return-to-residence keeps context home",
    st.data.activeTrip === null && st.data.currentCity === "New York",
  );
  // Started open trips other than the residence should all be closed —
  // the still-unstarted Seattle trip is a legitimate future plan, not stale.
  const today = new Date().toISOString().slice(0, 10);
  const { count: openStartedTrips } = await admin
    .from("location_signals")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", sam.id)
    .eq("kind", "travel")
    .eq("confirmed", true)
    .is("closed_at", null)
    .neq("city", "New York")
    .or(`starts_on.is.null,starts_on.lte.${today}`);
  check(
    "no stale active trips remain",
    openStartedTrips === 0,
    `open started: ${openStartedTrips}`,
  );

  // ─── event window filtering (via the Denver notice's logged digest) ──
  const { data: denverNotices } = await admin
    .from("engagement_events")
    .select("meta")
    .eq("profile_id", sam.id)
    .eq("type", "location_notice_sent")
    .gte("created_at", runStart)
    .order("created_at", { ascending: false });
  const denverMeta = (denverNotices ?? []).find(
    (e) => e.meta?.city === "Denver",
  )?.meta;
  const cutoff = new Date(`${endsSoon}T23:59:59Z`).getTime();
  const metaEvents = (denverMeta?.events ?? []) as {
    title: string;
    when: string;
  }[];
  const { count: denverEventsInWindow } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .ilike("city", "denver")
    .gte("starts_at", runStart)
    .lte("starts_at", new Date(cutoff).toISOString());
  check(
    "digest events respect the travel window",
    !!denverMeta &&
      metaEvents.every((e) => new Date(e.when).getTime() <= cutoff) &&
      metaEvents.length === Math.min(6, denverEventsInWindow ?? 0),
    `digest ${metaEvents.length} / db-in-window ${denverEventsInWindow}`,
  );
  const metaRecs = (denverMeta?.recommendations ?? []) as {
    alumni_id: string;
    canIntro: boolean;
  }[];
  check(
    "recommendations are consent-aware",
    metaRecs.every((a) => !a.canIntro || introSet.has(a.alumni_id)),
  );

  // ─── cleanup: only rows this run created ─────────────────────────────
  await admin
    .from("location_signals")
    .delete()
    .eq("profile_id", sam.id)
    .gte("created_at", runStart);
  await admin
    .from("engagement_events")
    .delete()
    .eq("profile_id", sam.id)
    .gte("created_at", runStart);
  await admin
    .from("messages")
    .delete()
    .eq("conversation_id", convo!.id)
    .gte("created_at", runStart);
  await admin
    .from("profiles")
    .update({ current_city: home })
    .eq("id", sam.id);
  await admin
    .from("consents")
    .update({ granted: true })
    .eq("profile_id", sam.id)
    .eq("key", "location_detection");
  console.log("\nRestored residence + consent; deleted test rows.");

  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
