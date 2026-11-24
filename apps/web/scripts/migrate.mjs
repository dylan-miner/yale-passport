// Passport migration runner — applies supabase/migrations/*.sql in order and
// tracks applied files in public.schema_migrations.
//
// Usage: npm run migrate
//
// Requires SUPABASE_DB_URL in .env.local — a *session pooler* Postgres URI from
// Supabase Dashboard → Connect → "Session pooler", e.g.
//   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
//
// If SUPABASE_DB_URL is not set, prints instructions for running the pending
// migration manually in the Supabase SQL Editor instead.

import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MIGRATIONS_DIR = new URL("../supabase/migrations/", import.meta.url);

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  const files = (await readdir(MIGRATIONS_DIR)).sort();
  console.log(
    [
      "SUPABASE_DB_URL is not set — cannot run migrations from the CLI.",
      "",
      "Either add the session-pooler Postgres URI to .env.local, or run the",
      "pending file(s) manually in the Supabase SQL Editor:",
      "",
      ...files.map((f) => `  - supabase/migrations/${f}`),
      "",
      "https://supabase.com/dashboard/project/skrdpfylfdnlqairhmrl/sql/new",
    ].join("\n"),
  );
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false, max: 1 });

await sql`
  create table if not exists public.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`;

const applied = new Set(
  (await sql`select name from public.schema_migrations`).map((r) => r.name),
);
const files = (await readdir(MIGRATIONS_DIR))
  .filter((f) => f.endsWith(".sql"))
  .sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip  ${file} (already applied)`);
    continue;
  }
  const body = await readFile(path.join(MIGRATIONS_DIR.pathname, file), "utf8");
  console.log(`apply ${file} …`);
  await sql.unsafe(body);
  await sql`insert into public.schema_migrations (name) values (${file})`;
  ran++;
  console.log(`done  ${file}`);
}

console.log(ran === 0 ? "Nothing to apply." : `Applied ${ran} migration(s).`);
await sql.end();
