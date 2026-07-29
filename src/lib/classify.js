/**
 * Move classification and accuracy scoring.
 *
 * Everything is derived from *win probability*, not from raw centipawns.
 * Losing 100cp when the eval is 0.00 is a serious error; losing 100cp when
 * you are already +9 is meaningless. Centipawn-based grading is why simple
 * implementations flag half a game as "blunder".
 *
 * The win% and accuracy formulas are lichess's published model
 * (github.com/lichess-org/lila — WinPercent.scala / AccuracyPercent.scala).
 */

export const CLASSES = {
  brilliant: { label: 'Brilliant', short: '!!', color: '#2ab9ae' },
  great: { label: 'Great', short: '!', color: '#5b8bb0' },
  best: { label: 'Best', short: '★', color: '#95bb4a' },
  excellent: { label: 'Excellent', short: '✓', color: '#96bc4b' },
  good: { label: 'Good', short: '✓', color: '#8ba36f' },
  book: { label: 'Book', short: '▣', color: '#a88865' },
  forced: { label: 'Forced', short: '=', color: '#8f9296' },
  inaccuracy: { label: 'Inaccuracy', short: '?!', color: '#f7c631' },
  mistake: { label: 'Mistake', short: '?', color: '#e58f2a' },
  miss: { label: 'Miss', short: '✗', color: '#ee6b55' },
  blunder: { label: 'Blunder', short: '??', color: '#ca3431' },
}

/** Order used by the summary table. */
export const CLASS_ORDER = [
  'brilliant', 'great', 'best', 'excellent', 'good', 'book',
  'forced', 'inaccuracy', 'mistake', 'miss', 'blunder',
]

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Mate is mapped onto a centipawn score far outside the sigmoid's range. */
export function toCp({ score, mate }) {
  if (mate != null) return mate > 0 ? 10000 : -10000
  if (score == null) return 0
  return Math.round(score * 100)
}

/** Win probability for White, 0-100. */
export function winPercent(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

/** Same, but from the point of view of the side that is about to move. */
export function winPercentFor(color, cp) {
  const white = winPercent(cp)
  return color === 'w' ? white : 100 - white
}

/** Per-move accuracy from the win% the mover gave away. */
export function moveAccuracy(lost) {
  const value = 103.1668 * Math.exp(-0.04354 * lost) - 3.1669
  return Math.max(0, Math.min(100, value))
}

/**
 * Game accuracy: volatility-weighted mean averaged with the harmonic mean.
 * Weighting by volatility stops a long, quiet endgame from inflating the
 * score of a game that was decided by two wild middlegame moves.
 */
export function gameAccuracy(accuracies, winPercents) {
  if (accuracies.length === 0) return null

  const window = Math.max(2, Math.min(8, Math.floor(winPercents.length / 10)))
  const weights = accuracies.map((_, i) => {
    const slice = winPercents.slice(Math.max(0, i - window), i + window + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length
    return Math.max(0.5, Math.min(12, Math.sqrt(variance)))
  })

  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const weighted = accuracies.reduce((sum, a, i) => sum + a * weights[i], 0) / totalWeight
  const harmonic =
    accuracies.length / accuracies.reduce((sum, a) => sum + 1 / Math.max(a, 1), 0)

  return Math.max(0, Math.min(100, (weighted + harmonic) / 2))
}

/** Material balance in pawns, from `color`'s point of view. */
export function materialBalance(fen, color) {
  let balance = 0
  for (const ch of fen.split(' ')[0]) {
    if (!/[pnbrq]/i.test(ch)) continue
    const value = PIECE_VALUE[ch.toLowerCase()]
    balance += (ch === ch.toUpperCase() ? 1 : -1) * value
  }
  return color === 'w' ? balance : -balance
}

/**
 * A sacrifice, judged on the engine's own reply rather than on a static
 * heuristic: play the opponent's best answer and see whether the mover is
 * materially worse off than before the move.
 */
function isSacrifice({ fenBefore, fenAfter, replyFen, color }) {
  const before = materialBalance(fenBefore, color)
  const after = materialBalance(replyFen ?? fenAfter, color)
  return before - after >= 2
}

/**
 * Grade one move.
 *
 * `before` / `after` are engine evaluations (White's point of view) of the
 * positions either side of the move; `lines` are the multi-PV results for the
 * position *before* the move, used to detect "the only good move".
 */
export function classifyMove({
  color,
  playedUci,
  bestUci,
  replyUci,
  before,
  after,
  secondBest,
  isBook,
  legalMoveCount,
  fenBefore,
  fenAfter,
  replyFen,
}) {
  if (isBook) return 'book'
  if (legalMoveCount === 1) return 'forced'

  const cpBefore = toCp(before)
  const cpAfter = toCp(after)
  const winBefore = winPercentFor(color, cpBefore)
  const winAfter = winPercentFor(color, cpAfter)
  const lost = Math.max(0, winBefore - winAfter)

  const playedBest = playedUci === bestUci
  const moverCpAfter = color === 'w' ? cpAfter : -cpAfter
  const moverCpBefore = color === 'w' ? cpBefore : -cpBefore

  // Brilliant: a sound sacrifice.
  //
  // The opponent's best answer must capture the piece that just moved. Without
  // that check any move that happens to leave material loose gets flagged —
  // in a drawn endgame giving a piece away often does not move the evaluation
  // at all, and every such move would read as a brilliancy.
  const replyTakesTheSacrifice =
    replyUci != null && playedUci != null && replyUci.slice(2, 4) === playedUci.slice(2, 4)

  // The "not already winning" guard has to be measured in *material*, not in
  // evaluation: a sound combination is precisely a position whose evaluation
  // is already high because the sacrifice is on the board. Gating on the
  // evaluation would reject every real brilliancy and keep only the noise.
  if (
    playedBest &&
    replyTakesTheSacrifice &&
    moverCpAfter >= -30 &&
    materialBalance(fenBefore, color) < 5 &&
    isSacrifice({ fenBefore, fenAfter, replyFen, color })
  ) {
    return 'brilliant'
  }

  // Great: the only move that held the position — everything else drops a lot.
  // Skipped once the game is decided, where "only move" is usually just a
  // forced recapture on the way to a win that was never in doubt.
  if (playedBest && secondBest != null && Math.abs(moverCpBefore) < 600) {
    const secondWin = winPercentFor(color, toCp(secondBest))
    if (winBefore - secondWin >= 15) return 'great'
  }

  // The engine's own first choice can never be an error. If the evaluation
  // still drops after it, that is search instability in the *previous*
  // position — blaming the player for it is how a review ends up calling a
  // forced recapture a mistake.
  if (playedBest) return 'best'

  // Miss: a win was on the board and the move let it go.
  if (moverCpBefore >= 300 && moverCpAfter < 100 && lost >= 10) return 'miss'

  if (lost >= 20) return 'blunder'
  if (lost >= 10) return 'mistake'
  if (lost >= 5) return 'inaccuracy'
  if (lost >= 2) return 'good'
  return 'excellent'
}
