import UserMenu from "@/components/auth/user-menu"
import InviteUserForm from "@/components/admin/invite-user-form"
import UserRowActions from "@/components/admin/user-row-actions"
import PageShell from "@/components/ui/page-shell"
import type { AccessStatus, DbUser } from "@/db/schema"
import { ACCESS_STATUS_LABELS } from "@/lib/auth/access"
// Reviewing people necessarily means loading people who are not approved, which
// is why this is one of the three places allowed past the choke point.
import { requireAdmin } from "@/lib/auth/current-user"
import { listUsers } from "@/lib/users/queries"
import { relativeTime } from "@/lib/ui/relative-time"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

/** Pending first — the only rows that need an action — then newest. */
const REVIEW_ORDER: Record<AccessStatus, number> = {
  pending: 0,
  declined: 1,
  banned: 2,
  approved: 3,
}

const statusClasses: Record<AccessStatus, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  declined: "border-border bg-muted text-muted-foreground",
  banned: "border-destructive/40 bg-destructive/10 text-destructive",
}

const displayName = (user: DbUser): string =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") || "—"

const AdminUsersPage = async () => {
  const admin = await requireAdmin()
  const users = await listUsers()
  const now = new Date()

  const sorted = [...users].sort((a, b) =>
    REVIEW_ORDER[a.accessStatus] - REVIEW_ORDER[b.accessStatus]
    || b.createdAt.getTime() - a.createdAt.getTime(),
  )

  const pendingCount = users.filter(user => user.accessStatus === "pending").length

  return (
    <PageShell crumbs={["People"]} actions={<UserMenu/>}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">People</h1>

            <p className="mt-1 text-sm text-muted-foreground">
              {users.length} {users.length === 1 ? "account" : "accounts"}
              {pendingCount > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-foreground">
                    {pendingCount} awaiting review
                  </span>
                </>
              )}
            </p>
          </div>

          <InviteUserForm/>
        </div>

        <div className="mt-8 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-4xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Latest note</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 font-medium">Last seen</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {sorted.map(user => (
                <tr key={user.id} className="border-b border-border last:border-b-0 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{displayName(user)}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>

                    {/* An invite that has never been claimed has no identity yet. */}
                    {!user.workosId && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Invited — has not signed in yet
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
                      statusClasses[user.accessStatus],
                    )}
                    >
                      {ACCESS_STATUS_LABELS[user.accessStatus]}
                    </span>
                  </td>

                  <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                    {user.accessNote || "—"}

                    {/* Their words, not a reviewer's — the one thing needed to
                        decide on a reapply, so it is shown beside the decision. */}
                    {user.reapplyMessage && (
                      <p className="mt-1.5 border-l-2 border-border pl-2 italic">
                        Asked again: “{user.reapplyMessage}”
                      </p>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {relativeTime(user.createdAt, now)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {user.lastSignInAt ? relativeTime(user.lastSignInAt, now) : "Never"}
                  </td>

                  <td className="px-4 py-3">
                    <UserRowActions
                      userId={user.id}
                      status={user.accessStatus}
                      isSelf={user.id === admin.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </PageShell>
  )
}

export default AdminUsersPage
