import { useEffect, useMemo, useState } from 'react'
import TopBar from './components/layout/TopBar'
import ImportPgnDialog from './components/layout/ImportPgnDialog'
import PlayerGamesDialog from './components/layout/PlayerGamesDialog'
import BoardPanel from './components/board/BoardPanel'
import AnalysisPanel from './components/analysis/AnalysisPanel'
import useChessGame from './hooks/useChessGame'
import useEngine from './hooks/useEngine'
import useGameReview from './hooks/useGameReview'

export default function App() {
  const [orientation, setOrientation] = useState('white')
  const [engineOn, setEngineOn] = useState(true)
  // One line by default — three engine lines at once is a lot to take in;
  // the Lines control still lets anyone who wants more turn it up.
  const [multiPv, setMultiPv] = useState(1)
  const [targetDepth, setTargetDepth] = useState(24)
  const [reviewPreset, setReviewPreset] = useState({ movetime: 900, depth: 24 })
  const [tab, setTab] = useState('engine')
  const [pgnOpen, setPgnOpen] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)
  // chess.com ships its own accuracy with each game — kept for comparison.
  const [source, setSource] = useState(null)

  const game = useChessGame()
  const review = useGameReview()

  const reviewRunning =
    review.progress.state === 'running' || review.progress.state === 'loading'

  const engine = useEngine(game.fen, {
    enabled: engineOn,
    multiPv,
    depth: targetDepth,
    // Two engines fighting over the same cores makes both of them slower.
    paused: game.status.over || reviewRunning,
  })

  const { goTo, ply, history } = game
  const flip = () => setOrientation((o) => (o === 'white' ? 'black' : 'white'))

  /** Any new game invalidates the report, the imported metadata and any run in flight. */
  const startFresh = (load) => {
    review.cancel()
    review.clear()
    setSource(null)
    load()
    setTab('review')
  }

  // A report describes an exact move sequence; any edit to the game voids it.
  useEffect(() => {
    if (review.report && review.report.plies.length !== history.length) review.clear()
  }, [history.length, review])

  const reviewByPly = useMemo(() => {
    if (!review.report) return null
    const map = {}
    for (const entry of review.report.plies) map[entry.ply] = entry
    return map
  }, [review.report])

  const terminal = game.status.over
    ? { label: game.status.result, sub: game.status.text }
    : null

  const boardEval = terminal
    ? game.status.result === '½-½'
      ? { score: 0, mate: null }
      : { score: null, mate: game.status.result === '1-0' ? 1 : -1 }
    : engine.evaluation

  useEffect(() => {
    const onKey = (e) => {
      // `closest` is missing when the event target is document/window.
      if (e.target?.closest?.('input, textarea, [contenteditable]')) return

      const actions = {
        ArrowLeft: () => goTo(ply - 1),
        ArrowRight: () => goTo(ply + 1),
        Home: () => goTo(0),
        End: () => goTo(history.length),
        f: flip,
        F: flip,
      }
      const action = actions[e.key]
      if (!action) return
      e.preventDefault()
      action()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, ply, history.length])

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        engineStatus={
          reviewRunning
            ? 'reviewing'
            : !engineOn
              ? 'idle'
              : engine.thinking
                ? 'thinking'
                : engine.ready
                  ? 'ready'
                  : 'loading'
        }
        onImportPgn={() => setPgnOpen(true)}
        onOpenPlayer={() => setPlayerOpen(true)}
      />

      <main className="mx-auto grid w-full max-w-[1680px] flex-1 grid-cols-1 items-start gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <BoardPanel
          game={game}
          orientation={orientation}
          onFlip={flip}
          evaluation={boardEval}
          bestMove={engineOn && !terminal ? engine.bestMove : null}
          onReset={() => startFresh(game.reset)}
          moveReview={reviewByPly?.[ply - 1] ?? null}
          accuracy={review.report?.accuracy ?? null}
        />

        <div className="lg:sticky lg:top-[4.75rem] lg:h-[calc(100dvh-6.5rem)]">
          <AnalysisPanel
            tab={tab}
            onTabChange={setTab}
            engine={{
              ...engine,
              targetDepth,
              multiPv,
              terminal,
              onToggle: () => setEngineOn((on) => !on),
              onMultiPvChange: setMultiPv,
              onDepthChange: setTargetDepth,
              onPlayLine: (line) => game.playMoves(line.uci),
            }}
            review={{
              progress: review.progress,
              report: review.report,
              byPly: reviewByPly,
              players: game.players,
              activePly: ply - 1,
              reviewDepth: reviewPreset,
              hasGame: history.length > 0,
              plyCount: history.length,
              source,
              onDepthChange: setReviewPreset,
              onRun: () => {
                setTab('review')
                review.run(game.fens, game.history, reviewPreset)
              },
              onCancel: review.cancel,
              onSelectPly: goTo,
            }}
            moves={game.sanList}
            activePly={ply - 1}
            onSelectPly={(index) => goTo(index + 1)}
            fen={game.fen}
          />
        </div>
      </main>

      <ImportPgnDialog
        open={pgnOpen}
        onClose={() => setPgnOpen(false)}
        onImport={(pgn) => startFresh(() => game.loadPgn(pgn))}
      />

      <PlayerGamesDialog
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        onSelect={(selected) => {
          startFresh(() => game.loadPgn(selected.pgn))
          setSource({ accuracies: selected.accuracies, url: selected.url })
          setPlayerOpen(false)
        }}
      />
    </div>
  )
}
