-- This table holds encrypted cloud credentials, so it matters more here than
-- anywhere else that the Supabase anon key cannot reach it. Same mechanism as
-- 0001 and 0003: RLS on with zero policies blocks PostgREST entirely, while the
-- direct Postgres connection Drizzle uses bypasses RLS.
ALTER TABLE "storage_credentials" ENABLE ROW LEVEL SECURITY;
