-- Supabase exposes every table in `public` through PostgREST using the project's
-- publishable anon key. This app never uses PostgREST — all access is server-side
-- over a direct Postgres connection, which bypasses RLS. Enabling RLS with zero
-- policies therefore makes the table unreachable via the anon key at no cost.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
