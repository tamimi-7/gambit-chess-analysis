/**
 * Slim application chrome. Left: brand + context. Right: engine status pill.
 * Kept intentionally low-height so vertical space belongs to the board.
 */
export default function TopBar({ engineStatus = 'idle', onImportPgn, onOpenPlayer }) {
  const status = {
    idle: { label: 'Off', dot: 'bg-slate-500' },
    loading: { label: 'Loading', dot: 'bg-amber-400 animate-pulse' },
    thinking: { label: 'Analysing', dot: 'bg-accent-400 animate-pulse' },
    reviewing: { label: 'Reviewing', dot: 'bg-accent-400 animate-pulse' },
    ready: { label: 'Ready', dot: 'bg-accent-400' },
  }[engineStatus] ?? { label: 'Off', dot: 'bg-slate-500' }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
        {/* Brand — the subtitle is desktop-only, it costs width we need on phones. */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-md bg-gradient-to-br from-accent-400 to-accent-600 text-[17px] leading-none text-slate-950 shadow-lg shadow-accent-600/20">
            <span className="-mt-px">♞</span>
          </div>
          <div className="leading-none">
            <div className="text-[15px] font-semibold tracking-tight text-slate-100">
              Gambit
            </div>
            <div className="label-micro mt-1 hidden sm:block">Analysis Board</div>
          </div>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-slate-800 sm:block" />

        {/* The two ways into a game. These must stay reachable at every width —
            without them a phone can only shuffle pieces by hand. */}
        <nav className="flex min-w-0 items-center gap-1">
          <span className="hidden rounded-md bg-slate-800 px-3 py-1.5 text-[13px] font-medium text-slate-100 sm:inline">
            Analysis
          </span>
          <button
            type="button"
            onClick={onOpenPlayer}
            className="shrink-0 rounded-md px-2 py-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200 sm:px-3"
          >
            chess.com
          </button>
          <button
            type="button"
            onClick={onImportPgn}
            className="shrink-0 rounded-md px-2 py-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200 sm:px-3"
          >
            <span className="sm:hidden">PGN</span>
            <span className="hidden sm:inline">Import PGN</span>
          </button>
        </nav>

        {/* Engine status — collapses to a bare dot on phones. */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div
            title={`Stockfish · ${status.label}`}
            className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-2 py-1.5 sm:pl-2.5 sm:pr-3"
          >
            <span className={`size-1.5 rounded-full ${status.dot}`} />
            <span className="hidden font-mono text-[11px] tracking-wide text-slate-400 sm:inline">
              Stockfish&nbsp;·&nbsp;
              <span className="text-slate-200">{status.label}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
