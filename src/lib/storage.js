import { openDB } from 'idb'

/**
 * Persistence layer, backed by IndexedDB.
 *
 * Everything the app knows lives in React state, which is browser memory for
 * one page load — a refresh rebuilds it from scratch and every `useState`
 * returns to its initial value. Nothing here changes that; it just writes the
 * two things that are expensive to lose somewhere durable and reads them back
 * on startup.
 *
 * IndexedDB rather than localStorage because a single review report for a long
 * game is tens of kilobytes (one record per ply), a library of them would blow
 * past localStorage's ~5 MB, and localStorage writes are synchronous — they
 * would stall the very UI thread the engine was moved off.
 */

const DB_NAME = 'gambit'
const DB_VERSION = 1

const SESSION = 'session'
const REVIEWS = 'reviews'

/** The single key under which the "what was I looking at" record is stored. */
const CURRENT = 'current'

let dbPromise = null

function db() {
  // Opened lazily and only once: the first call anywhere kicks it off, every
  // later call reuses the same promise.
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore(SESSION)
      database.createObjectStore(REVIEWS)
    },
  })
  return dbPromise
}

/**
 * Storage is a convenience, never a requirement. Private-browsing modes and
 * tightened browser settings can refuse IndexedDB outright, and a failure to
 * save a report must not take the analysis board down with it.
 */
async function safely(operation, fallback = null) {
  try {
    return await operation()
  } catch (error) {
    console.warn('[storage] unavailable:', error?.message ?? error)
    return fallback
  }
}

/**
 * Identifies a review by the exact move sequence it describes, so reopening
 * the same game finds its report and a different line does not. Reports are
 * keyed by this rather than by a game id because a review is only valid for
 * the precise moves it was computed from.
 */
export function movesKey(sanList) {
  const moves = sanList.join(' ')
  // FNV-1a: short, dependency-free, and collision resistance beyond "two
  // different games in one browser" is not needed here.
  let hash = 0x811c9dc5
  for (let i = 0; i < moves.length; i++) {
    hash ^= moves.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${sanList.length}:${(hash >>> 0).toString(36)}`
}

// --- current session ------------------------------------------------------

export function saveSession(session) {
  return safely(async () => {
    const database = await db()
    await database.put(SESSION, { ...session, savedAt: Date.now() }, CURRENT)
  })
}

export function loadSession() {
  return safely(async () => (await db()).get(SESSION, CURRENT))
}

export function clearSession() {
  return safely(async () => (await db()).delete(SESSION, CURRENT))
}

// --- review reports -------------------------------------------------------

export function saveReview(key, report) {
  return safely(async () => {
    const database = await db()
    await database.put(REVIEWS, { report, savedAt: Date.now() }, key)
  })
}

export function loadReview(key) {
  return safely(async () => {
    const record = await (await db()).get(REVIEWS, key)
    return record?.report ?? null
  })
}

/** Rough count + size, for a future "manage storage" screen. */
export function reviewCount() {
  return safely(async () => (await db()).count(REVIEWS), 0)
}
