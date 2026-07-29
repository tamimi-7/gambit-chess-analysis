import { useCallback, useEffect, useRef, useState } from 'react'
import StockfishEngine, { canUseThreads } from '../engine/StockfishEngine'
import { pvToSan, toWhitePov } from '../engine/uci'

const EMPTY = {
  evaluation: { score: null, mate: null },
  depth: 0,
  seldepth: 0,
  nodes: 0,
  nps: 0,
  wdl: null,
  lines: [],
  bestMove: null,
}

/**
 * Runs Stockfish against a FEN and streams the search back into React state.
 *
 * Two details matter for numbers that agree with a real analysis board:
 *  - every score is converted to White's point of view (see toWhitePov)
 *  - engine output is buffered and flushed on a timer; `info` arrives
 *    hundreds of times a second and one setState per line would spend the
 *    whole frame budget in React instead of in the search.
 */
export default function useEngine(fen, { enabled = true, multiPv = 3, depth = 24, paused = false } = {}) {
  const [state, setState] = useState(EMPTY)
  const [status, setStatus] = useState({
    ready: false,
    thinking: false,
    error: null,
    threads: 1,
    hash: 0,
    name: 'Stockfish 18',
    threaded: canUseThreads(),
  })

  const engineRef = useRef(null)
  const searchIdRef = useRef(0)
  const bufferRef = useRef({ ...EMPTY, pvs: [] })
  const flushRef = useRef(0)

  const flush = useCallback(() => {
    if (flushRef.current) return
    flushRef.current = setTimeout(() => {
      flushRef.current = 0
      const buf = bufferRef.current
      const analysedFen = buf.fen
      if (!analysedFen) return

      const lines = buf.pvs
        .filter(Boolean)
        .map((entry) => ({
          ...toWhitePov(entry, analysedFen),
          pv: pvToSan(analysedFen, entry.pv),
          uci: entry.pv,
        }))

      // WDL is also side-to-move relative: [win, draw, loss] for the mover.
      const blackToMove = analysedFen.split(' ')[1] === 'b'
      const wdl = buf.wdl && blackToMove ? [...buf.wdl].reverse() : buf.wdl

      setState({
        evaluation: lines[0] ? { score: lines[0].score, mate: lines[0].mate } : EMPTY.evaluation,
        depth: buf.depth,
        seldepth: buf.seldepth,
        nodes: buf.nodes,
        nps: buf.nps,
        wdl,
        lines,
        bestMove: buf.pvs[0]?.pv?.[0] ?? null,
      })
    }, 90)
  }, [])

  // --- engine lifecycle (once) -------------------------------------------
  useEffect(() => {
    const engine = new StockfishEngine({
      onInfo: (info) => {
        if (info.searchId !== searchIdRef.current) return // stale position

        const buf = bufferRef.current
        buf.fen = info.fen
        buf.depth = info.depth ?? buf.depth
        buf.seldepth = info.seldepth ?? buf.seldepth
        buf.nodes = info.nodes ?? buf.nodes
        buf.nps = info.nps ?? buf.nps
        if (info.wdl) buf.wdl = info.wdl

        const slot = (info.multipv ?? 1) - 1
        buf.pvs[slot] = { cp: info.cp, mate: info.mate, pv: info.pv }
        flush()
      },
      onBestMove: ({ searchId }) => {
        if (searchId === searchIdRef.current) setStatus((s) => ({ ...s, thinking: false }))
      },
      onStatus: (patch) => setStatus((s) => ({ ...s, ...patch })),
    })

    engineRef.current = engine
    engine.init().catch((error) => setStatus((s) => ({ ...s, error: String(error) })))

    return () => {
      clearTimeout(flushRef.current)
      engine.destroy()
      engineRef.current = null
    }
  }, [flush])

  // --- drive the search --------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    if (!enabled || paused) {
      // Invalidate the search id first: `stop` is asynchronous, so info lines
      // already in flight would otherwise repaint the evaluation we just cleared.
      searchIdRef.current = -1
      clearTimeout(flushRef.current)
      flushRef.current = 0
      bufferRef.current = { ...EMPTY, pvs: [] }

      engine.stop()
      setState(EMPTY)
      setStatus((s) => ({ ...s, thinking: false }))
      return
    }

    // Clear immediately so a stale evaluation is never shown next to a new
    // position, then debounce: arrow-keying through a game fires this fast.
    searchIdRef.current = -1
    clearTimeout(flushRef.current)
    flushRef.current = 0
    bufferRef.current = { ...EMPTY, pvs: [], fen }
    setState(EMPTY)

    const timer = setTimeout(() => {
      searchIdRef.current = engine.analyze({ fen, multiPv, depth })
    }, 110)

    return () => clearTimeout(timer)
  }, [fen, enabled, paused, multiPv, depth])

  return { ...state, ...status, enabled }
}
