import type { Metadata } from "next"
import StorageForm from "@/components/settings/storage-form"
import PageShell from "@/components/ui/page-shell"
import { requireDbUser } from "@/lib/auth/current-user"
import { getStorageSettings } from "@/lib/storage/queries"

export const metadata: Metadata = {
  title: "Storage",
  description: "Connect your own S3, Cloudflare R2 or Supabase Storage bucket for drawing images.",
  robots: { index: false, follow: false },
}

const StorageSettingsPage = async () => {
  const user = await requireDbUser()
  const settings = await getStorageSettings(user.id)

  return (
    <PageShell crumbs={["Settings", "Storage"]}>
        <h1 className="text-2xl font-semibold tracking-tight">Object storage</h1>

        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Connect a bucket to store images from your drawings. Without one, images are embedded
          directly in the drawing, which is capped at 4 MB — enough for shapes and text, but not
          for photos. Uploads go straight from your browser to the bucket.
        </p>

        <div className="mt-8">
          <StorageForm
            initial={settings && {
              provider: settings.provider,
              endpoint: settings.endpoint,
              region: settings.region,
              bucket: settings.bucket,
              accessKeyIdMasked: settings.accessKeyIdMasked,
              publicBaseUrl: settings.publicBaseUrl,
            }}
          />
        </div>
    </PageShell>
  )
}

export default StorageSettingsPage
