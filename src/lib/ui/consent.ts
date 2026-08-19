/**
 * Whether the visitor has agreed to analytics cookies.
 *
 * Three states, and the third matters: "granted", "denied", and *undecided* —
 * the banner only shows for the last one, so a decline has to be recorded as a
 * decision rather than as an absence, or the banner would return on every visit.
 *
 * Deliberately shaped like `lib/ui/theme.ts`: same storage-plus-store pattern,
 * same `useSyncExternalStore` contract, same cross-tab behaviour. Two nearly
 * identical modules beat one generic one that has to explain itself.
 */

const CONSENT_VALUES = ["granted", "denied"] as const

type Consent = typeof CONSENT_VALUES[number]

/** Also read by `consentScript` below — keep the two in step. */
const CONSENT_STORAGE_KEY = "analytics-consent"

const isConsent = (value: unknown): value is Consent =>
  typeof value === "string" && (CONSENT_VALUES as readonly string[]).includes(value)

const readStoredConsent = (): Consent | null => {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY)

    return isConsent(stored) ? stored : null
  } catch {
    // Private browsing and blocked storage both throw. Undecided is the safe
    // reading: it leaves analytics denied, which is the whole default.
    return null
  }
}

let current: Consent | null | undefined

const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) {
    listener()
  }
}

const onStorage = (event: StorageEvent) => {
  if (event.key !== null && event.key !== CONSENT_STORAGE_KEY) {
    return
  }

  current = readStoredConsent()
  emit()
}

const subscribeConsent = (listener: () => void): (() => void) => {
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage)
  }

  listeners.add(listener)

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage)
    }
  }
}

const getConsentSnapshot = (): Consent | null =>
  current === undefined ? (current = readStoredConsent()) : current

/**
 * The server cannot know the answer, and `undefined` is distinct from `null`
 * here: `null` means "asked and undecided, show the banner", `undefined` means
 * "not known yet, render nothing". Without the distinction the banner would
 * flash on every server-rendered page before hydration corrected it.
 */
const getServerConsentSnapshot = (): Consent | null | undefined => undefined

/**
 * Records a decision and tells Google about it.
 *
 * The `consent update` call is what actually changes behaviour: the page loaded
 * with `analytics_storage` denied, so gtag has been sending cookieless pings
 * until this point and starts setting cookies only from here.
 */
const setConsent = (next: Consent): void => {
  current = next

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, next)
  } catch {
    // The update below still applies for this page view; only persistence is
    // lost, so the banner returns next time. That is the safe way to fail.
  }

  window.gtag?.("consent", "update", { analytics_storage: next })

  emit()
}

/**
 * Forgets the decision, so the banner asks again.
 *
 * Analytics is put back to denied immediately rather than left as-is until the
 * next answer: withdrawing consent has to take effect when you withdraw it, not
 * when you get around to re-answering. The cookies Google already set are its to
 * expire — this stops new ones.
 */
const clearConsent = (): void => {
  current = null

  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    // Nothing to remove if it could never be written.
  }

  window.gtag?.("consent", "update", { analytics_storage: "denied" })

  emit()
}

/**
 * Sets Google's consent defaults before the tag library loads.
 *
 * Runs as a blocking inline script for the same reason the theme script does:
 * `consent default` is only meaningful if it executes before gtag.js reads
 * `dataLayer`. Setting it from an effect would mean the first pageview is
 * measured under the wrong defaults every single time.
 *
 * A stored "granted" is read here rather than applied later as an update, so a
 * returning visitor who already agreed is not counted twice — once cookielessly
 * under the default, then again after the update.
 *
 * The advertising signals are hardcoded denied. Nothing here runs ads, and a
 * default that could be flipped by a future edit is worth not having.
 */
const consentScript = `(function(){window.dataLayer=window.dataLayer||[];function g(){dataLayer.push(arguments)}window.gtag=window.gtag||g;var c="denied";try{if(localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)})==="granted")c="granted"}catch(e){}g("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:c,wait_for_update:500})})()`

export {
  clearConsent,
  consentScript,
  CONSENT_STORAGE_KEY,
  getConsentSnapshot,
  getServerConsentSnapshot,
  readStoredConsent,
  setConsent,
  subscribeConsent,
}
export type { Consent }
