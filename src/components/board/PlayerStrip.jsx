/**
 * Identity row above/below the board: player, rating, captured material,
 * turn indicator and — once a review has run — game accuracy.
 */
export default function PlayerStrip({
  name,
  rating,
  color,
  captured = '',
  diff = 0,
  toMove,
  accuracy,
}) {
  return (
    <div className="flex items-center gap-2.5 px-0.5">
      <div
        className={[
          'grid size-7 shrink-0 place-items-center rounded border text-[13px] leading-none transition-shadow',
          color === 'white'
            ? 'border-slate-300/20 bg-slate-200 text-slate-900'
            : 'border-slate-700 bg-slate-800 text-slate-200',
          toMove ? 'ring-2 ring-accent-500/70' : '',
        ].join(' ')}
      >
        {color === 'white' ? '♔' : '♚'}
      </div>

      <span
        className={`max-w-[40%] truncate text-[13px] font-medium ${
          toMove ? 'text-slate-100' : 'text-slate-400'
        }`}
      >
        {name}
      </span>
      {rating && <span className="font-mono text-[11px] text-slate-500">{rating}</span>}

      <span className="truncate text-[13px] leading-none text-slate-500">{captured}</span>
      {diff > 0 && <span className="font-mono text-[11px] text-slate-400">+{diff}</span>}

      {accuracy != null && (
        <span className="ml-auto shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
          {accuracy.toFixed(1)}
          <span className="ml-1 text-[9px] uppercase tracking-wider text-slate-500">acc</span>
        </span>
      )}
    </div>
  )
}
