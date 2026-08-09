import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import StockfishEngine from '../engine/StockfishEngine'
import { toWhitePov } from '../engine/uci'
import { bookPrefix, loadOpenings, lookupOpening } from '../lib/openings'
import {
  CLASS_ORDER,
  classifyMove,
  gameAccuracy,
  materialBalance,
  moveAccuracy,
  toCp,
  winPercent,
  winPercentFor,
} from '../lib/classify'

const IDLE = { state: 'idle', done: 0, total: 0 }

/** Classifications worth spending more engine time on before we commit to them. */
const SUSPECT = new Set(['inaccuracy', 'mistake', 'miss', 'blunder', 'brilliant', 'great'])

/**
 * Pass 1 is a fixed, cheap triage over *every* position — its only job is to
 * place each move in roughly the right bucket. Pass 2 then spends the user's
 * chosen time budget re-examining only the moves that looked interesting,
 * which is where accuracy is actually decided. Scaling pass 1 with the
 * preset — the original design — meant "Balanced"/"Deep" paid full price on
 * hundreds of positions that were never going to be flagged; that was by far
 * the biggest cost in a review, for no accuracy benefit.
 */
export const SCAN_MOVETIME = 200
const SCAN_DEPTH = 18

// Book theory always grades as 'book' regardless of its eval — the number is
// only there to keep the win% graph continuous, so it doesn't need precision.
export const BOOK_MOVETIME = 60
const BOOK_DEPTH = 10

/**
 * A checkmated or stalemated position produces no engine lines at all
 * (`bestmove (none)`), which would otherwise read as 0.00 and make the mating
 * move itself look like a catastrophic blunder.
 */
function terminalEval(fen) {
  const board = new Chess(fen)
  if (board.isCheckmate()) return { score: board.turn() === 'w' ? -100 : 100, mate: null }
  if (board.isGameOver()) return { score: 0, mate: null }
  return null
}

/**
 * The mover's piece the opponent's best reply captures, if it captures
 * anything at all. This only catches an immediate recapture — a deeper
 * combination (fork, discovered attack) two moves out won't be named — but
 * that covers the large majority of real blunders, which is what the
 * explanation panel is for.
 */
function capturedByReply(fenAfterMove, replyUci) {
  if (!replyUci) return null
  const square = replyUci.slice(2, 4)
  const piece = new Chess(fenAfterMove).get(square)
  return piece ? { type: piece.type, square } : null
}

/**
 * Whole-game review: evaluates every position once, then grades each move
 * against the evaluation of the position it came from.
 *
 * It runs on its own engine instance so the live analysis worker keeps its
 * hash table and can resume instantly when the review finishes.
 */
export default function useGameReview() {
  const [progress, setProgress] = useState(IDLE)
  const [report, setReport] = useState(null)
  const cancelRef = useRef(false)
  const engineRef = useRef(null)

  useEffect(
    () => () => {
      cancelRef.current = true
      engineRef.current?.destroy()
    },
    [],
  )

  const cancel = useCallback(() => {
    cancelRef.current = true
    engineRef.current?.destroy()
    engineRef.current = null
    setProgress(IDLE)
  }, [])

  const clear = useCallback(() => {
    setReport(null)
    setProgress(IDLE)
  }, [])

  const run = useCallback(async (fens, history, { depth = 24, movetime = 900 } = {}) => {
    if (history.length === 0) return

    cancelRef.current = false
    setReport(null)
    setProgress({ state: 'loading', phase: 'scan', done: 0, total: fens.length })

    await loadOpenings()
    const { lastBookPly, opening } = bookPrefix(fens)

    const engine = new StockfishEngine()
    engineRef.current = engine
    // A review is a long sequence of shallow searches; a smaller hash keeps
    // memory sane and costs nothing at these depths.
    await engine.init({ hash: 64 })

    const evals = []
    const depths = []
    let failed = false

    /** Evaluate one position and store the result at `index`. */
    const scan = async (index, budget, depthCap) => {
      const terminal = terminalEval(fens[index])
      if (terminal) {
        evals[index] = { best: terminal, second: null, bestMove: null }
        return true
      }

      // A wedged worker would otherwise leave the review spinning forever.
      const result = await Promise.race([
        engine.evaluate({ fen: fens[index], depth: depthCap, movetime: budget, multiPv: 2 }),
        new Promise((resolve) => setTimeout(() => resolve(null), budget + 20000)),
      ])
      if (!result) return false

      const lines = result.lines.map((line) => toWhitePov(line, fens[index]))
      if (result.lines[0]?.depth) depths.push(result.lines[0].depth)

      evals[index] = {
        best: lines[0] ?? { score: 0, mate: null },
        second: lines[1] ?? null,
        bestMove: result.bestMove,
      }
      return true
    }

    /** Grade every move against the evaluations gathered so far. */
    const grade = () => {
      const board = new Chess()
      const plies = []

      for (let i = 0; i < history.length; i++) {
        const move = history[i]
        const before = evals[i].best
        const after = evals[i + 1]?.best ?? before

        board.load(fens[i])

        // Position after the opponent's best answer — used to detect sacrifices.
        let replyFen = null
        const reply = evals[i + 1]?.bestMove
        if (reply) {
          const probe = new Chess(fens[i + 1])
          try {
            probe.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] })
            replyFen = probe.fen()
          } catch {
            replyFen = null
          }
        }

        const classification = classifyMove({
          color: move.color,
          playedUci: `${move.from}${move.to}${move.promotion ?? ''}`,
          bestUci: evals[i].bestMove,
          replyUci: reply ?? null,
          before,
          after,
          secondBest: evals[i].second,
          isBook: i + 1 <= lastBookPly,
          legalMoveCount: board.moves().length,
          fenBefore: fens[i],
          fenAfter: fens[i + 1],
          replyFen,
        })

        const lost = Math.max(
          0,
          winPercentFor(move.color, toCp(before)) - winPercentFor(move.color, toCp(after)),
        )

        // Same ingredients the "brilliant" sacrifice check already uses,
        // reused here so the explanation panel can say *why* in one sentence
        // instead of just showing a score.
        const swing =
          materialBalance(fens[i], move.color) - materialBalance(replyFen ?? fens[i + 1], move.color)
        const moverMateBefore =
          before.mate == null ? null : move.color === 'w' ? before.mate : -before.mate
        const moverMateAfter =
          after.mate == null ? null : move.color === 'w' ? after.mate : -after.mate

        plies.push({
          ply: i,
          san: move.san,
          color: move.color,
          classification,
          accuracy: moveAccuracy(lost),
          lost,
          evalAfter: after,
          bestMove: evals[i].bestMove,
          bestSan: bestMoveSan(fens[i], evals[i].bestMove),
          replySan: bestMoveSan(fens[i + 1], reply ?? null),
          hanging: capturedByReply(fens[i + 1], reply ?? null),
          swing,
          moverMateBefore,
          moverMateAfter,
        })
      }

      return plies
    }

    // --- pass 1: cheap triage over the whole game ---------------------------
    // Budget is fixed, not tied to the preset — see the constants above.
    setProgress({ state: 'running', phase: 'scan', done: 0, total: fens.length })

    for (let i = 0; i < fens.length; i++) {
      if (cancelRef.current) return
      const isBook = i <= lastBookPly
      const budget = isBook ? BOOK_MOVETIME : SCAN_MOVETIME
      const depthCap = isBook ? BOOK_DEPTH : SCAN_DEPTH
      if (!(await scan(i, budget, depthCap))) {
        failed = true
        break
      }
      setProgress({ state: 'running', phase: 'scan', done: i + 1, total: fens.length })
    }

    if (failed) {
      engine.destroy()
      engineRef.current = null
      setProgress({ state: 'error', done: evals.length, total: fens.length })
      return
    }

    // --- pass 2: spend the real budget only on moves that matter -----------
    //
    // A shallow triage pass is also not enough in sharp positions: the engine
    // may see a mate before a move and not after it, which turns a perfectly
    // good move into a "mistake". Re-examining only the flagged moves, with
    // the user's chosen budget, fixes those without paying full price on the
    // whole game.
    const suspects = new Set()
    for (const ply of grade()) {
      if (SUSPECT.has(ply.classification)) {
        suspects.add(ply.ply)
        suspects.add(ply.ply + 1)
      }
    }

    const toVerify = [...suspects].filter((i) => i < fens.length).sort((a, b) => a - b)
    setProgress({ state: 'running', phase: 'verify', done: 0, total: toVerify.length })

    for (let n = 0; n < toVerify.length; n++) {
      if (cancelRef.current) return
      if (!(await scan(toVerify[n], movetime, depth))) {
        failed = true
        break
      }
      setProgress({ state: 'running', phase: 'verify', done: n + 1, total: toVerify.length })
    }

    engine.destroy()
    engineRef.current = null
    if (cancelRef.current) return

    if (failed) {
      setProgress({ state: 'error', done: 0, total: fens.length })
      return
    }

    // --- final grading ----------------------------------------------------
    const plies = grade()
    const accuracies = { w: [], b: [] }
    for (const ply of plies) accuracies[ply.color].push(ply.accuracy)

    const winPercents = evals.map((e) => winPercent(toCp(e.best)))

    const summary = { w: {}, b: {} }
    for (const key of CLASS_ORDER) {
      summary.w[key] = 0
      summary.b[key] = 0
    }
    for (const ply of plies) summary[ply.color][ply.classification] += 1

    setReport({
      plies,
      summary,
      opening,
      depth: depths.length
        ? Math.round(depths.reduce((a, b) => a + b, 0) / depths.length)
        : depth,
      verified: toVerify.length,
      evals: evals.map((e) => e.best),
      winPercents,
      accuracy: {
        w: gameAccuracy(accuracies.w, winPercents),
        b: gameAccuracy(accuracies.b, winPercents),
      },
    })
    setProgress({ state: 'done', done: fens.length, total: fens.length })
  }, [])

  return { progress, report, run, cancel, clear }
}

/** SAN for the engine's preferred move, so the UI can say "Nf3 was best". */
function bestMoveSan(fen, uci) {
  if (!uci) return null
  const game = new Chess(fen)
  try {
    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    })
    return move.san
  } catch {
    return null
  }
}

export { lookupOpening }
