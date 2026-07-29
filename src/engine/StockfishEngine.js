import { parseInfo } from './uci'

/**
 * Stockfish 18 (NNUE) driven over UCI inside a Web Worker.
 *
 * Everything here exists to keep the search loop off the main thread and to
 * keep the UCI conversation strictly serialised — an engine that receives a
 * new `position` while it is still searching returns results for a mixture of
 * both positions, which is exactly how analysis boards end up "almost right".
 */

const THREADED_BUILD = 'stockfish-18-lite'
const SINGLE_BUILD = 'stockfish-18-lite-single'

/** Multi-threaded WASM needs SharedArrayBuffer, which needs COOP/COEP headers. */
export function canUseThreads() {
  return typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true
}

export default class StockfishEngine {
  constructor({ onInfo, onBestMove, onStatus } = {}) {
    this.onInfo = onInfo ?? (() => {})
    this.onBestMove = onBestMove ?? (() => {})
    this.onStatus = onStatus ?? (() => {})

    this.worker = null
    this.ready = false
    this.searching = false
    this.pending = null
    this.searchId = 0
    this.activeSearchId = 0
    this.currentMultiPv = null
    this.info = { name: 'Stockfish 18', threads: 1, hash: 0 }
  }

  async init({ hash = 128, threads } = {}) {
    const useThreads = canUseThreads()
    const build = useThreads ? THREADED_BUILD : SINGLE_BUILD
    const base = import.meta.env.BASE_URL

    // The loader resolves its own .wasm sibling, so no bundler involvement.
    this.worker = new Worker(`${base}engine/${build}.js`)
    this.worker.onmessage = (e) => this.#handleLine(String(e.data))
    this.worker.onerror = (e) => this.onStatus({ error: e.message ?? 'engine crashed' })

    await this.#handshake()

    const cores = navigator.hardwareConcurrency || 2
    // Leave a core for the UI; more than 8 gives little on a browser build.
    const threadCount = useThreads ? (threads ?? Math.max(1, Math.min(cores - 1, 8))) : 1

    this.send(`setoption name Threads value ${threadCount}`)
    this.send(`setoption name Hash value ${hash}`)
    this.send('setoption name UCI_ShowWDL value true')
    await this.#isReady()

    this.ready = true
    this.info = { name: this.name ?? 'Stockfish 18', threads: threadCount, hash }
    this.onStatus({ ready: true, ...this.info })

    if (this.pending) this.#startPending()
    return this.info
  }

  send(command) {
    this.worker?.postMessage(command)
  }

  /**
   * Queue an analysis. If a search is running it is stopped first and the new
   * request starts from the `bestmove` acknowledgement — never before.
   */
  analyze({ fen, multiPv = 3, depth = 24 }) {
    this.searchId += 1
    this.pending = { fen, multiPv, depth, id: this.searchId }

    if (!this.ready) return this.searchId
    if (this.searching) this.send('stop')
    else this.#startPending()

    return this.searchId
  }

  /**
   * One-shot evaluation of a position, resolved when the search terminates.
   * Used by the game review, which walks a whole game position by position.
   */
  evaluate({ fen, multiPv = 2, depth = 22, movetime = 0 }) {
    return new Promise((resolve) => {
      this.searchId += 1
      this.pending = { fen, multiPv, depth, movetime, id: this.searchId, resolve, collect: [] }

      if (!this.ready) return
      if (this.searching) this.send('stop')
      else this.#startPending()
    })
  }

  stop() {
    this.pending = null
    if (this.searching) this.send('stop')
  }

  destroy() {
    this.pending = null
    this.ready = false
    try {
      this.send('quit')
    } finally {
      this.worker?.terminate()
      this.worker = null
    }
  }

  // --- internals ---------------------------------------------------------

  #startPending() {
    const request = this.pending
    if (!request) return

    this.pending = null
    this.active = request
    this.activeSearchId = request.id
    this.activeFen = request.fen

    // MultiPV must be set while idle; changing it mid-search is ignored.
    if (this.currentMultiPv !== request.multiPv) {
      this.send(`setoption name MultiPV value ${request.multiPv}`)
      this.currentMultiPv = request.multiPv
    }

    this.send(`position fen ${request.fen}`)

    // Both limits can be given at once — the search stops at whichever comes
    // first. A game review bounds by time so its total runtime is predictable
    // (sharp positions cost far more per depth than quiet ones); live analysis
    // bounds by depth so the number on screen means something.
    const limits = []
    if (request.depth) limits.push(`depth ${request.depth}`)
    if (request.movetime) limits.push(`movetime ${request.movetime}`)
    this.send(limits.length ? `go ${limits.join(' ')}` : 'go infinite')

    this.searching = true
    this.onStatus({ thinking: true })
  }

  #handleLine(line) {
    if (this.resolveHandshake && line.startsWith('uciok')) {
      const resolve = this.resolveHandshake
      this.resolveHandshake = null
      resolve()
      return
    }

    if (this.resolveReady && line.startsWith('readyok')) {
      const resolve = this.resolveReady
      this.resolveReady = null
      resolve()
      return
    }

    if (line.startsWith('id name')) {
      this.name = line.slice(8).trim()
      return
    }

    if (line.startsWith('bestmove')) {
      this.searching = false
      const [, best] = line.split(/\s+/)
      const move = best === '(none)' ? null : best
      const finished = this.active
      this.active = null

      // A one-shot evaluation always resolves, even if it was cut short.
      finished?.resolve?.({
        fen: finished.fen,
        depth: finished.depth,
        bestMove: move,
        lines: finished.collect.filter(Boolean),
      })

      // A stopped search reports the bestmove of the position we abandoned.
      if (this.pending) this.#startPending()
      else if (!finished?.resolve) {
        this.onBestMove({ move, searchId: this.activeSearchId })
        this.onStatus({ thinking: false })
      }
      return
    }

    const info = parseInfo(line)
    // Bounds are search-window artefacts, not evaluations.
    if (info && !info.bound) {
      if (this.active?.collect) {
        this.active.collect[(info.multipv ?? 1) - 1] = {
          cp: info.cp,
          mate: info.mate,
          pv: info.pv,
          depth: info.depth,
        }
      }
      this.onInfo({ ...info, fen: this.activeFen, searchId: this.activeSearchId })
    }
  }

  #handshake() {
    return new Promise((resolve) => {
      this.resolveHandshake = resolve
      this.send('uci')
    })
  }

  #isReady() {
    return new Promise((resolve) => {
      this.resolveReady = resolve
      this.send('isready')
    })
  }
}
