const Icon = ({ d, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`size-4 ${className}`}
    aria-hidden="true"
  >
    {d}
  </svg>
)

const ICONS = {
  first: <><path d="M18 5v14M16 12 8 6v12z" /></>,
  prev: <><path d="m14 6-7 6 7 6z" /><path d="M17 5v14" opacity=".35" /></>,
  next: <><path d="m10 6 7 6-7 6z" /><path d="M7 5v14" opacity=".35" /></>,
  last: <><path d="M6 5v14M8 12l8-6v12z" /></>,
  flip: <><path d="M3 8h13a4 4 0 0 1 0 8H9" /><path d="m6 13-3 3 3 3" /></>,
  reset: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
}

function CtrlButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon d={icon} />
    </button>
  )
}

/**
 * Board footer: history navigation left, position status centre, utilities right.
 */
export default function BoardControls({
  onFirst,
  onPrev,
  onNext,
  onLast,
  onFlip,
  onReset,
  canGoBack,
  canGoForward,
  status,
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-1.5 py-1">
      <div className="flex items-center gap-0.5">
        <CtrlButton icon={ICONS.first} label="First move" onClick={onFirst} disabled={!canGoBack} />
        <CtrlButton icon={ICONS.prev} label="Previous move" onClick={onPrev} disabled={!canGoBack} />
        <CtrlButton icon={ICONS.next} label="Next move" onClick={onNext} disabled={!canGoForward} />
        <CtrlButton icon={ICONS.last} label="Last move" onClick={onLast} disabled={!canGoForward} />
      </div>

      <span
        className={`truncate px-2 text-[12px] ${
          status?.over ? 'font-medium text-accent-300' : 'text-slate-500'
        }`}
      >
        {status?.text}
      </span>

      <div className="flex items-center gap-0.5">
        <CtrlButton icon={ICONS.flip} label="Flip board" onClick={onFlip} />
        <CtrlButton icon={ICONS.reset} label="Reset position" onClick={onReset} />
      </div>
    </div>
  )
}
