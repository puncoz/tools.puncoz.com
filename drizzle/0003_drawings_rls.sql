-- Same reasoning as 0001: this app never uses PostgREST, so RLS with zero
-- policies makes the table unreachable via the project's publishable anon key,
-- while the direct Postgres connection Drizzle uses bypasses RLS as normal.
-- Authorization is enforced in the query layer, which scopes every drawing
-- read and write by user_id.
ALTER TABLE "drawings" ENABLE ROW LEVEL SECURITY;
