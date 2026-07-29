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
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-4 px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-md bg-gradient-to-br from-accent-400 to-accent-600 text-[17px] leading-none text-slate-950 shadow-lg shadow-accent-600/20">
            <span className="-mt-px">♞</span>
          </div>
          <div className="leading-none">
            <div className="text-[15px] font-semibold tracking-tight text-slate-100">
              Gambit
            </div>
            <div className="label-micro mt-1">Analysis Board</div>
          </div>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-slate-800 sm:block" />

        <nav className="hidden items-center gap-1 sm:flex">
          <span className="rounded-md bg-slate-800 px-3 py-1.5 text-[13px] font-medium text-slate-100">
            Analysis
          </span>
          <button
            type="button"
            onClick={onOpenPlayer}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
          >
            chess.com
          </button>
          <button
            type="button"
            onClick={onImportPgn}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
          >
            Import PGN
          </button>
        </nav>

        {/* Engine status */}
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 py-1.5 pl-2.5 pr-3">
            <span className={`size-1.5 rounded-full ${status.dot}`} />
            <span className="font-mono text-[11px] tracking-wide text-slate-400">
              Stockfish&nbsp;·&nbsp;
              <span className="text-slate-200">{status.label}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
