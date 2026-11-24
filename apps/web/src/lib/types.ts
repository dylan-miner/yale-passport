// Row types mirroring supabase/migrations/0001_init.sql.
// Hand-maintained until we generate types with the Supabase CLI.

export const CONSENT_KEYS = [
  "sms_opt_in",
  "location_detection",
  "directory_visibility",
  "introductions",
  "yaa_sharing",
] as const;

export type ConsentKey = (typeof CONSENT_KEYS)[number];

export interface Profile {
  id: string;
  user_id: string | null;
  full_name: string;
  grad_year: number;
  personal_email: string | null;
  phone_e164: string | null;
  home_city: string;
  current_city: string;
  industry: string | null;
  company: string | null;
  role_title: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  interests: string[];
  networking_goals: string[];
  availability_text: string | null;
  is_synthetic: boolean;
  responsiveness_score: number;
  created_at: string;
  updated_at: string;
}

export interface Consent {
  profile_id: string;
  key: ConsentKey;
  granted: boolean;
  updated_at: string;
}

export interface ConsentEvent {
  id: number;
  profile_id: string;
  key: string;
  granted: boolean;
  source: string;
  created_at: string;
}

export type MatchContext = "proactive" | "requested";
export type MatchStatus =
  | "proposed"
  | "awaiting_counterpart"
  | "mutual"
  | "declined"
  | "expired";
export type MatchResponse = "pending" | "accepted" | "declined";

export interface Match {
  id: string;
  initiator_id: string;
  counterpart_id: string;
  context: MatchContext;
  status: MatchStatus;
  initiator_response: MatchResponse;
  counterpart_response: MatchResponse;
  match_reason: string | null;
  shared_interests: string[];
  intro_draft: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export type ConversationKind = "concierge" | "match";

export interface Conversation {
  id: string;
  kind: ConversationKind;
  match_id: string | null;
  profile_a: string;
  profile_b: string | null;
  created_at: string;
}

export type SenderType = "user" | "alum" | "concierge";
export type Channel = "sms" | "app";
export type Direction = "inbound" | "outbound";

export interface Message {
  id: number;
  conversation_id: string;
  sender_type: SenderType;
  sender_profile_id: string | null;
  channel: Channel;
  direction: Direction;
  body: string;
  twilio_sid: string | null;
  created_at: string;
}

export type CityResourceType = "club" | "group_chat" | "contact" | "link";

export interface CityResource {
  id: string;
  city: string;
  name: string;
  type: CityResourceType;
  url: string | null;
  description: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  city: string;
  title: string;
  description: string | null;
  starts_at: string;
  neighborhood: string | null;
  venue: string | null;
  url: string | null;
  tags: string[];
  created_at: string;
}

export type LocationSource = "ip" | "manual" | "sms" | "browser";
export type LocationKind = "travel" | "relocation" | "unknown";

export interface LocationSignal {
  id: number;
  profile_id: string;
  city: string;
  source: LocationSource;
  kind: LocationKind;
  confirmed: boolean;
  created_at: string;
}

export interface EngagementEvent {
  id: number;
  profile_id: string | null;
  type: string;
  meta: Record<string, unknown>;
  created_at: string;
}
