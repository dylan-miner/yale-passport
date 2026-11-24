// Passport seed script — populates synthetic demo data via the service role.
//
// Usage: npm run seed   (loads .env.local via node --env-file)
//
// Repeatable:
//   - profiles are upserted on personal_email (stable synthetic identities)
//   - consents are upserted on (profile_id, key)
//   - city_resources and events are deleted + re-inserted (seed-owned tables)
//
// Requires SUPABASE_SECRET_KEY in .env.local. Schema must already be applied
// (supabase/migrations/0001_init.sql) — the script checks and bails if not.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (check .env.local)",
  );
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_EMAIL = "demo@passport.yale";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "yale-passport-demo";
const FULL_CONSENT = {
  sms_opt_in: true,
  location_detection: true,
  directory_visibility: true,
  introductions: true,
  yaa_sharing: true,
};

// ---------- data ----------

const DEMO_PROFILE = {
  full_name: "Sam Rivera",
  grad_year: 2024,
  personal_email: DEMO_EMAIL,
  phone_e164: "+15550100001",
  home_city: "Los Angeles",
  current_city: "Boston",
  industry: "Technology",
  company: "Beacon Labs",
  role_title: "Product Manager",
  linkedin_url: "https://www.linkedin.com/",
  interests: ["startups", "product", "climate tech", "mentorship"],
  networking_goals: ["peer connections", "career advice"],
  availability_text: "Weekday evenings",
  is_synthetic: false,
};

// Consent overrides keyed by personal_email — alumni default to FULL_CONSENT;
// these model opted-out profiles (e.g. hidden from the directory).
const CONSENT_OVERRIDES = {
  "rachel.kim@passport.test": { directory_visibility: false },
  "nate.brooks@passport.test": { directory_visibility: false },
  "casey.park@passport.test": { introductions: false },
  "hannah.gold@passport.test": {
    directory_visibility: false,
    introductions: false,
  },
};

const SYNTHETIC_ALUMNI = [
  // --- Boston (demo user's city — dense pool for the golden path) ---
  {
    full_name: "Maya Chen",
    grad_year: 2019,
    personal_email: "maya.chen@passport.test",
    phone_e164: "+15550100101",
    home_city: "New York",
    current_city: "Boston",
    industry: "Venture Capital",
    company: "Northstar Ventures",
    role_title: "Investor",
    linkedin_url: "https://www.linkedin.com/",
    interests: ["clean energy", "mobility", "mentorship", "startups"],
    networking_goals: ["mentorship", "meet alumni"],
    availability_text: "Weekday mornings",
  },
  {
    full_name: "Jordan Lee",
    grad_year: 2012,
    personal_email: "jordan.lee@passport.test",
    phone_e164: "+15550100102",
    home_city: "Boston",
    current_city: "Boston",
    industry: "Climate Tech",
    company: "Clearedge Capital",
    role_title: "Partner",
    linkedin_url: "https://www.linkedin.com/",
    interests: ["clean energy", "mobility", "angel investing"],
    networking_goals: ["mentorship", "hiring"],
    availability_text: "Flexible",
  },
  {
    full_name: "Priya Shah",
    grad_year: 2018,
    personal_email: "priya.shah@passport.test",
    phone_e164: "+15550100103",
    home_city: "Chicago",
    current_city: "Boston",
    industry: "Biotech",
    company: "Helix Bio",
    role_title: "Product Lead",
    linkedin_url: "https://www.linkedin.com/",
    interests: ["product", "biotech", "peer advice"],
    networking_goals: ["peer connections", "meet alumni"],
    availability_text: "Weekday evenings",
  },
  {
    full_name: "Marcus Whitfield",
    grad_year: 2021,
    personal_email: "marcus.whitfield@passport.test",
    phone_e164: "+15550100104",
    home_city: "Atlanta",
    current_city: "Boston",
    industry: "Consulting",
    company: "Bain & Company",
    role_title: "Senior Associate Consultant",
    interests: ["consulting", "startups", "basketball"],
    networking_goals: ["peer connections", "mentorship"],
    availability_text: "Weekends",
  },
  {
    full_name: "Sofia Delgado",
    grad_year: 2022,
    personal_email: "sofia.delgado@passport.test",
    home_city: "Miami",
    current_city: "Boston",
    industry: "Medicine",
    company: "Massachusetts General Hospital",
    role_title: "Resident Physician",
    interests: ["medicine", "health equity", "running"],
    networking_goals: ["meet alumni"],
    availability_text: "Varies",
  },
  {
    full_name: "Ben Okafor",
    grad_year: 2023,
    personal_email: "ben.okafor@passport.test",
    phone_e164: "+15550100105",
    home_city: "Houston",
    current_city: "Boston",
    industry: "Technology",
    company: "Drift Systems",
    role_title: "Software Engineer",
    interests: ["startups", "product", "soccer"],
    networking_goals: ["peer connections", "career advice"],
    availability_text: "Weekday evenings",
  },
  {
    full_name: "Rachel Kim",
    grad_year: 2020,
    personal_email: "rachel.kim@passport.test",
    home_city: "Seattle",
    current_city: "Boston",
    industry: "Law",
    company: "Ropes & Gray",
    role_title: "Associate",
    interests: ["law", "public policy", "rowing"],
    networking_goals: ["meet alumni", "mentorship"],
    availability_text: "Weekday lunches",
  },

  // --- New York ---
  {
    full_name: "Alex Novak",
    grad_year: 2021,
    personal_email: "alex.novak@passport.test",
    phone_e164: "+15550100111",
    home_city: "New York",
    current_city: "New York",
    industry: "Finance",
    company: "Goldman Sachs",
    role_title: "Analyst",
    interests: ["finance", "markets", "tennis"],
    networking_goals: ["peer connections"],
    availability_text: "Weekends",
  },
  {
    full_name: "Dani Rosen",
    grad_year: 2020,
    personal_email: "dani.rosen@passport.test",
    phone_e164: "+15550100112",
    home_city: "Philadelphia",
    current_city: "New York",
    industry: "Technology",
    company: "Spotify",
    role_title: "Product Manager",
    interests: ["product", "music", "startups"],
    networking_goals: ["mentorship", "peer connections"],
    availability_text: "Weekday evenings",
  },
  {
    full_name: "James Osei",
    grad_year: 2022,
    personal_email: "james.osei@passport.test",
    phone_e164: "+15550100113",
    home_city: "Accra",
    current_city: "New York",
    industry: "Technology",
    company: "Google",
    role_title: "Software Engineer",
    interests: ["distributed systems", "soccer", "mentorship"],
    networking_goals: ["mentorship", "meet alumni"],
    availability_text: "Weekday evenings",
  },
  {
    full_name: "Lauren Baptiste",
    grad_year: 2019,
    personal_email: "lauren.baptiste@passport.test",
    home_city: "New Orleans",
    current_city: "New York",
    industry: "Finance",
    company: "Morgan Stanley",
    role_title: "Equity Research Associate",
    interests: ["markets", "biotech", "yoga"],
    networking_goals: ["career advice"],
    availability_text: "Weekday mornings",
  },
  {
    full_name: "Tom Okonkwo",
    grad_year: 2023,
    personal_email: "tom.okonkwo@passport.test",
    phone_e164: "+15550100114",
    home_city: "Chicago",
    current_city: "New York",
    industry: "Consulting",
    company: "McKinsey & Company",
    role_title: "Business Analyst",
    interests: ["consulting", "climate tech", "travel"],
    networking_goals: ["peer connections", "career advice"],
    availability_text: "Flexible",
  },
  {
    full_name: "Nina Petrova",
    grad_year: 2022,
    personal_email: "nina.petrova@passport.test",
    home_city: "Moscow",
    current_city: "New York",
    industry: "Media",
    company: "The Atlantic",
    role_title: "Staff Writer",
    interests: ["journalism", "books", "running"],
    networking_goals: ["meet alumni"],
    availability_text: "Varies",
  },
  {
    full_name: "Aisha Bello",
    grad_year: 2024,
    personal_email: "aisha.bello@passport.test",
    phone_e164: "+15550100115",
    home_city: "Lagos",
    current_city: "New York",
    industry: "Technology",
    company: "Datadog",
    role_title: "Data Scientist",
    interests: ["machine learning", "product", "afrobeats"],
    networking_goals: ["peer connections", "mentorship"],
    availability_text: "Weekday evenings",
  },

  // --- Chicago ---
  {
    full_name: "Kevin Doyle",
    grad_year: 2020,
    personal_email: "kevin.doyle@passport.test",
    phone_e164: "+15550100121",
    home_city: "Chicago",
    current_city: "Chicago",
    industry: "Consulting",
    company: "McKinsey & Company",
    role_title: "Associate",
    interests: ["consulting", "golf", "Chicago food"],
    networking_goals: ["peer connections"],
    availability_text: "Weekends",
  },
  {
    full_name: "Grace Liu",
    grad_year: 2022,
    personal_email: "grace.liu@passport.test",
    phone_e164: "+15550100122",
    home_city: "San Francisco",
    current_city: "Chicago",
    industry: "Technology",
    company: "Tempus",
    role_title: "Product Designer",
    interests: ["design", "product", "ceramics"],
    networking_goals: ["meet alumni", "peer connections"],
    availability_text: "Weekday evenings",
  },
  {
    full_name: "David Feldman",
    grad_year: 2019,
    personal_email: "david.feldman@passport.test",
    phone_e164: "+15550100123",
    home_city: "New York",
    current_city: "Chicago",
    industry: "Private Equity",
    company: "Madison Dearborn",
    role_title: "Associate",
    interests: ["finance", "hockey", "mentorship"],
    networking_goals: ["mentorship"],
    availability_text: "Weekday mornings",
  },
  {
    full_name: "Maya Krishnan",
    grad_year: 2023,
    personal_email: "maya.krishnan@passport.test",
    home_city: "Boston",
    current_city: "Chicago",
    industry: "Finance",
    company: "Citadel",
    role_title: "Software Engineer",
    interests: ["low-latency systems", "chess", "startups"],
    networking_goals: ["peer connections"],
    availability_text: "Weekday evenings",
  },
  {
    full_name: "Omar Haddad",
    grad_year: 2022,
    personal_email: "omar.haddad@passport.test",
    home_city: "Detroit",
    current_city: "Chicago",
    industry: "Public Policy",
    company: "City of Chicago",
    role_title: "Policy Analyst",
    interests: ["urban policy", "housing", "photography"],
    networking_goals: ["meet alumni", "career advice"],
    availability_text: "Weekday evenings",
  },

  // --- San Francisco ---
  {
    full_name: "Tam Nguyen",
    grad_year: 2022,
    personal_email: "tam.nguyen@passport.test",
    phone_e164: "+15550100131",
    home_city: "San Jose",
    current_city: "San Francisco",
    industry: "Technology",
    company: "Anthropic",
    role_title: "Software Engineer",
    interests: ["AI safety", "startups", "climbing"],
    networking_goals: ["peer connections", "meet alumni"],
    availability_text: "Weekday evenings",
  },
  {
    full_name: "Lucy Hart",
    grad_year: 2021,
    personal_email: "lucy.hart@passport.test",
    phone_e164: "+15550100132",
    home_city: "Portland",
    current_city: "San Francisco",
    industry: "Technology",
    company: "Stripe",
    role_title: "Product Manager",
    interests: ["product", "fintech", "hiking"],
    networking_goals: ["mentorship", "peer connections"],
    availability_text: "Weekday mornings",
  },
  {
    full_name: "Raj Patel",
    grad_year: 2020,
    personal_email: "raj.patel@passport.test",
    phone_e164: "+15550100133",
    home_city: "Dallas",
    current_city: "San Francisco",
    industry: "Startups",
    company: "Meridian Health",
    role_title: "Co-founder",
    interests: ["startups", "health tech", "cricket"],
    networking_goals: ["hiring", "peer connections"],
    availability_text: "Flexible",
  },
  {
    full_name: "Isabelle Moreau",
    grad_year: 2024,
    personal_email: "isabelle.moreau@passport.test",
    home_city: "Paris",
    current_city: "San Francisco",
    industry: "Technology",
    company: "Airbnb",
    role_title: "Software Engineer",
    interests: ["frontend", "design", "bouldering"],
    networking_goals: ["meet alumni", "career advice"],
    availability_text: "Weekends",
  },
  {
    full_name: "Nate Brooks",
    grad_year: 2019,
    personal_email: "nate.brooks@passport.test",
    phone_e164: "+15550100134",
    home_city: "Boston",
    current_city: "San Francisco",
    industry: "Venture Capital",
    company: "Sequoia Capital",
    role_title: "Associate",
    interests: ["startups", "climate tech", "surfing"],
    networking_goals: ["mentorship"],
    availability_text: "Weekday mornings",
  },

  // --- Elsewhere (thin-market texture) ---
  {
    full_name: "Will Thornton",
    grad_year: 2020,
    personal_email: "will.thornton@passport.test",
    home_city: "Richmond",
    current_city: "Washington DC",
    industry: "Consulting",
    company: "Deloitte",
    role_title: "Consultant",
    interests: ["government", "cycling", "mentorship"],
    networking_goals: ["meet alumni"],
    availability_text: "Weekends",
  },
  {
    full_name: "Casey Park",
    grad_year: 2022,
    personal_email: "casey.park@passport.test",
    home_city: "Seattle",
    current_city: "Los Angeles",
    industry: "Nonprofit",
    company: "826LA",
    role_title: "Program Coordinator",
    interests: ["education", "writing", "film"],
    networking_goals: ["peer connections"],
    availability_text: "Weekday evenings",
  },
  {
    full_name: "Hannah Gold",
    grad_year: 2018,
    personal_email: "hannah.gold@passport.test",
    home_city: "New York",
    current_city: "New York",
    industry: "Medicine",
    company: "Mount Sinai",
    role_title: "Resident Physician",
    interests: ["medicine", "policy"],
    networking_goals: [],
    availability_text: "Varies",
  },
];

const CITY_RESOURCES = [
  // Boston
  { city: "Boston", name: "Yale Club of Boston", type: "club",
    url: "https://alumni.yale.edu",
    description: "Regional alumni organization — events, young alumni programs, and a monthly newsletter." },
  { city: "Boston", name: "Boston Young Alumni WhatsApp", type: "group_chat",
    url: null,
    description: "Unofficial young alumni chat. Request an invite from the club coordinator." },
  { city: "Boston", name: "Club Coordinator", type: "contact",
    url: "https://alumni.yale.edu",
    description: "Email the Yale Club of Boston to get added to the mailing list and group chat." },
  { city: "Boston", name: "YAA Events Calendar", type: "link",
    url: "https://alumni.yale.edu",
    description: "Official Yale Alumni Association events listing." },

  // New York
  { city: "New York", name: "Yale Club of New York City", type: "club",
    url: "https://alumni.yale.edu",
    description: "Flagship regional club on Vanderbilt Ave — dining, networking, and young alumni events." },
  { city: "New York", name: "NYC Young Alumni GroupMe", type: "group_chat",
    url: null,
    description: "Active young alumni group chat; ask a club member for an invite." },
  { city: "New York", name: "Club Membership Desk", type: "contact",
    url: "https://alumni.yale.edu",
    description: "Contact the club for membership info and event RSVPs." },
  { city: "New York", name: "YAA Events Calendar", type: "link",
    url: "https://alumni.yale.edu",
    description: "Official Yale Alumni Association events listing." },

  // Chicago
  { city: "Chicago", name: "Yale Club of Chicago", type: "club",
    url: "https://alumni.yale.edu",
    description: "Regional club hosting monthly lunches, service days, and holiday events." },
  { city: "Chicago", name: "Chicago Yalies Slack", type: "group_chat",
    url: null,
    description: "Alumni-run Slack workspace for the Chicago area; request access via the club." },
  { city: "Chicago", name: "YAA Events Calendar", type: "link",
    url: "https://alumni.yale.edu",
    description: "Official Yale Alumni Association events listing." },

  // San Francisco
  { city: "San Francisco", name: "Yale Club of San Francisco", type: "club",
    url: "https://alumni.yale.edu",
    description: "Regional club covering the Bay Area — tech talks, mixers, and outdoor meetups." },
  { city: "San Francisco", name: "Bay Area Yalies Slack", type: "group_chat",
    url: null,
    description: "Alumni-run Slack with channels for tech, founders, and housing." },
  { city: "San Francisco", name: "YAA Events Calendar", type: "link",
    url: "https://alumni.yale.edu",
    description: "Official Yale Alumni Association events listing." },
];

// dates are relative to seed run so the demo always shows upcoming events
const daysFromNow = (n, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 30, 0, 0);
  return d.toISOString();
};

const EVENTS = [
  // Boston
  { city: "Boston", title: "Boston Welcome Mixer", neighborhood: "Back Bay",
    venue: "The Lenox Hotel", starts_at: daysFromNow(3),
    tags: ["mixer", "young alumni"], description: "Casual welcome event for recently arrived alumni.",
    url: "https://alumni.yale.edu" },
  { city: "Boston", title: "Community Service Day", neighborhood: "Cambridge",
    venue: "Charles River Esplanade", starts_at: daysFromNow(6, 10),
    tags: ["service"], description: "Morning cleanup and volunteering with the Yale Club of Boston." },
  { city: "Boston", title: "Yalies in Tech Coffee Chat", neighborhood: "Kendall Square",
    venue: "Blueprint Coffee", starts_at: daysFromNow(8, 9),
    tags: ["tech", "networking"], description: "Small-group coffee for alumni working in tech." },
  { city: "Boston", title: "Holiday Party", neighborhood: "Back Bay",
    venue: "Yale Club of Boston", starts_at: daysFromNow(12),
    tags: ["social"], description: "Annual holiday gathering for all Boston-area alumni." },

  // New York
  { city: "New York", title: "Young Alumni Happy Hour", neighborhood: "Flatiron",
    venue: "The Yale Club", starts_at: daysFromNow(2),
    tags: ["mixer", "young alumni"], description: "Monthly happy hour for recent graduates.",
    url: "https://alumni.yale.edu" },
  { city: "New York", title: "Bulldogs in Finance Panel", neighborhood: "Midtown",
    venue: "The Yale Club", starts_at: daysFromNow(7),
    tags: ["finance", "panel"], description: "Panel discussion with alumni across banking and investing." },
  { city: "New York", title: "Central Park Run Club", neighborhood: "Upper West Side",
    venue: "Columbus Circle", starts_at: daysFromNow(9, 8),
    tags: ["fitness", "social"], description: "Easy 3-mile run followed by coffee." },

  // Chicago
  { city: "Chicago", title: "Young Alumni Happy Hour", neighborhood: "River North",
    venue: "The Berkshire Room", starts_at: daysFromNow(4),
    tags: ["mixer", "young alumni"], description: "Monthly social for alumni in their first five years out.",
    url: "https://alumni.yale.edu" },
  { city: "Chicago", title: "Yalies in Product — Coffee Meetup", neighborhood: "West Loop",
    venue: "Sawada Coffee", starts_at: daysFromNow(10, 9),
    tags: ["tech", "product", "networking"], description: "Informal meetup for PMs, designers, and engineers." },
  { city: "Chicago", title: "Startup & Alumni Mixer", neighborhood: "Fulton Market",
    venue: "1871", starts_at: daysFromNow(14),
    tags: ["startups", "networking"], description: "Joint mixer with local founders and Yale alumni." },

  // San Francisco
  { city: "San Francisco", title: "Bay Area Tech Alumni Mixer", neighborhood: "SoMa",
    venue: "21st Amendment", starts_at: daysFromNow(5),
    tags: ["tech", "mixer"], description: "Monthly gathering for alumni working in tech and startups.",
    url: "https://alumni.yale.edu" },
  { city: "San Francisco", title: "Founders Roundtable", neighborhood: "Mission",
    venue: "Y Combinator", starts_at: daysFromNow(11),
    tags: ["startups", "founders"], description: "Roundtable with Yale founders and prospective founders." },
  { city: "San Francisco", title: "Presidio Hike & Brunch", neighborhood: "Presidio",
    venue: "Presidio Wall Playground", starts_at: daysFromNow(13, 10),
    tags: ["outdoors", "social"], description: "Saturday morning hike followed by brunch." },
];

// ---------- run ----------

const { error: preflight } = await supabase
  .from("profiles")
  .select("id")
  .limit(1);

if (preflight) {
  console.error(
    "Could not read profiles table — apply supabase/migrations/0001_init.sql first.\n" +
      `(${preflight.message})`,
  );
  process.exit(1);
}

// 1. demo auth user
let demoUserId;
{
  const { data: list, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(`Failed to list auth users: ${error.message}`);
    process.exit(1);
  }
  const existing = list.users.find((u) => u.email === DEMO_EMAIL);
  if (existing) {
    demoUserId = existing.id;
    console.log(`Demo user exists: ${DEMO_EMAIL} (${demoUserId})`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEMO_PROFILE.full_name },
    });
    if (error) {
      console.error(`Failed to create demo user: ${error.message}`);
      process.exit(1);
    }
    demoUserId = data.user.id;
    console.log(`Created demo user: ${DEMO_EMAIL} (${demoUserId})`);
  }
}

// 2. profiles (upsert on personal_email)
const profileRows = [
  { ...DEMO_PROFILE, user_id: demoUserId },
  ...SYNTHETIC_ALUMNI.map((p) => ({
    ...p,
    user_id: null,
    is_synthetic: true,
  })),
];

const { data: upserted, error: profileError } = await supabase
  .from("profiles")
  .upsert(profileRows, { onConflict: "personal_email" })
  .select("id, personal_email");

if (profileError) {
  console.error(`Failed to upsert profiles: ${profileError.message}`);
  process.exit(1);
}
console.log(`Upserted ${upserted.length} profiles`);

// 3. consents
const idByEmail = new Map(upserted.map((p) => [p.personal_email, p.id]));
const consentRows = [];

for (const alum of SYNTHETIC_ALUMNI) {
  const id = idByEmail.get(alum.personal_email);
  if (!id) continue;
  const consent = {
    ...FULL_CONSENT,
    ...(CONSENT_OVERRIDES[alum.personal_email] ?? {}),
  };
  for (const [key, granted] of Object.entries(consent)) {
    consentRows.push({ profile_id: id, key, granted });
  }
}
{
  const id = idByEmail.get(DEMO_EMAIL);
  for (const [key, granted] of Object.entries(FULL_CONSENT)) {
    consentRows.push({ profile_id: id, key, granted });
  }
}

const { error: consentError } = await supabase
  .from("consents")
  .upsert(consentRows, { onConflict: "profile_id,key" });

if (consentError) {
  console.error(`Failed to upsert consents: ${consentError.message}`);
  process.exit(1);
}
console.log(`Upserted ${consentRows.length} consent rows`);

// 4. city resources + events (seed-owned tables: clear, then insert)
const { error: delResError } = await supabase
  .from("city_resources")
  .delete()
  .not("id", "is", null);
const { error: delEvtError } = await supabase
  .from("events")
  .delete()
  .not("id", "is", null);
if (delResError || delEvtError) {
  console.error(
    `Failed to clear seed tables: ${delResError?.message ?? delEvtError?.message}`,
  );
  process.exit(1);
}

const { error: resError } = await supabase
  .from("city_resources")
  .insert(CITY_RESOURCES);
const { error: evtError } = await supabase.from("events").insert(EVENTS);
if (resError || evtError) {
  console.error(
    `Failed to insert seed data: ${resError?.message ?? evtError?.message}`,
  );
  process.exit(1);
}

console.log(
  `Seeded ${CITY_RESOURCES.length} city resources, ${EVENTS.length} events`,
);
console.log(`\nDone. Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
