import type { AccessStatus, DbUser } from "@/db/schema"

/**
 * Access policy, in one place.
 *
 * No server-only import: `/account` renders the same rules client-side to decide
 * what to show, and duplicating the policy there would let the two drift.
 */

/** Days a declined user must wait between reapplies. */
const REAPPLY_COOLDOWN_DAYS = 7

const canUseTools = (user: Pick<DbUser, "accessStatus">): boolean =>
  user.accessStatus === "approved"

/** Banned is the only status that takes already-shared content offline. */
const isBanned = (status: AccessStatus): boolean => status === "banned"

/**
 * When a declined user may reapply, or null if they may now.
 *
 * Null until the first reapply, so a freshly declined user is not made to wait —
 * the cooldown governs successive attempts, not the first.
 */
const reapplyAvailableAt = (user: Pick<DbUser, "lastReappliedAt">): Date | null => {
  if (!user.lastReappliedAt) {
    return null
  }

  const available = new Date(user.lastReappliedAt)

  available.setDate(available.getDate() + REAPPLY_COOLDOWN_DAYS)

  return available > new Date() ? available : null
}

const canReapply = (user: Pick<DbUser, "accessStatus" | "lastReappliedAt">): boolean =>
  user.accessStatus === "declined" && reapplyAvailableAt(user) === null

/** Human-readable status, used by both the account page and the admin table. */
const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  declined: "Declined",
  banned: "Banned",
}

export {
  ACCESS_STATUS_LABELS,
  REAPPLY_COOLDOWN_DAYS,
  canReapply,
  canUseTools,
  isBanned,
  reapplyAvailableAt,
}
