# tldraw Server Persistence — Implementation Plan

**Goal:** Move tldraw documents from browser IndexedDB into Postgres so drawings open on any browser or device, with multiple named drawings, an import path for existing local data, and per-account object storage for image assets.

**Status:** Phase 1 in progress. Phase 2 not started.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Sync model | Snapshot autosave, **not** `@tldraw/sync` | `@tldraw/sync` needs a persistent WebSocket server holding an in-memory `TLSocketRoom`. Vercel terminates functions, destroying the room and forcing reconnects. tldraw's reference backend is Cloudflare Durable Objects (WebSocket hibernation). Snapshot autosave is fully serverless-compatible and meets the actual requirement (cross-device, single user). |
| What is stored | `snapshot.document` only | tldraw's documented split: `document` is shapes/pages (shared), `session` is camera/selection (per-device). Session goes to `localStorage`, so the viewport does not jump between devices. |
| Asset storage | Per-account, S3-compatible | S3, Cloudflare R2 and Supabase Storage all speak the S3 API, so one client covers all three. Provider choice only changes endpoint defaults and UI hints. |
| Asset upload path | Presigned `PUT`, browser → bucket direct | Vercel caps function request **and** response bodies at 4.5 MB. Routing uploads through the server would hit it; presigned URLs bypass it entirely. |
| No storage configured | Size guard | Without object storage, tldraw embeds images as base64 in the document. Guard warns before the document approaches the 4.5 MB cap instead of failing with an opaque `413`. |
| Credentials at rest | AES-256-GCM, key from env | User-supplied cloud keys in plaintext would be a serious liability. |
| Conflict handling | Last-write-wins + `updatedAt` check | Single user. The server returns `updatedAt`; a client saving against a stale value is warned rather than silently clobbering. Full CRDT merge is out of scope. |
| Import | Explicit prompt, all legacy stores | Enumerates tldraw IndexedDB databases via `indexedDB.databases()`, falling back to the known `tools.puncoz.com` key on Firefox (which lacks that API). Explicit, so it cannot silently duplicate. **Must run in the browser holding the data — i.e. the deployed site.** |

## Non-goals

Real-time collaboration, presence cursors, offline editing, document version history, sharing drawings between users.

---

## Phase 1 — Server persistence (core ask)

### Schema

`drawings`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK, `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL, FK → `users(id)` ON DELETE CASCADE |
| `title` | text | NOT NULL, default `'Untitled'` |
| `document` | jsonb | NOT NULL — the tldraw `snapshot.document` |
| `created_at` / `updated_at` | timestamptz | NOT NULL, default `now()` |
| `last_opened_at` | timestamptz | nullable — drives "most recent" redirect |

Index on `(user_id, updated_at desc)`. RLS enabled with no policies, matching `users`.

### Files

| File | Responsibility |
| --- | --- |
| `src/db/schema/drawings.ts` | Table + `DbDrawing` types |
| `drizzle/0002_create_drawings.sql` | Generated migration |
| `drizzle/0003_drawings_rls.sql` | RLS |
| `src/lib/drawings/queries.ts` | `listDrawings`, `getDrawing`, `createDrawing`, `saveDocument`, `renameDrawing`, `deleteDrawing` — all scoped by `userId` |
| `src/app/api/drawings/route.ts` | `GET` list, `POST` create |
| `src/app/api/drawings/[id]/route.ts` | `GET`, `PUT` (save), `PATCH` (rename), `DELETE` |
| `src/app/(tools)/draw/page.tsx` | Redirect to most recent drawing, or create the first |
| `src/app/(tools)/draw/[id]/page.tsx` | Load document server-side, render canvas |
| `src/components/tools/draw-canvas.tsx` | `createTLStore` + `loadSnapshot` + debounced autosave |
| `src/components/tools/draw/use-autosave.ts` | Debounce, retry, flush on unload, save status |
| `src/components/tools/draw/save-status.tsx` | Saved / Saving / Error indicator |
| `src/components/tools/draw/project-menu.tsx` | Real switcher: list, rename, new, delete |
| `src/components/tools/draw/import-legacy.tsx` | Legacy IndexedDB import prompt |

### Ownership rule

Every query takes `userId` and filters on it. A drawing id alone must never be enough to read or write a row — otherwise any signed-in user could read another's drawing by guessing a uuid. Route handlers derive `userId` from the session, never from the request body.

---

## Phase 2 — Per-account object storage

### Schema

`storage_credentials` (one row per user):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, UNIQUE, FK → `users(id)` ON DELETE CASCADE |
| `provider` | text | `supabase` \| `s3` \| `r2` |
| `endpoint` | text | S3-compatible endpoint |
| `region` | text | |
| `bucket` | text | |
| `access_key_id_encrypted` | text | AES-256-GCM |
| `secret_access_key_encrypted` | text | AES-256-GCM |
| `public_base_url` | text | nullable — for serving objects |
| timestamps | | |

Secrets are never returned to the client. The settings page shows only a masked hint and whether a connection test passed.

### Files

| File | Responsibility |
| --- | --- |
| `src/lib/crypto/secret-box.ts` | `encryptSecret` / `decryptSecret`, AES-256-GCM |
| `src/lib/storage/s3-client.ts` | Build an S3 client from stored credentials |
| `src/lib/storage/presign.ts` | Mint presigned `PUT` URLs |
| `src/app/api/assets/presign/route.ts` | Presign endpoint |
| `src/app/api/settings/storage/route.ts` | Save + test credentials |
| `src/app/(tools)/settings/storage/page.tsx` | Settings UI, three providers |
| `src/components/tools/draw/asset-store.ts` | `TLAssetStore` using presigned uploads |

New env var: `CREDENTIALS_ENCRYPTION_KEY` (32 bytes, base64), added to `.env.example` and `REQUIRED_ENV_VARS`.

---

## Verification

Per repo convention (no test framework): `bunx tsc --noEmit`, `bun run lint`, `bun run build`, plus live browser checks. Specifically for this feature:

1. Create a drawing, edit, reload — shapes persist.
2. Open the same drawing id in a different browser profile — same shapes.
3. Sign in as a different user, request another user's drawing id — must 404, not 200.
4. Import prompt appears with legacy IndexedDB data present and produces a drawing with the same shapes.
5. Save-status indicator reaches "Saved"; killing the network shows "Error" and recovers on retry.
