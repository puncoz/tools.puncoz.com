import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations run over the direct connection, not the transaction pooler.
    //
    // This is the one place outside `src/config` that touches `process.env`, and
    // deliberately so: this file is loaded by the drizzle-kit CLI, not by Next.
    // `@/config/server` imports `server-only`, which throws outside a React
    // Server Component, and its getters throw on missing vars — but
    // `drizzle-kit generate` must work with no database configured at all.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
})
