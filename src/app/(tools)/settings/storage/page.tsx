import StorageForm from "@/components/settings/storage-form"
import PageHeader from "@/components/ui/page-header"
import { requireDbUser } from "@/lib/auth/current-user"
import { getStorageSettings } from "@/lib/storage/queries"

const StorageSettingsPage = async () => {
  const user = await requireDbUser()
  const settings = await getStorageSettings(user.id)

  return (
    <div className="min-h-screen">
      <PageHeader width="narrow" section="Settings · Storage"/>

      <main className="mx-auto max-w-3xl px-6 py-12">
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
      </main>
    </div>
  )
}

export default StorageSettingsPage
