/**
 * Supported object storage providers.
 *
 * All three speak the S3 API, so there is one client implementation. A provider
 * only decides endpoint shape, path-style addressing, and the guidance shown in
 * settings.
 *
 * Shared by client and server — no server-only imports.
 */

const STORAGE_PROVIDERS = ["supabase", "s3", "r2"] as const

type StorageProvider = (typeof STORAGE_PROVIDERS)[number]

type ProviderInfo = {
  label: string
  /** Custom endpoints require path-style addressing; AWS uses virtual-hosted. */
  forcePathStyle: boolean
  endpointPlaceholder: string
  regionPlaceholder: string
  publicBaseUrlPlaceholder: string
  /** Where the user gets S3 credentials for this provider. */
  credentialsHint: string
}

const PROVIDERS: Record<StorageProvider, ProviderInfo> = {
  supabase: {
    label: "Supabase Storage",
    forcePathStyle: true,
    endpointPlaceholder: "https://<project-ref>.supabase.co/storage/v1/s3",
    regionPlaceholder: "ap-northeast-2",
    publicBaseUrlPlaceholder: "https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>",
    credentialsHint: "Project Settings → Storage → S3 access keys. Region must match the project's region.",
  },
  s3: {
    label: "Amazon S3",
    forcePathStyle: false,
    endpointPlaceholder: "Leave blank to use AWS defaults",
    regionPlaceholder: "us-east-1",
    publicBaseUrlPlaceholder: "https://<bucket>.s3.<region>.amazonaws.com",
    credentialsHint: "IAM user with s3:PutObject and s3:GetObject on the bucket.",
  },
  r2: {
    label: "Cloudflare R2",
    forcePathStyle: true,
    endpointPlaceholder: "https://<account-id>.r2.cloudflarestorage.com",
    regionPlaceholder: "auto",
    publicBaseUrlPlaceholder: "https://pub-<hash>.r2.dev  (or your custom domain)",
    credentialsHint: "R2 → Manage API tokens → Create an S3-compatible token. Region is always \"auto\".",
  },
}

const isStorageProvider = (value: unknown): value is StorageProvider =>
  typeof value === "string" && (STORAGE_PROVIDERS as readonly string[]).includes(value)

export { PROVIDERS, STORAGE_PROVIDERS, isStorageProvider }
export type { ProviderInfo, StorageProvider }
