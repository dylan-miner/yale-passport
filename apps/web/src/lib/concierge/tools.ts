import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Channel,
  DirectoryProfile,
  Event,
  CityResource,
  Profile,
} from "@/lib/types";
import { logEngagement } from "./store";
import { requestIntro } from "@/lib/matching";

const fmt = (s: string) => s.trim().toLowerCase();

function norm(v: string | null | undefined) {
  return v ? v.trim().toLowerCase() : "";
}

function summarize(p: DirectoryProfile) {
  return {
    name: p.full_name,
    class_year: p.grad_year,
    city: p.current_city,
    work:
      [p.role_title, p.company].filter(Boolean).join(" at ") ||
      p.industry ||
      null,
    interests: p.interests,
    networking_goals: p.networking_goals,
    alumni_id: p.id,
  };
}

// Editable fields the concierge may write to a user's own profile.
const updatable = z.object({
  full_name: z.string().min(1).optional(),
  personal_email: z.email().optional(),
  phone_e164: z.string().optional(),
  home_city: z.string().optional(),
  current_city: z.string().optional(),
  industry: z.string().optional(),
  company: z.string().optional(),
  role_title: z.string().optional(),
  linkedin_url: z.url().optional(),
  portfolio_url: z.url().optional(),
  interests: z.array(z.string()).optional(),
  networking_goals: z.array(z.string()).optional(),
  availability_text: z.string().optional(),
});

// All tools are built per-request with the authenticated user's profile bound
// in. The model cannot write to another profile or read non-consented data —
// every query below goes through consent filters or is scoped to `profile.id`.
export function buildConciergeTools(profile: Profile, channel: Channel) {
  const supabase = createAdminClient();

  return {
    get_my_profile: tool({
      description:
        "Read the signed-in user's alumni profile (their own data). Use to answer questions about what's on their profile.",
      inputSchema: z.object({}),
      execute: async () => ({
        name: profile.full_name,
        class_year: profile.grad_year,
        email: profile.personal_email,
        phone: profile.phone_e164,
        home_city: profile.home_city,
        current_city: profile.current_city,
        industry: profile.industry,
        company: profile.company,
        role: profile.role_title,
        linkedin: profile.linkedin_url,
        portfolio: profile.portfolio_url,
        interests: profile.interests,
        networking_goals: profile.networking_goals,
        availability: profile.availability_text,
      }),
    }),

    update_profile: tool({
      description:
        "Update fields on the signed-in user's own profile. IMPORTANT: only call this AFTER the user has explicitly confirmed the exact change in a preceding message (e.g. they said yes to your 'should I update X to Y?' offer). Never apply a change the user has not confirmed.",
      inputSchema: z.object({
        fields: updatable,
      }),
      execute: async ({ fields }) => {
        const update = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v !== undefined),
        );
        if (Object.keys(update).length === 0) {
          return { ok: false, error: "No fields provided." };
        }
        const cityChanged =
          typeof update.current_city === "string" &&
          norm(update.current_city as string) !== norm(profile.current_city);
        const { data, error } = await supabase
          .from("profiles")
          .update(update)
          .eq("id", profile.id)
          .select(
            "full_name,current_city,industry,company,role_title,interests,networking_goals,availability_text",
          )
          .single();
        if (error) return { ok: false, error: error.message };

        if (cityChanged) {
          await supabase.from("location_signals").insert({
            profile_id: profile.id,
            source: channel === "sms" ? "sms" : "manual",
            kind: "relocation",
            city: update.current_city,
            confirmed: true,
          });
        }
        await logEngagement("profile_updated", profile.id, {
          fields: Object.keys(update),
          channel,
        });
        return { ok: true, updated: update, profile: data };
      },
    }),

    search_alumni: tool({
      description:
        "Search the alumni directory for people matching criteria. Returns only profiles that consented to directory visibility (contact details are never exposed). Use before proposing an introduction.",
      inputSchema: z.object({
        name: z
          .string()
          .optional()
          .describe("person's name — use when the user names someone specific"),
        city: z.string().optional(),
        industry: z.string().optional(),
        interest: z
          .string()
          .optional()
          .describe("topic to match against interests or networking goals"),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ name, city, industry, interest, limit }) => {
        const { data, error } = await supabase
          .from("directory_profiles")
          .select("*")
          .neq("id", profile.id)
          .order("grad_year", { ascending: false });
        if (error) return { ok: false, error: error.message };

        const rows = (data as DirectoryProfile[]).filter((p) => {
          if (name && !norm(p.full_name).includes(norm(name))) return false;
          if (city && norm(p.current_city) !== norm(city)) return false;
          if (industry) {
            const t = norm(industry);
            const hay = [
              norm(p.industry),
              ...p.interests,
              ...p.networking_goals,
            ].map(norm);
            if (!hay.some((h) => h.includes(t) || t.includes(h)))
              return false;
          }
          if (interest) {
            const t = norm(interest);
            const hay = [...p.interests, ...p.networking_goals].map(fmt);
            if (!hay.some((h) => h.includes(t) || t.includes(h))) return false;
          }
          return true;
        });

        await logEngagement("concierge_tool", profile.id, {
          tool: "search_alumni",
          name,
          city,
          industry,
          interest,
          results: rows.length,
        });
        return {
          ok: true,
          count: rows.length,
          alumni: rows.slice(0, limit).map(summarize),
        };
      },
    }),

    list_events: tool({
      description:
        "List upcoming alumni events for a city. Default to the user's current city when not specified.",
      inputSchema: z.object({
        city: z.string().optional(),
        days_ahead: z.number().int().min(1).max(90).default(30),
      }),
      execute: async ({ city, days_ahead }) => {
        const target = city ?? profile.current_city ?? "";
        const until = new Date(
          Date.now() + days_ahead * 24 * 60 * 60 * 1000,
        ).toISOString();
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .ilike("city", target)
          .gte("starts_at", new Date().toISOString())
          .lte("starts_at", until)
          .order("starts_at", { ascending: true })
          .limit(8);
        if (error) return { ok: false, error: error.message };
        await logEngagement("concierge_tool", profile.id, {
          tool: "list_events",
          city: target,
          results: (data as Event[]).length,
        });
        return {
          ok: true,
          city: target,
          events: (data as Event[]).map((e) => ({
            title: e.title,
            when: e.starts_at,
            where: e.venue,
            neighborhood: e.neighborhood,
            about: e.description,
          })),
        };
      },
    }),

    list_city_resources: tool({
      description:
        "List local alumni resources (clubs, group chats, career links) for a city.",
      inputSchema: z.object({
        city: z.string().optional(),
      }),
      execute: async ({ city }) => {
        const target = city ?? profile.current_city ?? "";
        const { data, error } = await supabase
          .from("city_resources")
          .select("*")
          .ilike("city", target)
          .limit(10);
        if (error) return { ok: false, error: error.message };
        await logEngagement("concierge_tool", profile.id, {
          tool: "list_city_resources",
          city: target,
          results: (data as CityResource[]).length,
        });
        return {
          ok: true,
          city: target,
          resources: (data as CityResource[]).map((r) => ({
            name: r.name,
            type: r.type,
            url: r.url,
            about: r.description,
          })),
        };
      },
    }),

    propose_match: tool({
      description:
        "Propose an introduction to an alumni from search_alumni results (pass their alumni_id). Creates a double opt-in request: the introduction only proceeds if the counterpart also accepts. Only call when the user explicitly asked for an introduction to that person.",
      inputSchema: z.object({
        alumni_id: z.string().describe("alumni_id from a search_alumni result"),
      }),
      execute: async ({ alumni_id }) => {
        const result = await requestIntro({
          initiator: profile,
          alumniId: alumni_id,
          channel,
        });
        if (!result.ok) return result;
        return {
          ok: true,
          counterpart_first_name: result.counterpartName.split(" ")[0],
          message: result.message,
        };
      },
    }),
  };
}
