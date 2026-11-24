// Passport verification — exercises the schema, grants, and RLS policies
// end-to-end using only the API keys (no DB access needed).
//
// Usage: npm run verify

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

const DEMO_EMAIL = "demo@passport.yale";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "yale-passport-demo";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// ---------- anonymous (publishable key, no session) ----------
const anon = createClient(url, publishable, {
  auth: { persistSession: false },
});
{
  const { data, error } = await anon.from("profiles").select("id");
  check("anon cannot read profiles", !error && data.length === 0, `${data?.length ?? "err"} rows`);
}
{
  const { data, error } = await anon.from("events").select("id");
  check("anon cannot read events", !error && data.length === 0, `${data?.length ?? "err"} rows`);
}

// ---------- signed-in demo user ----------
const user = createClient(url, publishable, {
  auth: { persistSession: false },
});
{
  const { error } = await user.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  check("demo user can sign in", !error, error?.message);
}
let myProfileId;
{
  const { data, error } = await user.from("profiles").select("*");
  check("user sees exactly one profile (own)", !error && data.length === 1,
    `${data?.length ?? "err"} rows`);
  myProfileId = data?.[0]?.id;
  check("own profile is Sam Rivera", data?.[0]?.full_name === "Sam Rivera",
    data?.[0]?.full_name);
}
{
  const { data, error } = await user.from("consents").select("key, granted");
  check("user sees own consent rows", !error && data.length === 5,
    `${data?.length ?? "err"} rows`);
}
{
  const { data, error } = await user.from("directory_profiles").select("id");
  // 28 total - 3 opted out of directory_visibility (rachel, nate, hannah)
  check("directory shows opted-in alumni only", !error && data.length === 25,
    `${data?.length ?? "err"} rows`);
}
{
  const { data } = await user.from("directory_profiles").select("*");
  check("directory hides contact fields",
    !!data &&
      data.every(
        (r) =>
          !("personal_email" in r) &&
          !("phone_e164" in r) &&
          !("user_id" in r) &&
          !("home_city" in r),
      ),
    `columns: ${data?.[0] ? Object.keys(data[0]).join(",") : "none"}`);
}
{
  const { data, error } = await user.from("matches").select("id");
  check("user sees no matches yet", !error && data.length === 0);
}
{
  const { data, error } = await user.from("events").select("id");
  check("user can read events", !error && data.length > 0,
    `${data?.length ?? "err"} rows`);
}
{
  // user should NOT be able to create a match as themselves (writes are service-only)
  const { error } = await user.from("matches").insert({
    initiator_id: myProfileId,
    counterpart_id: myProfileId,
  });
  check("user cannot insert matches directly", !!error);
}

// ---------- service role ----------
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
{
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  check("service role sees all profiles", !error && count === 28,
    `${count ?? "err"} profiles`);
}
{
  const { count, error } = await admin
    .from("events")
    .select("id", { count: "exact", head: true });
  check("events seeded", !error && count === 13, `${count ?? "err"} events`);
}
{
  const { count, error } = await admin
    .from("city_resources")
    .select("id", { count: "exact", head: true });
  check("city resources seeded", !error && count === 14,
    `${count ?? "err"} resources`);
}
{
  const { count, error } = await admin
    .from("consents")
    .select("*", { count: "exact", head: true });
  check("consent rows seeded", !error && count === 140, `${count ?? "err"} rows`);
}
{
  const { count, error } = await admin
    .from("consent_events")
    .select("id", { count: "exact", head: true });
  check("consent audit log populated", !error && count >= 140,
    `${count ?? "err"} events`);
}

await admin.auth.signOut();
await user.auth.signOut();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
