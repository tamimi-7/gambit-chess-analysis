import { CLASSES } from '../../lib/classify'

const W = 1000
const H = 100
const MARKED = new Set(['blunder', 'mistake', 'miss', 'brilliant', 'great'])

/**
 * Win-probability curve across the game. White's share is filled from the
 * bottom, so the shape reads the same way the evaluation bar does.
 * Clicking anywhere jumps to that move.
 */
export default function EvalGraph({ winPercents = [], plies = [], activePly = -1, onSelect }) {
  if (winPercents.length < 2) return null

  const x = (i) => (i / (winPercents.length - 1)) * W
  const y = (win) => H - (win / 100) * H

  const line = winPercents.map((win, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(win).toFixed(1)}`)
  const area = `${line.join(' ')} L${W},${H} L0,${H} Z`

  const markers = plies
    .map((ply, i) => ({ ...ply, i: i + 1 }))
    .filter((ply) => MARKED.has(ply.classification))

  const jump = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    onSelect?.(Math.round(ratio * (winPercents.length - 1)))
  }

  return (
    <div className="border-b border-slate-800 bg-slate-950/50 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="label-micro">Evaluation</span>
        <span className="font-mono text-[10px] text-slate-600">white advantage</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onClick={jump}
        className="h-16 w-full cursor-pointer rounded bg-eval-black"
        role="presentation"
      >
        <path d={area} fill="var(--color-eval-white)" opacity="0.92" />
        <path d={line.join(' ')} fill="none" stroke="#0f172a" strokeWidth="1.5" opacity="0.35" />
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#64748b" strokeWidth="1" strokeDasharray="6 6" opacity="0.6" />

        {markers.map((marker) => (
          <circle
            key={marker.i}
            cx={x(marker.i)}
            cy={y(winPercents[marker.i] ?? 50)}
            r="7"
            fill={CLASSES[marker.classification].color}
            stroke="#0f172a"
            strokeWidth="1.5"
          />
        ))}

        {activePly >= -1 && (
          <line
            x1={x(activePly + 1)}
            y1="0"
            x2={x(activePly + 1)}
            y2={H}
            stroke="var(--color-accent-400)"
            strokeWidth="2.5"
          />
        )}
      </svg>
    </div>
  )
}
