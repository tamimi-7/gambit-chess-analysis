/**
 * Engine readout: headline evaluation, win/draw/loss split, search meta,
 * search settings and the top principal variations.
 */
function formatScore({ score, mate }, { signed = true } = {}) {
  if (mate != null) return `${mate > 0 ? '' : '-'}M${Math.abs(mate)}`
  if (score == null) return '—'
  const abs = Math.abs(score).toFixed(2)
  if (!signed) return abs
  return score > 0 ? `+${abs}` : score < 0 ? `−${abs}` : '0.00'
}

function verdict({ score, mate }) {
  if (mate != null) return `${mate > 0 ? 'White' : 'Black'} mates in ${Math.abs(mate)}`
  if (score == null) return 'Waiting for the engine'
  const a = Math.abs(score)
  const side = score > 0 ? 'White' : 'Black'
  if (a < 0.3) return 'Equal position'
  if (a < 0.9) return `${side} is slightly better`
  if (a < 2.5) return `${side} is better`
  return `${side} is winning`
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-micro w-10 shrink-0">{label}</span>
      <div className="flex gap-0.5 rounded-md bg-slate-950/60 p-0.5">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'rounded px-2 py-0.5 font-mono text-[11px] transition-colors',
              option.value === value
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Win / draw / loss probabilities straight from Stockfish's WDL model. */
function WdlBar({ wdl }) {
  if (!wdl) return null
  const [win, draw, loss] = wdl.map((v) => v / 10)

  return (
    <div className="px-3 pt-2.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="bg-eval-white" style={{ width: `${win}%` }} />
        <div className="bg-slate-600" style={{ width: `${draw}%` }} />
        <div className="bg-eval-black" style={{ width: `${loss}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
        <span>W {win.toFixed(0)}%</span>
        <span>D {draw.toFixed(0)}%</span>
        <span>L {loss.toFixed(0)}%</span>
      </div>
    </div>
  )
}

function PvLine({ line, index, onPlay }) {
  return (
    <button
      type="button"
      onClick={() => onPlay?.(line)}
      title="Play this line on the board"
      className="group flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-800/70"
    >
      <span
        className={[
          'mt-px shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums',
          index === 0
            ? 'bg-accent-500/15 text-accent-300'
            : 'bg-slate-800 text-slate-400',
        ].join(' ')}
      >
        {formatScore(line)}
      </span>
      <span className="truncate font-mono text-[12px] leading-5 text-slate-400 transition-colors group-hover:text-slate-200">
        {line.pv}
      </span>
    </button>
  )
}

const LINE_OPTIONS = [1, 2, 3, 5].map((n) => ({ label: String(n), value: n }))
const DEPTH_OPTIONS = [
  { label: '20', value: 20 },
  { label: '24', value: 24 },
  { label: '30', value: 30 },
  { label: '∞', value: 0 },
]

export default function EngineOutput({
  evaluation,
  depth = 0,
  seldepth = 0,
  targetDepth = 24,
  nodes = 0,
  nps = 0,
  wdl,
  lines = [],
  thinking = false,
  ready = false,
  error = null,
  enabled = true,
  name = 'Stockfish 18',
  threads = 1,
  threaded = false,
  terminal = null,
  multiPv = 3,
  onToggle,
  onMultiPvChange,
  onDepthChange,
  onPlayLine,
}) {
  const headline = terminal
    ? { label: terminal.label, sub: terminal.sub }
    : { label: formatScore(evaluation), sub: verdict(evaluation) }

  return (
    <div className="border-b border-slate-800 bg-slate-900/40">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="label-micro shrink-0">Engine</span>
          <span className="truncate font-mono text-[10px] text-slate-600">
            {name} · {threads}t{threaded ? '' : ' · single'}
          </span>
          {thinking && (
            <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-accent-400">
              <span className="size-1 animate-pulse rounded-full bg-accent-400" />
              thinking
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle engine"
          className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
            enabled ? 'bg-accent-500' : 'bg-slate-700'
          }`}
        >
          <span
            className={`absolute top-0.5 size-3 rounded-full bg-slate-950 transition-all ${
              enabled ? 'left-3.5' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* Headline evaluation */}
      <div className="flex items-baseline gap-3 px-3 pt-1.5">
        <span className="font-mono text-[30px] font-semibold leading-none tracking-tight text-slate-50 tabular-nums">
          {headline.label}
        </span>
        <span className="truncate text-[12px] text-slate-400">{headline.sub}</span>
      </div>

      {!terminal && <WdlBar wdl={wdl} />}

      {error && (
        <p className="mx-3 mt-2 rounded border border-red-900/60 bg-red-950/40 px-2 py-1 font-mono text-[11px] text-red-300">
          {error}
        </p>
      )}

      {/* Search meta */}
      <div className="mt-2.5 grid grid-cols-3 gap-px overflow-hidden border-y border-slate-800 bg-slate-800 font-mono text-[11px]">
        {[
          ['depth', depth ? `${depth}/${seldepth || depth}` : '—'],
          [
            'nodes',
            nodes >= 1e6 ? `${(nodes / 1e6).toFixed(1)}M` : `${Math.round(nodes / 1e3)}k`,
          ],
          ['kn/s', nps ? Math.round(nps / 1000).toLocaleString() : '—'],
        ].map(([k, v]) => (
          <div key={k} className="bg-slate-900/80 px-3 py-1.5">
            <div className="text-[9px] uppercase tracking-[0.15em] text-slate-500">{k}</div>
            <div className="text-slate-200 tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {/* Search settings */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
        <Segmented label="Lines" options={LINE_OPTIONS} value={multiPv} onChange={onMultiPvChange} />
        <Segmented label="Depth" options={DEPTH_OPTIONS} value={targetDepth} onChange={onDepthChange} />
      </div>

      {/* Principal variations */}
      <div className="space-y-0.5 border-t border-slate-800/70 p-1.5">
        {lines.length === 0 && (
          <p className="px-2 py-3 font-mono text-[12px] text-slate-600">
            {terminal
              ? 'Game over — no move to search.'
              : enabled
                ? ready
                  ? 'Searching…'
                  : 'Loading Stockfish…'
                : 'Engine off.'}
          </p>
        )}
        {lines.map((line, i) => (
          <PvLine key={i} line={line} index={i} onPlay={onPlayLine} />
        ))}
      </div>
    </div>
  )
}
