/**
 * chess.com public API client.
 *
 * Called straight from the browser: the API sends `Access-Control-Allow-Origin: *`,
 * and a response fetched through CORS is exempt from the `Cross-Origin-Resource-Policy`
 * requirement that our COEP header otherwise imposes. So no proxy is needed —
 * which matters, because a proxy would be the only server-side piece in an
 * otherwise entirely client-side app.
 */

const BASE = 'https://api.chess.com/pub'

// Archives and months are immutable once past, so a session cache is safe and
// keeps the month picker instant.
const cache = new Map()

export class ChessComError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

/** Accepts a bare handle, a profile URL, or something pasted with spaces. */
export function normalizeUsername(input) {
  return String(input)
    .trim()
    .replace(/^https?:\/\/(www\.)?chess\.com\/(member|player)\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^@/, '')
    .toLowerCase()
}

async function getJson(url) {
  if (cache.has(url)) return cache.get(url)

  let response
  try {
    response = await fetch(url)
  } catch {
    throw new ChessComError('Could not reach chess.com. Check your connection.')
  }

  if (response.status === 404) throw new ChessComError('No such player on chess.com.', 404)
  if (response.status === 429) {
    throw new ChessComError('chess.com is rate-limiting us. Wait a moment and retry.', 429)
  }
  if (!response.ok) throw new ChessComError(`chess.com returned ${response.status}.`, response.status)

  const data = await response.json()
  cache.set(url, data)
  return data
}

/** Monthly archives, newest first. */
export async function fetchArchives(username) {
  const { archives } = await getJson(`${BASE}/player/${username}/games/archives`)

  return (archives ?? [])
    .map((url) => {
      const [, year, month] = url.match(/(\d{4})\/(\d{2})$/) ?? []
      return { url, year, month, label: `${year}-${month}` }
    })
    .reverse()
}

const RESULT_LABEL = {
  win: 'won',
  checkmated: 'checkmated',
  agreed: 'draw agreed',
  repetition: 'repetition',
  timeout: 'on time',
  resigned: 'resigned',
  stalemate: 'stalemate',
  insufficient: 'insufficient material',
  '50move': '50-move rule',
  abandoned: 'abandoned',
  timevsinsufficient: 'timeout vs insufficient',
  bughousepartnerlose: 'partner lost',
}

function outcome(game) {
  if (game.white.result === 'win') return '1-0'
  if (game.black.result === 'win') return '0-1'
  return '½-½'
}

/** One month of games, newest first, normalised to what the UI needs. */
export async function fetchMonth(archiveUrl) {
  const { games } = await getJson(archiveUrl)

  return (games ?? [])
    .map((game) => ({
      id: game.uuid ?? game.url,
      url: game.url,
      pgn: game.pgn,
      playedAt: new Date((game.end_time ?? 0) * 1000),
      white: { name: game.white.username, rating: game.white.rating },
      black: { name: game.black.username, rating: game.black.rating },
      result: outcome(game),
      // Why it ended, phrased from the loser's side as chess.com reports it.
      reason: RESULT_LABEL[game.white.result === 'win' ? game.black.result : game.white.result],
      timeClass: game.time_class,
      timeControl: game.time_control,
      rated: game.rated,
      rules: game.rules,
      // Present when chess.com has run its own review — a free cross-check.
      accuracies: game.accuracies ?? null,
    }))
    .reverse()
}
