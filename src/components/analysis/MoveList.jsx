import { useEffect, useRef } from 'react'
import { CLASSES } from '../../lib/classify'
import MoveBadge from './MoveBadge'

/**
 * Move list in SAN, laid out as move-number / white / black rows.
 * `moves` is a flat array of plies; `activePly` is the 0-based index of the
 * move currently on the board (-1 at the starting position).
 */
function MoveCell({ san, ply, active, review, onSelect }) {
  const ref = useRef(null)

  // Keep the move under review visible while navigating with the keyboard.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!san) return <span />

  const meta = review ? CLASSES[review.classification] : null

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect?.(ply)}
      title={meta ? `${meta.label}${review.bestSan ? ` · best: ${review.bestSan}` : ''}` : undefined}
      className={[
        'flex items-center gap-1.5 rounded px-1.5 py-1 text-left font-mono text-[13px] transition-colors',
        active
          ? 'bg-accent-500/20 font-semibold text-accent-300 ring-1 ring-inset ring-accent-500/40'
          : 'text-slate-300 hover:bg-slate-800 hover:text-slate-50',
      ].join(' ')}
    >
      <span className="truncate" style={meta && !active ? { color: meta.color } : undefined}>
        {san}
      </span>
      {review && <MoveBadge classification={review.classification} size={15} />}
    </button>
  )
}

export default function MoveList({ moves = [], activePly = -1, review = null, onSelect }) {
  const rows = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ no: i / 2 + 1, white: moves[i], black: moves[i + 1] })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <span className="label-micro">Moves</span>
        <span className="font-mono text-[10px] text-slate-600">{moves.length} plies</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {rows.length === 0 && (
          <p className="px-2 py-3 text-[12px] text-slate-600">
            Play a move or import a PGN to start.
          </p>
        )}

        {rows.map((row, i) => (
          <div
            key={row.no}
            className={`grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 rounded ${
              i % 2 ? 'bg-slate-900/40' : ''
            }`}
          >
            <span className="px-1 text-right font-mono text-[11px] text-slate-600 tabular-nums">
              {row.no}.
            </span>
            <MoveCell
              san={row.white}
              ply={i * 2}
              active={activePly === i * 2}
              review={review?.[i * 2]}
              onSelect={onSelect}
            />
            <MoveCell
              san={row.black}
              ply={i * 2 + 1}
              active={activePly === i * 2 + 1}
              review={review?.[i * 2 + 1]}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
