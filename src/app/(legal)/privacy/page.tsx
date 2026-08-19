import type { Metadata } from "next"
import type { FunctionComponent } from "react"
import { clientConfig } from "@/config/client"

/**
 * Written from what the code actually does rather than from a template, so it
 * has to be reread whenever the data model changes. The specific claims that
 * will date fastest: the table of what is stored (`src/db/schema/`), the list
 * of processors, and the retention rules in `src/lib/drawings/queries.ts`.
 */

const LAST_UPDATED = "19 August 2026"

export const metadata: Metadata = {
  // The wordmark is appended by the root layout's title template.
  title: "Privacy",
  description: "What this site stores, who else can see it, and how to get it back or deleted.",
}

const PrivacyPage: FunctionComponent = () => {
  const email = clientConfig.app.contactEmail

  return (
    <article>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Privacy</h1>

      {/* Unstyled on purpose: the layout's `[&_p]` rules are descendant
          selectors, so they outrank any utility put directly on this element.
          They already render it small and muted, which is what it wants. */}
      <p>Last updated {LAST_UPDATED}</p>

      <h2>The short version</h2>

      <p>
        This is a personal project, not a company. It stores the drawings you make and the
        minimum needed to know who you are. Nothing is sold, nothing is shared with advertisers,
        and there is no cross-site tracking. Your work is private to your account unless you
        deliberately turn on a share link. If you want a copy of your data or want it gone,
        email <a href={`mailto:${email}`}>{email}</a> and ask.
      </p>

      <h2>Who runs this</h2>

      <p>
        {clientConfig.app.name} is run by one person as a personal side project. There is no
        support team behind it — the contact address below reaches an individual.
      </p>

      <h2>What is stored</h2>

      <h3>Your account</h3>

      <p>
        Signing in goes through WorkOS AuthKit. This site never sees or handles your password.
        When you sign in, a copy of your profile is kept here so pages can render without calling
        out to WorkOS on every request: your email address, whether that address is verified,
        your first and last name, a URL to your profile picture, and the time you last signed in.
      </p>

      <h3>Whether you are allowed in</h3>

      <p>
        Having an account and being allowed to use the tools are separate things. A new sign-in
        starts as <strong>pending</strong> and has to be approved. Each account therefore also
        carries its access status, the note the administrator attached to the most recent
        decision, and any message you wrote when reapplying. Those decisions are kept as an
        append-only history with timestamps, so a decision made months ago still has its reason
        attached. That history includes notes written about you by an administrator.
      </p>

      <h3>What you make</h3>

      <ul>
        <li>Each drawing&apos;s title, its full document, and when it was created and last changed.</li>
        <li>
          A preview image for the gallery. It is rendered in your browser from the drawing itself
          and stored as a small WebP.
        </li>
        <li>A share token, if you have ever switched sharing on for that drawing.</li>
        <li>Whether the drawing is in the trash, and when it was put there.</li>
      </ul>

      <p>
        Images you place on a canvas are handled one of two ways. If you have configured your own
        storage bucket, they are uploaded from your browser straight to that bucket and never pass
        through this site&apos;s servers. If you have not, they are embedded inside the drawing
        itself and so are stored in the database along with it.
      </p>

      <h3>Your storage settings, if you use them</h3>

      <p>
        The draw tool can be pointed at object storage you own — S3, Cloudflare R2 or Supabase
        Storage. Doing so stores the provider, endpoint, region, bucket name and optional public
        URL, plus the access key and secret needed to reach it. Those last two are encrypted with
        AES-256-GCM before they are written to the database and are never sent back to your
        browser, not even to fill in the settings form. You can clear them at any time
        from <strong>Settings → Storage</strong>.
      </p>

      <h3>Technical data</h3>

      <p>
        The site is hosted on Vercel, which handles requests and keeps ordinary server logs — that
        includes IP addresses, as it does for any website. Page performance and visit counts are
        measured with Vercel Analytics and Speed Insights, both of which are aggregate and
        cookieless: they do not set an identifier, do not follow you to other sites, and do not
        build a profile of you.
      </p>

      <h2>Cookies</h2>

      <p>
        One cookie, holding your encrypted sign-in session. It exists so you stay signed in
        between visits, and there is no way to offer accounts without it. There are no
        advertising cookies, no analytics cookies and no third-party trackers, which is why the
        site does not show a cookie banner.
      </p>

      <h2>Who else has access</h2>

      <p>
        Data is processed by the services this site runs on. Each holds only what it needs:
      </p>

      <ul>
        <li><strong>WorkOS</strong> — sign-in and identity. Holds your email, name and password.</li>
        <li><strong>Supabase</strong> — the Postgres database, so it holds everything described above.</li>
        <li><strong>Vercel</strong> — hosting, server logs, and the aggregate analytics.</li>
        <li>
          <strong>Your own storage bucket</strong>, if you set one up — holds the images you
          upload. It is your account with that provider, under their terms, and you control it.
        </li>
      </ul>

      <p>
        The drawing canvas itself is tldraw, which runs entirely in your browser. It does not send
        your drawings anywhere. Nobody else receives your data, and none of it is ever sold.
      </p>

      <h2>Sharing a drawing</h2>

      <p>
        Sharing is off for every drawing until you switch it on. When you do, that one drawing
        becomes readable by anyone holding the link, without signing in — the token in the URL
        is the secret, so treat the link as the permission it is. Revoking takes effect on the
        next request. Moving a shared drawing to the trash makes its link stop working, and
        restoring it makes the same link work again; deleting a drawing is not a way to unshare
        it, the share controls are.
      </p>

      <h2>How long things are kept</h2>

      <p>
        Deleting a drawing moves it to the trash rather than destroying it, so a mistake is
        recoverable. It stays there — with its document, preview and share token intact — until
        you delete it permanently or empty the trash. Nothing expires on a timer and nothing is
        purged automatically, which means nothing disappears without you asking, and also that
        anything you leave in the trash is still stored. Your account and its access history are
        kept for as long as the account exists.
      </p>

      <h2>Security</h2>

      <p>
        Everything is served over HTTPS. Storage credentials are encrypted before they are stored.
        Every query for a drawing is scoped to the account that owns it, so a drawing belonging to
        someone else answers exactly as one that does not exist. No safeguard is perfect, and this
        is a personal project rather than an audited service — please do not keep anything here
        that would genuinely hurt to lose or to leak.
      </p>

      <h2>What you can ask for</h2>

      <p>
        You can ask for a copy of what is stored about you, ask for it to be corrected, or ask for
        your account and everything in it to be deleted. Email <a href={`mailto:${email}`}>{email}</a> and
        say which. Deletion is permanent and includes your drawings, so export anything you want
        to keep first. Depending on where you live you may have further rights under laws such as
        the GDPR; the same address is where to exercise them.
      </p>

      <h2>Children</h2>

      <p>
        This site is not intended for children, and accounts are not knowingly created for anyone
        under 16.
      </p>

      <h2>Changes</h2>

      <p>
        If this policy changes, the date at the top changes with it. If a change materially
        affects what is stored or who can see it, active accounts will be told by email rather
        than left to notice.
      </p>

      <h2>Contact</h2>

      <p>
        Questions, requests or complaints: <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </article>
  )
}

export default PrivacyPage
