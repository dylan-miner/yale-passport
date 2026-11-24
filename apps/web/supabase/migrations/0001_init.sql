-- Passport MVP — initial schema
-- Idempotent: safe to re-run (create if not exists / create or replace / drop policy if exists).

-- ---------- helpers ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- tables ----------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null for synthetic alumni
  full_name text not null,
  grad_year int not null,
  personal_email text,
  phone_e164 text,
  home_city text not null,
  current_city text not null,
  industry text,
  company text,
  role_title text,
  linkedin_url text,
  portfolio_url text,
  interests text[] not null default '{}',
  networking_goals text[] not null default '{}',
  availability_text text,
  is_synthetic boolean not null default false,
  responsiveness_score numeric not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_user_id_key on public.profiles (user_id);
create unique index if not exists profiles_personal_email_key on public.profiles (personal_email);
create index if not exists profiles_current_city_idx on public.profiles (current_city);

create table if not exists public.consents (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  key text not null check (key in (
    'sms_opt_in',          -- may we text this person
    'location_detection',  -- may we detect/ask about city changes
    'directory_visibility',-- appear in the opt-in alumni directory
    'introductions',       -- receive/offer 1:1 introductions
    'yaa_sharing'          -- share contact info with the alumni association
  )),
  granted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (profile_id, key)
);

create table if not exists public.consent_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  granted boolean not null,
  source text not null default 'app',
  created_at timestamptz not null default now()
);

create index if not exists consent_events_profile_idx on public.consent_events (profile_id);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references public.profiles(id) on delete cascade,
  counterpart_id uuid not null references public.profiles(id) on delete cascade,
  context text not null default 'proactive' check (context in ('proactive', 'requested')),
  status text not null default 'proposed'
    check (status in ('proposed', 'awaiting_counterpart', 'mutual', 'declined', 'expired')),
  initiator_response text not null default 'pending'
    check (initiator_response in ('pending', 'accepted', 'declined')),
  counterpart_response text not null default 'pending'
    check (counterpart_response in ('pending', 'accepted', 'declined')),
  match_reason text,
  shared_interests jsonb not null default '[]',
  intro_draft text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (initiator_id <> counterpart_id)
);

create index if not exists matches_initiator_idx on public.matches (initiator_id);
create index if not exists matches_counterpart_idx on public.matches (counterpart_id);
create index if not exists matches_status_idx on public.matches (status);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('concierge', 'match')),
  match_id uuid references public.matches(id) on delete cascade,
  profile_a uuid not null references public.profiles(id) on delete cascade,
  profile_b uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists conversations_a_idx on public.conversations (profile_a);
create index if not exists conversations_b_idx on public.conversations (profile_b);
create index if not exists conversations_match_idx on public.conversations (match_id);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'alum', 'concierge')),
  sender_profile_id uuid references public.profiles(id) on delete set null,
  channel text not null check (channel in ('sms', 'app')),
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  twilio_sid text,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

create table if not exists public.city_resources (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  name text not null,
  type text not null check (type in ('club', 'group_chat', 'contact', 'link')),
  url text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists city_resources_city_idx on public.city_resources (city);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  neighborhood text,
  venue text,
  url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists events_city_idx on public.events (city, starts_at);

create table if not exists public.location_signals (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  source text not null check (source in ('ip', 'manual', 'sms', 'browser')),
  kind text not null default 'unknown' check (kind in ('travel', 'relocation', 'unknown')),
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists location_signals_profile_idx on public.location_signals (profile_id);

create table if not exists public.engagement_events (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  type text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists engagement_events_profile_idx on public.engagement_events (profile_id, type);

-- ---------- helpers (after tables: sql-language bodies are validated eagerly) ----------

-- Current caller's profile id (null if none). Security definer so it can be
-- used inside RLS policies without recursion into profiles' own policies.
create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid() limit 1
$$;

-- Consent check used by views/policies for OTHER profiles (bypasses consents RLS).
create or replace function public.has_consent(p_profile_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select granted from public.consents
     where profile_id = p_profile_id and key = p_key),
    false)
$$;

-- ---------- triggers ----------

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists matches_updated_at on public.matches;
create trigger matches_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

create or replace function public.log_consent_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.consent_events (profile_id, key, granted, source)
  values (new.profile_id, new.key, new.granted, 'app');
  return new;
end $$;

drop trigger if exists consents_audit on public.consents;
create trigger consents_audit
  after insert or update on public.consents
  for each row execute function public.log_consent_change();

-- ---------- views / functions for consent-gated access ----------

-- Directory: safe fields only, only for profiles opted into directory visibility.
create or replace view public.directory_profiles as
select
  p.id,
  p.full_name,
  p.grad_year,
  p.current_city,
  p.industry,
  p.company,
  p.role_title,
  p.linkedin_url,
  p.interests,
  p.networking_goals
from public.profiles p
where public.has_consent(p.id, 'directory_visibility');

revoke all on public.directory_profiles from anon;
grant select on public.directory_profiles to authenticated;

-- Contact release: only for the counterpart of a mutual match, and only
-- when the caller is a participant in that match.
create or replace function public.get_match_contact(p_match_id uuid)
returns table (
  full_name text,
  personal_email text,
  phone_e164 text,
  linkedin_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.matches%rowtype;
  caller uuid;
  other uuid;
begin
  caller := public.my_profile_id();
  if caller is null then
    return;
  end if;

  select * into m from public.matches where id = p_match_id;
  if not found or m.status <> 'mutual' then
    return;
  end if;
  if caller <> m.initiator_id and caller <> m.counterpart_id then
    return;
  end if;

  other := case when m.initiator_id = caller
                then m.counterpart_id else m.initiator_id end;

  return query
    select p.full_name, p.personal_email, p.phone_e164, p.linkedin_url
    from public.profiles p
    where p.id = other;
end $$;

revoke execute on function public.get_match_contact(uuid) from anon, public;
grant execute on function public.get_match_contact(uuid) to authenticated;

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.consent_events enable row level security;
alter table public.matches enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.city_resources enable row level security;
alter table public.events enable row level security;
alter table public.location_signals enable row level security;
alter table public.engagement_events enable row level security;

-- profiles: owner reads/updates own row. Directory reads go through the
-- directory_profiles view above; contact release goes through get_match_contact.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- consents: owner manages own keys.
drop policy if exists consents_select_own on public.consents;
create policy consents_select_own on public.consents
  for select to authenticated
  using (profile_id = public.my_profile_id());

drop policy if exists consents_insert_own on public.consents;
create policy consents_insert_own on public.consents
  for insert to authenticated
  with check (profile_id = public.my_profile_id());

drop policy if exists consents_update_own on public.consents;
create policy consents_update_own on public.consents
  for update to authenticated
  using (profile_id = public.my_profile_id())
  with check (profile_id = public.my_profile_id());

drop policy if exists consents_delete_own on public.consents;
create policy consents_delete_own on public.consents
  for delete to authenticated
  using (profile_id = public.my_profile_id());

-- consent_events: owner reads; writes happen via trigger or service role.
drop policy if exists consent_events_select_own on public.consent_events;
create policy consent_events_select_own on public.consent_events
  for select to authenticated
  using (profile_id = public.my_profile_id());

-- matches: participants read; all writes go through server-side API routes
-- using the service role with explicit participant authorization checks.
drop policy if exists matches_select_participant on public.matches;
create policy matches_select_participant on public.matches
  for select to authenticated
  using (initiator_id = public.my_profile_id()
      or counterpart_id = public.my_profile_id());

-- conversations: participants read.
drop policy if exists conversations_select_participant on public.conversations;
create policy conversations_select_participant on public.conversations
  for select to authenticated
  using (profile_a = public.my_profile_id()
      or profile_b = public.my_profile_id());

-- messages: participants read.
drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages
  for select to authenticated
  using (conversation_id in (
    select c.id from public.conversations c
    where c.profile_a = public.my_profile_id()
       or c.profile_b = public.my_profile_id()));

-- city resources + events: world-readable to signed-in users, writes service-only.
drop policy if exists city_resources_read on public.city_resources;
create policy city_resources_read on public.city_resources
  for select to authenticated using (true);

drop policy if exists events_read on public.events;
create policy events_read on public.events
  for select to authenticated using (true);

-- location signals: owner reads; writes service-only.
drop policy if exists location_signals_select_own on public.location_signals;
create policy location_signals_select_own on public.location_signals
  for select to authenticated
  using (profile_id = public.my_profile_id());

-- engagement_events: no authenticated policies -> service role only.

-- ---------- grants ----------

-- RLS gates rows, but roles still need table-level privileges. service_role
-- gets full access (bypasses RLS); anon/authenticated get standard CRUD
-- constrained by the policies above.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to service_role;
grant usage on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage on sequences to anon, authenticated;
alter default privileges in schema public
  grant execute on functions to service_role;
