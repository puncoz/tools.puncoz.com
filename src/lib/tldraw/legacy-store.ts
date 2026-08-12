/**
 * Reads drawings out of tldraw's local IndexedDB storage.
 *
 * Before server persistence, `<Tldraw persistenceKey="...">` wrote everything to
 * IndexedDB. These helpers read those databases directly so existing drawings
 * can be imported without mounting a hidden editor for each one.
 *
 * Constants mirror `@tldraw/editor`'s `LocalIndexedDb`: databases are named
 * `TLDRAW_DOCUMENT_v2<persistenceKey>`, with `records` and `schema` object
 * stores, and tldraw keeps an index of the names it has created in
 * localStorage.
 *
 * Browser-only — every entry point touches `indexedDB` or `localStorage`.
 */

const STORE_PREFIX = "TLDRAW_DOCUMENT_v2"
const DB_NAME_INDEX_KEY = "TLDRAW_DB_NAME_INDEX_v2"
const RECORDS_TABLE = "records"
const SCHEMA_TABLE = "schema"

/** The `document` half of a tldraw snapshot, as `loadSnapshot` expects it. */
type LegacyDocument = {
  store: Record<string, unknown>
  schema: unknown
}

type LegacyDrawing = {
  dbName: string
  /** The original persistenceKey, used as the imported drawing's title. */
  persistenceKey: string
  shapeCount: number
  document: LegacyDocument
}

const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const namesFromLocalStorage = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DB_NAME_INDEX_KEY) ?? "[]")

    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string") : []
  } catch {
    return []
  }
}

/**
 * Every tldraw document database in this browser.
 *
 * Both sources are merged deliberately: `indexedDB.databases()` does not exist
 * in Firefox, and tldraw's localStorage index can list databases that were
 * since deleted. The union is checked for real data when each is opened.
 */
const listLegacyDatabaseNames = async (): Promise<string[]> => {
  const names = new Set(namesFromLocalStorage())

  if (typeof indexedDB.databases === "function") {
    try {
      for (const { name } of await indexedDB.databases()) {
        if (name) {
          names.add(name)
        }
      }
    } catch {
      // Ignore — the localStorage index is enough.
    }
  }

  return [...names].filter(name => name.startsWith(STORE_PREFIX))
}

const openExisting = (dbName: string): Promise<IDBDatabase | null> =>
  new Promise(resolve => {
    const request = indexedDB.open(dbName)
    let created = false

    // Fires only when the database did not exist, meaning the name came from a
    // stale index entry. The empty database we just made is removed again.
    request.onupgradeneeded = () => {
      created = true
    }

    request.onsuccess = () => {
      const db = request.result

      if (created || !db.objectStoreNames.contains(RECORDS_TABLE)) {
        db.close()
        indexedDB.deleteDatabase(dbName)
        resolve(null)

        return
      }

      resolve(db)
    }

    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })

const readLegacyDrawing = async (dbName: string): Promise<LegacyDrawing | null> => {
  const db = await openExisting(dbName)

  if (!db) {
    return null
  }

  try {
    if (!db.objectStoreNames.contains(SCHEMA_TABLE)) {
      return null
    }

    const tx = db.transaction([RECORDS_TABLE, SCHEMA_TABLE], "readonly")
    const records = await promisify<unknown[]>(tx.objectStore(RECORDS_TABLE).getAll())
    const schema = await promisify<unknown>(tx.objectStore(SCHEMA_TABLE).get(SCHEMA_TABLE))

    if (records.length === 0 || !schema) {
      return null
    }

    // tldraw stores records as a flat array; a snapshot keys them by id.
    const store: Record<string, unknown> = {}
    let shapeCount = 0

    for (const record of records) {
      const typed = record as { id?: unknown, typeName?: unknown }

      if (typeof typed.id === "string") {
        store[typed.id] = record

        if (typed.typeName === "shape") {
          shapeCount += 1
        }
      }
    }

    // A document with pages but no shapes is not worth importing.
    if (shapeCount === 0) {
      return null
    }

    return {
      dbName,
      persistenceKey: dbName.slice(STORE_PREFIX.length),
      shapeCount,
      document: { store, schema },
    }
  } catch {
    return null
  } finally {
    db.close()
  }
}

/** Every legacy drawing in this browser that actually contains shapes. */
const findLegacyDrawings = async (): Promise<LegacyDrawing[]> => {
  const names = await listLegacyDatabaseNames()
  const results = await Promise.all(names.map(readLegacyDrawing))

  return results.filter((drawing): drawing is LegacyDrawing => drawing !== null)
}

export { findLegacyDrawings, listLegacyDatabaseNames }
export type { LegacyDrawing }
