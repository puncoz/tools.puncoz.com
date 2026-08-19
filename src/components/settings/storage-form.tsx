"use client"

import { AlertTriangle, Check, Loader2, Trash2 } from "lucide-react"
import { type FunctionComponent, useState } from "react"
import { inputClasses } from "@/components/ui/input"
import { PROVIDERS, STORAGE_PROVIDERS, type StorageProvider } from "@/lib/storage/providers"
import { withProgress } from "@/lib/ui/progress"
import { cn } from "@/lib/utils"

type Settings = {
  provider: string
  endpoint: string
  region: string
  bucket: string
  accessKeyIdMasked: string
  publicBaseUrl: string | null
}

type Props = Readonly<{
  initial: Settings | null
}>

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error", message: string }

const fieldClasses = inputClasses()

const labelClasses = "block text-sm font-medium"

const StorageForm: FunctionComponent<Props> = ({ initial }) => {
  const [provider, setProvider] = useState<StorageProvider>(
    STORAGE_PROVIDERS.includes(initial?.provider as StorageProvider)
      ? initial?.provider as StorageProvider
      : "supabase",
  )
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? "")
  const [region, setRegion] = useState(initial?.region ?? "")
  const [bucket, setBucket] = useState(initial?.bucket ?? "")
  const [accessKeyId, setAccessKeyId] = useState("")
  const [secretAccessKey, setSecretAccessKey] = useState("")
  const [publicBaseUrl, setPublicBaseUrl] = useState(initial?.publicBaseUrl ?? "")
  const [configured, setConfigured] = useState(initial !== null)
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  const info = PROVIDERS[provider]

  const save = (event: React.FormEvent) => {
    event.preventDefault()

    return withProgress(async () => {
      setStatus({ kind: "saving" })

      const response = await fetch("/api/settings/storage", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          endpoint,
          region,
          bucket,
          accessKeyId,
          secretAccessKey,
          publicBaseUrl,
        }),
      })

      if (response.ok) {
        setStatus({ kind: "saved" })
        setConfigured(true)
        // Cleared once stored: there is no reason to keep secrets in the DOM.
        setAccessKeyId("")
        setSecretAccessKey("")

        return
      }

      const body = await response.json().catch(() => ({})) as { message?: string, error?: string }

      setStatus({
        kind: "error",
        message: body.message ?? body.error ?? `Request failed (${response.status})`,
      })
    })
  }

  const disconnect = () => withProgress(async () => {
    setStatus({ kind: "saving" })

    await fetch("/api/settings/storage", { method: "DELETE" })

    setConfigured(false)
    setStatus({ kind: "idle" })
    setAccessKeyId("")
    setSecretAccessKey("")
  })

  return (
    <form onSubmit={save} className="space-y-6">
      <div>
        <span className={labelClasses}>Provider</span>

        <div className="mt-2 flex flex-wrap gap-2">
          {STORAGE_PROVIDERS.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setProvider(option)}
              aria-pressed={provider === option}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                provider === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {PROVIDERS[option].label}
            </button>
          ))}
        </div>

        <p className="mt-2 text-sm text-muted-foreground">{info.credentialsHint}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={labelClasses}>Bucket</span>
          <input required value={bucket} onChange={e => setBucket(e.target.value)} className={fieldClasses}/>
        </label>

        <label className="space-y-1.5">
          <span className={labelClasses}>Region</span>
          <input
            required
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder={info.regionPlaceholder}
            className={fieldClasses}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClasses}>
          Endpoint {provider === "s3" && <span className="font-normal text-muted-foreground">(optional)</span>}
        </span>
        <input
          value={endpoint}
          onChange={e => setEndpoint(e.target.value)}
          placeholder={info.endpointPlaceholder}
          className={fieldClasses}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={labelClasses}>Access key ID</span>
          <input
            required
            value={accessKeyId}
            onChange={e => setAccessKeyId(e.target.value)}
            autoComplete="off"
            placeholder={configured ? `Saved (${initial?.accessKeyIdMasked ?? "••••"}) — re-enter to change` : ""}
            className={fieldClasses}
          />
        </label>

        <label className="space-y-1.5">
          <span className={labelClasses}>Secret access key</span>
          <input
            required
            type="password"
            value={secretAccessKey}
            onChange={e => setSecretAccessKey(e.target.value)}
            autoComplete="off"
            placeholder={configured ? "Saved — re-enter to change" : ""}
            className={fieldClasses}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClasses}>
          Public base URL <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
        <input
          value={publicBaseUrl}
          onChange={e => setPublicBaseUrl(e.target.value)}
          placeholder={info.publicBaseUrlPlaceholder}
          className={fieldClasses}
        />
        <span className="block text-sm text-muted-foreground">
          Set this only if the bucket is public. Left blank, the bucket stays private and a
          short-lived signed URL is generated each time an image is displayed.
        </span>
      </label>

      {status.kind === "error" && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true"/>
          {status.message}
        </p>
      )}

      {status.kind === "saved" && (
        <p className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <Check className="size-4" aria-hidden="true"/>
          Connection verified and saved.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status.kind === "saving"}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status.kind === "saving" && <Loader2 className="size-4 animate-spin" aria-hidden="true"/>}
          Test and save
        </button>

        {configured && (
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={status.kind === "saving"}
            className="inline-flex items-center gap-1.5 text-sm text-destructive transition-opacity hover:opacity-80 disabled:opacity-60"
          >
            <Trash2 className="size-3.5" aria-hidden="true"/>
            Disconnect
          </button>
        )}
      </div>
    </form>
  )
}

export default StorageForm
