import "server-only"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { serverConfig } from "@/config/server"
import * as schema from "@/db/schema"

const createDatabase = () => {
  // `prepare: false` is mandatory: Supabase's transaction pooler does not
  // support prepared statements.
  const client = postgres(serverConfig.database.url, { prepare: false })

  return drizzle(client, { schema })
}

type Database = ReturnType<typeof createDatabase>

const globalForDb = globalThis as unknown as { toolsDb?: Database }

/**
 * Created on first use rather than at import time, so builds without
 * `DATABASE_URL` still succeed. Cached on `globalThis` so hot reload does not
 * leak a connection pool per edit.
 */
export const getDb = (): Database => (globalForDb.toolsDb ??= createDatabase())
