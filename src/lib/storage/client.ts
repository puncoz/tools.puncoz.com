import "server-only"
import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { PROVIDERS, type StorageProvider } from "@/lib/storage/providers"

/** Long enough for a slow upload of a large image, short enough to be useless if leaked. */
const UPLOAD_URL_TTL_SECONDS = 600

/** Refreshed on each render, so it only has to outlive the page view. */
const DOWNLOAD_URL_TTL_SECONDS = 3_600

type StorageConfig = {
  provider: StorageProvider
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl: string | null
}

const createClient = (config: StorageConfig): S3Client =>
  new S3Client({
    region: config.region,
    // Blank endpoint means AWS defaults, which the SDK derives from the region.
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    forcePathStyle: PROVIDERS[config.provider].forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

/**
 * A presigned PUT, so the browser uploads straight to the bucket.
 *
 * This is the whole point of the design: Vercel caps function request bodies at
 * 4.5 MB, and routing image uploads through the server would hit that. Nothing
 * but the signature passes through the app.
 */
const presignUpload = async (
  config: StorageConfig,
  key: string,
  contentType: string,
): Promise<string> =>
  getSignedUrl(
    createClient(config),
    new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  )

/** Lets the bucket stay private: a fresh signed URL is minted per render. */
const presignDownload = async (config: StorageConfig, key: string): Promise<string> =>
  getSignedUrl(
    createClient(config),
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  )

type TestResult = { ok: true } | { ok: false, error: string }

/**
 * Verifies credentials before they are saved, so a typo surfaces in settings
 * rather than as a broken image later.
 */
const testConnection = async (config: StorageConfig): Promise<TestResult> => {
  try {
    await createClient(config).send(new HeadBucketCommand({ Bucket: config.bucket }))

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed"

    // The SDK's raw messages are cryptic; name the likely cause instead.
    if (/403|Forbidden|SignatureDoesNotMatch|InvalidAccessKeyId/i.test(message)) {
      return { ok: false, error: "Access denied — check the access key, secret and bucket permissions." }
    }

    if (/404|NoSuchBucket|NotFound/i.test(message)) {
      return { ok: false, error: `Bucket "${config.bucket}" not found at that endpoint.` }
    }

    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) {
      return { ok: false, error: "Endpoint host could not be resolved — check the endpoint URL." }
    }

    return { ok: false, error: message }
  }
}

export { presignDownload, presignUpload, testConnection }
export type { StorageConfig, TestResult }
