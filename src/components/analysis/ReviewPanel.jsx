import { CLASS_ORDER, CLASSES } from '../../lib/classify'
import MoveBadge from './MoveBadge'
import EvalGraph from './EvalGraph'

/**
 * Time per position, not depth. A fixed depth costs wildly different amounts
 * of time depending on how sharp the position is — a quiet endgame reaches
 * depth 22 instantly while a tactical middlegame can take ten seconds — so a
 * depth-based review has no predictable runtime. A time budget does, and the
 * depth cap still stops the engine wasting the budget on a dead position.
 */
const PRESETS = [
  { label: 'Fast', movetime: 150, depth: 20 },
  { label: 'Balanced', movetime: 500, depth: 24 },
  { label: 'Deep', movetime: 1500, depth: 28 },
]

const estimate = (movetime, plies) => {
  const seconds = Math.round((movetime * (plies + 1)) / 1000)
  return seconds < 90 ? `~${seconds}s` : `~${Math.round(seconds / 60)}m`
}

function AccuracyCard({ color, name, value, reference }) {
  return (
    <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span
          className={`size-2 rounded-full ${
            color === 'w' ? 'bg-slate-200' : 'bg-slate-600 ring-1 ring-slate-500'
          }`}
        />
        <span className="truncate text-[11px] text-slate-400">{name}</span>
      </div>
      <div className="mt-0.5 font-mono text-[22px] font-semibold leading-none text-slate-50 tabular-nums">
        {value == null ? '—' : value.toFixed(1)}
      </div>
      <div className="label-micro mt-1">accuracy</div>
      {reference != null && (
        <div
          className="mt-1.5 border-t border-slate-800 pt-1 font-mono text-[10px] text-slate-500"
          title="chess.com's own review of this game"
        >
          chess.com {reference.toFixed(1)}
        </div>
      )}
    </div>
  )
}

function SummaryTable({ summary }) {
  const rows = CLASS_ORDER.filter((key) => summary.w[key] || summary.b[key])

  return (
    <div className="mt-2 space-y-px overflow-hidden rounded-lg border border-slate-800">
      {rows.map((key) => (
        <div
          key={key}
          className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 bg-slate-950/40 px-3 py-1.5"
        >
          <span className="text-center font-mono text-[13px] text-slate-200 tabular-nums">
            {summary.w[key]}
          </span>
          <span className="flex items-center justify-center gap-1.5">
            <MoveBadge classification={key} size={15} />
            <span className="text-[12px]" style={{ color: CLASSES[key].color }}>
              {CLASSES[key].label}
            </span>
          </span>
          <span className="text-center font-mono text-[13px] text-slate-200 tabular-nums">
            {summary.b[key]}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ReviewPanel({
  progress,
  report,
  players,
  activePly,
  reviewDepth,
  onDepthChange,
  onRun,
  onCancel,
  onSelectPly,
  hasGame,
  plyCount = 0,
  source = null,
}) {
  const running = progress.state === 'running' || progress.state === 'loading'
  const percent = progress.total ? (progress.done / progress.total) * 100 : 0

  return (
    // Capped so the move list underneath always keeps a usable share of the
    // panel; the report scrolls inside its own box instead of pushing it out.
    <div className="flex max-h-[62%] shrink-0 flex-col overflow-y-auto border-b border-slate-800">
      {report && (
        <EvalGraph
          winPercents={report.winPercents}
          plies={report.plies}
          activePly={activePly}
          onSelect={(position) => onSelectPly(position)}
        />
      )}

      <div className="p-3">
        {report?.opening && (
          <div className="mb-2.5 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
            <div className="label-micro">Opening</div>
            <div className="mt-0.5 truncate text-[13px] text-slate-200" title={report.opening.name}>
              {report.opening.name}
            </div>
            <div className="font-mono text-[10px] text-slate-500">{report.opening.eco}</div>
          </div>
        )}

        {report ? (
          <>
            <div className="flex gap-2">
              <AccuracyCard
                color="w"
                name={players.white}
                value={report.accuracy.w}
                reference={source?.accuracies?.white}
              />
              <AccuracyCard
                color="b"
                name={players.black}
                value={report.accuracy.b}
                reference={source?.accuracies?.black}
              />
            </div>
            <SummaryTable summary={report.summary} />
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-600">
              Stockfish 18 · avg depth {report.depth} · {report.verified} positions
              re-checked · lichess accuracy model
            </p>
          </>
        ) : (
          <p className="text-[12px] leading-relaxed text-slate-500">
            {hasGame
              ? 'Review the whole game: every position is evaluated once, then each move is graded against the engine’s choice.'
              : 'Import a PGN or play some moves, then run the review.'}
          </p>
        )}

        {progress.state === 'error' && (
          <p className="mt-3 rounded border border-red-900/60 bg-red-950/40 px-2 py-1.5 text-[11px] text-red-300">
            The engine stopped responding at position {progress.done}. Try again with
            a shorter time budget.
          </p>
        )}

        {running ? (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-slate-400">
              <span>
                {progress.state === 'loading'
                  ? 'Loading engine…'
                  : progress.phase === 'verify'
                    ? 'Verifying flagged moves'
                    : 'Analysing positions'}
              </span>
              <span className="tabular-nums">
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-accent-500 transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="mt-2.5 w-full rounded-md border border-slate-700 py-1.5 text-[12px] text-slate-300 transition-colors hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex gap-0.5 rounded-md bg-slate-950/60 p-0.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onDepthChange(preset)}
                  className={[
                    'flex-1 rounded px-2 py-1 text-[11px] transition-colors',
                    preset.movetime === reviewDepth.movetime
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  <span className="block font-medium">{preset.label}</span>
                  <span className="block font-mono text-[10px] opacity-70">
                    {estimate(preset.movetime, plyCount)}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onRun}
              disabled={!hasGame}
              className="w-full rounded-md bg-accent-500 py-2 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
            >
              {report ? 'Run review again' : 'Review game'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
