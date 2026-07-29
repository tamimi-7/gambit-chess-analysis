import { useCallback, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { START_FEN, findKing, materialInfo } from '../lib/chess'

/**
 * Single source of truth for the game.
 *
 * The state is a list of immutable FEN snapshots plus the moves that produced
 * them — NOT a mutable Chess instance. Rationale:
 *
 *   1. Jumping to any ply is O(1) (`fens[ply]`), no replaying from move 1.
 *   2. React never re-renders on a mutated object identity it can't see.
 *   3. In Step 3 the engine keys off `fen`, so navigation and analysis stay
 *      in sync for free.
 *
 * Invariant: `fens[i]` is the position after `i` plies, so `fens.length`
 * is always `history.length + 1`.
 */
const DEFAULT_PLAYERS = {
  white: 'White',
  black: 'Black',
  whiteElo: null,
  blackElo: null,
  event: null,
  result: null,
}

export default function useChessGame() {
  const [fens, setFens] = useState([START_FEN])
  const [history, setHistory] = useState([])
  const [ply, setPly] = useState(0)
  const [players, setPlayers] = useState(DEFAULT_PLAYERS)

  const fen = fens[ply]

  // One parse per displayed position; every derived value below reuses it.
  const position = useMemo(() => new Chess(fen), [fen])

  const makeMove = useCallback(
    (move) => {
      const game = new Chess(fens[ply])
      let result
      try {
        result = game.move(move)
      } catch {
        return null // illegal — chess.js throws rather than returning null
      }

      // Playing from a past ply truncates the future: this becomes the mainline.
      setFens((prev) => [...prev.slice(0, ply + 1), game.fen()])
      setHistory((prev) => [...prev.slice(0, ply), result])
      setPly((p) => p + 1)
      return result
    },
    [fens, ply],
  )

  /** Append a whole engine line at once (one state update, no stale closures). */
  const playMoves = useCallback(
    (uciMoves) => {
      const game = new Chess(fens[ply])
      const moves = []
      const nextFens = []

      for (const uci of uciMoves) {
        try {
          moves.push(
            game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }),
          )
          nextFens.push(game.fen())
        } catch {
          break
        }
      }
      if (moves.length === 0) return

      setFens((prev) => [...prev.slice(0, ply + 1), ...nextFens])
      setHistory((prev) => [...prev.slice(0, ply), ...moves])
      setPly((p) => p + moves.length)
    },
    [fens, ply],
  )

  const goTo = useCallback(
    (target) => setPly(Math.max(0, Math.min(fens.length - 1, target))),
    [fens.length],
  )

  const undo = useCallback(() => {
    if (history.length === 0) return
    setFens((prev) => prev.slice(0, -1))
    setHistory((prev) => prev.slice(0, -1))
    setPly((p) => Math.min(p, history.length - 1))
  }, [history.length])

  const reset = useCallback(() => {
    setFens([START_FEN])
    setHistory([])
    setPly(0)
    setPlayers(DEFAULT_PLAYERS)
  }, [])

  const loadPgn = useCallback((pgn) => {
    // Pasted PGN routinely carries a UTF-8 BOM (files saved on Windows) or
    // non-breaking spaces (copied from a web page); the parser rejects both.
    const cleaned = pgn
      .replace(/^﻿/, '')
      .replace(/ /g, ' ')
      .trim()

    const game = new Chess()
    game.loadPgn(cleaned) // throws on malformed input — caller decides how to report
    const moves = game.history({ verbose: true })
    if (moves.length === 0) throw new Error('No moves found in that PGN.')

    const headers = game.getHeaders()
    setPlayers({
      white: headers.White || 'White',
      black: headers.Black || 'Black',
      whiteElo: headers.WhiteElo || null,
      blackElo: headers.BlackElo || null,
      event: headers.Event || null,
      result: headers.Result || null,
    })

    const replay = new Chess()
    const nextFens = [replay.fen()]
    for (const move of moves) {
      replay.move(move.san)
      nextFens.push(replay.fen())
    }

    setFens(nextFens)
    setHistory(moves)
    setPly(moves.length)
  }, [])

  /** Legal destinations from a square, in the *currently displayed* position. */
  const movesFrom = useCallback(
    (square) => position.moves({ square, verbose: true }),
    [position],
  )

  const lastMove = ply > 0 ? history[ply - 1] : null
  const isCheck = position.isCheck()

  const status = useMemo(() => {
    if (position.isCheckmate()) {
      const winner = position.turn() === 'w' ? 'Black' : 'White'
      return {
        text: `Checkmate — ${winner} wins`,
        result: winner === 'White' ? '1-0' : '0-1',
        over: true,
      }
    }
    if (position.isStalemate())
      return { text: 'Stalemate — draw', result: '½-½', over: true }
    if (position.isInsufficientMaterial())
      return { text: 'Insufficient material — draw', result: '½-½', over: true }
    if (position.isThreefoldRepetition())
      return { text: 'Threefold repetition — draw', result: '½-½', over: true }
    if (position.isDraw()) return { text: 'Draw', result: '½-½', over: true }
    return {
      text: `${position.turn() === 'w' ? 'White' : 'Black'} to move${isCheck ? ' — check' : ''}`,
      result: null,
      over: false,
    }
  }, [position, isCheck])

  return {
    fen,
    fens,
    position,
    ply,
    history,
    players,
    sanList: useMemo(() => history.map((m) => m.san), [history]),
    turn: position.turn(),
    lastMove,
    checkSquare: isCheck ? findKing(fen, position.turn()) : null,
    material: useMemo(() => materialInfo(fen), [fen]),
    status,
    canGoBack: ply > 0,
    canGoForward: ply < fens.length - 1,
    makeMove,
    playMoves,
    movesFrom,
    goTo,
    undo,
    reset,
    loadPgn,
  }
}
