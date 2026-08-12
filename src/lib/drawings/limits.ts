/**
 * Vercel caps serverless function request AND response bodies at 4.5 MB, so a
 * document above that becomes both unsaveable and unloadable.
 *
 * The guard sits below the cap to leave room for JSON overhead and headers.
 * Documents only grow this large when images are embedded as base64 data URLs,
 * which is what tldraw does by default — configuring object storage moves
 * images out of the document and keeps it in the kilobytes.
 *
 * Shared by client and server, so it must not import anything server-only.
 */
const MAX_DOCUMENT_BYTES = 4_000_000

/** Point at which the UI starts warning, before saving actually breaks. */
const WARN_DOCUMENT_BYTES = 3_000_000

const documentByteSize = (document: unknown): number =>
  new TextEncoder().encode(JSON.stringify(document)).length

export { MAX_DOCUMENT_BYTES, WARN_DOCUMENT_BYTES, documentByteSize }
