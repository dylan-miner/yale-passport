# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@apps/web/AGENTS.md

## Overview

Passport is an SMS-first networking MVP for Yale alumni. The whole app is a single Next.js 16 project in `apps/web`, backed by Supabase (Postgres + Auth). It uses OpenAI through the Vercel AI SDK (`ai`, `@ai-sdk/openai`) for the concierge and Twilio for SMS. Twilio is optional: the concierge also works in the app. `docs/` holds product planning documents only (.docx).

Next.js 16 has breaking changes. For example, middleware is `src/proxy.ts`, which exports `proxy()`. Check `node_modules/next/dist/docs/` before using unfamiliar APIs.

## Commands (run in `apps/web`)

- `npm run dev`: dev server on :3000
- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run seed`: resets the synthetic data (idempotent) and creates the demo user `demo@passport.yale`
- `npm run verify`: RLS and seed checks against the live Supabase project
- `npm run concierge:smoke` / `npm run match:smoke`: end-to-end HTTP tests. They need the dev server running (`APP_URL` defaults to `http://localhost:3000`) and sign in as the demo user. The concierge test spends OpenAI credits.

There is no unit test framework. The smoke scripts in `scripts/` are the tests; shared helpers live in `scripts/e2e-helpers.ts`. Env vars come from `.env.local` (see `.env.example`).

## Architecture

**Three Supabase clients, each with a different trust level** (`src/lib/supabase/`):
- `client.ts`: browser client.
- `server.ts`: server client that acts as the signed-in user, so RLS applies.
- `admin.ts`: service-role client that bypasses RLS. It is `server-only`.

`proxy.ts` refreshes the session on every request.

**Consent-gated data access lives in the database, not the app.** Each user's `profiles` row is readable only by its owner. Other alumni are visible only through the `directory_profiles` view, which uses `has_consent()`. Contact details are released only through the `get_match_contact()` RPC, and only once a match is `mutual`. Consent changes are recorded in `consent_events` by a trigger. The UI copy for the granular consent keys is in `src/lib/consents.ts`. All schema, RLS, views and RPCs are in `supabase/migrations/0001_init.sql`.

**Concierge** (`src/lib/concierge/`): `POST /api/concierge` calls `engine.ts`, which builds a system prompt from the user's profile, calls `generateText` with tools from `tools.ts`, and persists messages through `store.ts`. The available tools are: get/update profile, search alumni, list events, and list city resources. The model is set by `CONCIERGE_MODEL` (default `gpt-4o-mini`). Tools never give the model raw privileged writes. Writes are validated in server code.

**Matching** (`src/lib/matching/`): matches use double opt-in.
- Status moves `proposed` → `awaiting_counterpart` → `mutual` (or `declined` / `expired`), with separate `initiator_response` and `counterpart_response` fields.
- The routes are `/api/matches`, `/api/matches/[id]/respond`, and `/api/matches/[id]/simulate`.
- `simulator.ts` stands in for the synthetic alumni's replies.
- Match cards show only the same safe fields as the directory (`CounterpartCard`).
- Messages carry a `channel` (`sms` | `app`) so the same flow can serve both SMS and the in-app UI.

**App routes** (`src/app/`):
- `(auth)/`: login and onboarding.
- `(app)/`: the authenticated tabs, which are concierge, discover, connect and profile. Each tab follows the pattern of a server `page.tsx` that fetches data plus a client `*-view.tsx`.
- `actions/`: server actions for auth and profile.

## Migrations

Migrations are idempotent SQL files in `supabase/migrations/`, usually applied by hand in the Supabase SQL Editor. `npm run migrate` exists but needs `SUPABASE_DB_URL`, which is normally not set. Keep new migrations idempotent (`if not exists`, `create or replace`, `drop policy if exists`).
