import "server-only"
import { requireEnv } from "@/config/env"

/**
 * Server-side configuration. `server-only` makes importing this from a client
 * component a build error rather than a silent runtime surprise.
 *
 * Presence of these variables is guaranteed by the startup check in
 * `instrumentation.ts`. Each value is still a getter so it is read on first use
 * rather than at import time — eager reads would throw during `next build`'s
 * prerender pass, which runs without credentials.
 */
const serverConfig = {
  database: {
    /** Supabase transaction pooler. Requires `prepare: false` on the client. */
    get url(): string {
      return requireEnv("DATABASE_URL")
    },
  },

  access: {
    /**
     * Who may review other users, by email.
     *
     * Deliberately environment rather than a database column: admin cannot then
     * be granted by writing a row, which removes the escalation path a boolean
     * flag would create. Required, so a misconfiguration fails at boot instead
     * of silently leaving nobody able to approve anyone.
     */
    get adminEmails(): string[] {
      return requireEnv("ADMIN_EMAILS")
        .split(",")
        .map(email => email.trim().toLowerCase())
        .filter(Boolean)
    },
  },

  workos: {
    get apiKey(): string {
      return requireEnv("WORKOS_API_KEY")
    },

    get clientId(): string {
      return requireEnv("WORKOS_CLIENT_ID")
    },

    get cookiePassword(): string {
      return requireEnv("WORKOS_COOKIE_PASSWORD")
    },
  },
} as const

export { serverConfig }
