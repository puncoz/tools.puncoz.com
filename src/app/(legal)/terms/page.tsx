import type { Metadata } from "next"
import type { FunctionComponent } from "react"
import PageShell from "@/components/ui/page-shell"
import { prose } from "@/components/ui/prose"
import { clientConfig } from "@/config/client"

/**
 * Deliberately has no governing-law or venue clause. Naming a jurisdiction is
 * only worth doing if you would actually litigate there, and for a personal
 * project the honest answer is that disputes get sorted out by email. Adding
 * one later is a decision, not an omission to tidy up.
 */

const LAST_UPDATED = "19 August 2026"

export const metadata: Metadata = {
  // The wordmark is appended by the root layout's title template.
  title: "Terms",
  description: "The terms for using this site: what it is, what is expected of you, and what is not promised.",
}

const TermsPage: FunctionComponent = () => {
  const email = clientConfig.app.contactEmail

  return (
    <PageShell crumbs={["Terms"]}>
      <article className={prose}>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Terms of service</h1>

        {/* See the note in the privacy page: the prose descendant rules win. */}
        <p>Last updated {LAST_UPDATED}</p>

        <h2>The short version</h2>

        <p>
          This is a personal side project offered free and as-is. Access is granted by approval and
          can be withdrawn. Your work stays yours. There is no uptime promise and no support desk,
          so keep your own copies of anything that matters. Be reasonable with it and nothing here
          will surprise you.
        </p>

        <h2>What this is</h2>

        <p>
          {clientConfig.app.name} is a small collection of tools run by one person for personal use
          and shared with a handful of others. It is not a commercial product, there is no paid
          tier, and it carries none of the guarantees a paid service would.
        </p>

        <h2>Getting in is by approval</h2>

        <p>
          Signing in creates an account; it does not grant access. New accounts start
          as <strong>pending</strong> and stay that way until approved. Access may be declined or
          withdrawn at any time, with or without a reason given, and a note explaining the decision
          will usually be attached where you can read it on your account page. If your access is
          declined you may reapply, subject to a cooldown between attempts.
        </p>

        <h2>Your account</h2>

        <p>
          Use an email address you actually control, and keep access to it secure — whoever can
          receive mail at that address can generally get into the account. Do not share your account
          with other people; if someone else needs access, they can ask for their own. Tell
          us at <a href={`mailto:${email}`}>{email}</a> if you think your account has been used
          without your permission.
        </p>

        <h2>What you may not do</h2>

        <ul>
          <li>Anything illegal, or storing content it is illegal to possess or distribute.</li>
          <li>Uploading malware, or using a drawing or share link to deliver it.</li>
          <li>
            Trying to reach another account&apos;s data, defeat the approval system, or find your way
            around the limits on what a signed-out visitor can see.
          </li>
          <li>
            Automated or bulk use that degrades the service for others — scripted request floods,
            scraping, or using the storage as a general-purpose file host.
          </li>
          <li>Harassment, or content that exists to abuse or threaten someone.</li>
        </ul>

        <p>
          Any of these can end your access immediately, without the note or cooldown that a normal
          decline would come with.
        </p>

        <h2>Your content stays yours</h2>

        <p>
          You keep every right you have in the drawings and files you create here. Running the
          service requires a narrow permission and no more: to store your content, back it up, and
          display it back to you — and, if you switch on a share link, to display that drawing to
          people holding the link. That permission exists only to operate the site, ends when you
          delete the content, and covers nothing else. Your work will not be used to train anything,
          shown to anyone else, or published.
        </p>

        <p>
          You are responsible for what you put here, including having the right to use any images
          you upload.
        </p>

        <h2>Share links</h2>

        <p>
          Turning on sharing for a drawing makes it readable by anyone with the link, with no
          sign-in. The link is the permission, so anyone you send it to can pass it on. Revoke it
          from the share controls when you are done. Once something has been visible on a public
          link, it is beyond recall — assume it may have been copied.
        </p>

        <h2>Storage you connect</h2>

        <p>
          If you point the draw tool at your own S3, R2 or Supabase Storage bucket, that account
          stays yours and stays under your provider&apos;s terms and pricing. You are responsible
          for its configuration, its contents and its bills. The credentials you enter are encrypted
          here and used only to upload and read back your own assets.
        </p>

        <h2>What is not promised</h2>

        <p>
          There is no uptime guarantee, no support commitment and no response time. Tools may change
          or be removed, and the whole site may be shut down. Reasonable notice will be given before
          a planned shutdown, but a personal project can also break unexpectedly and stay broken
          until someone has an evening free. <strong>Keep your own copies of anything you would
          mind losing.</strong>
        </p>

        <h2>Ending it</h2>

        <p>
          You can stop using the site whenever you like, and ask
          at <a href={`mailto:${email}`}>{email}</a> for your account and its contents to be deleted.
          Access here may also be suspended or ended, as described above. Deleting a drawing moves
          it to the trash first; it is only destroyed when you delete it permanently or empty the
          trash. Deletion of an account is permanent, so export what you want to keep beforehand.
        </p>

        <h2>Services this runs on</h2>

        <p>
          Sign-in is handled by WorkOS, the database by Supabase, hosting by Vercel, and the canvas
          is built on tldraw. Using this site means your use also touches those services, and their
          terms apply to their parts. None of them is under this project&apos;s control.
        </p>

        <h2>No warranty, and limited liability</h2>

        <p>
          The service is provided <strong>as is</strong>, without warranty of any kind, express or
          implied — including that it will be available, error-free, or fit for any particular
          purpose. To the fullest extent the law allows, the person running this site is not liable
          for any lost data, lost work, lost profits, or any indirect or consequential damage
          arising from using it or being unable to use it. Nothing here limits liability that cannot
          be limited by law.
        </p>

        <h2>Changes</h2>

        <p>
          These terms may change; the date at the top will change with them. Continuing to use the
          site after a change means accepting it. If a change is significant, active accounts will
          be told by email.
        </p>

        <h2>Problems</h2>

        <p>
          No court or jurisdiction is named here on purpose. If something goes wrong,
          email <a href={`mailto:${email}`}>{email}</a> and it will be sorted out directly — for a
          free project run by one person, that is the realistic remedy, and pretending otherwise
          would not make it truer.
        </p>

        <p>
          See also the <a href="/privacy">privacy policy</a>, which covers what is stored and who
          can see it.
        </p>
      </article>
    </PageShell>
  )
}

export default TermsPage
