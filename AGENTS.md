# Passport — project notes

SMS-first Yale alumni networking MVP. Next.js 16 app lives in `apps/web`.

## Deployments

- Vercel deploys automatically on `git push` to `main` (GitHub integration is
  already connected). Do NOT use the Vercel MCP for routine deployments — it
  requires an interactive email-verification flow. Only use Vercel MCP when
  strictly necessary, and warn the user before starting any auth flow.

## Commands (run inside apps/web)

- `npm run verify` — RLS + seed checks against the live Supabase project
- `npm run concierge:smoke` — end-to-end concierge test (route → engine →
  OpenAI → DB); needs the dev server running and OpenAI credits
- `npm run match:smoke` / `npm run location:smoke` — match lifecycle and
  location/trip-lifecycle HTTP smoke tests; need the dev server running
- `npm run seed` — idempotent synthetic data reset
- `npm run typecheck` / `npm run lint` / `npm run build`

## Conventions

- Supabase migrations are applied manually via the SQL Editor (idempotent
  files in `apps/web/supabase/migrations/`); there is no local CLI/db-url.
- `sb_secret_` service key is server-only (`src/lib/supabase/admin.ts`); all
  privileged writes go through server routes, never the LLM.
- Preview proxy origin for server actions is listed in
  `next.config.ts` (`serverActions.allowedOrigins`) — update it if the
  preview port changes.
