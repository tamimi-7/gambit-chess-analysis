/**
 * Vertical evaluation bar that hugs the left edge of the board.
 * White's share of the bar grows from the bottom (board orientation aware).
 *
 * Centipawn -> height mapping uses a soft saturation curve so a +9 and a +12
 * position don't both slam the bar to 100% and look identical.
 */
function whiteShare({ score, mate }) {
  if (mate != null) return mate > 0 ? 100 : 0
  if (score == null) return 50 // engine has not reported yet
  const clamped = Math.max(-10, Math.min(10, score))
  // logistic curve, ~50% at 0.00 and ~93% at +5.00
  return 100 / (1 + Math.exp(-0.55 * clamped))
}

function formatScore({ score, mate }) {
  if (mate != null) return `M${Math.abs(mate)}`
  if (score == null) return ''
  const abs = Math.abs(score).toFixed(1)
  return score > 0 ? `+${abs}` : score < 0 ? `-${abs}` : '0.0'
}

export default function EvalBar({ score = 0, mate = null, orientation = 'white' }) {
  const share = whiteShare({ score, mate })
  const whiteIsAhead = mate != null ? mate > 0 : score >= 0
  const flipped = orientation === 'black'

  return (
    <div
      className="relative h-full w-6 shrink-0 overflow-hidden rounded-md bg-eval-black ring-1 ring-slate-800/80 select-none"
      title={`Evaluation ${formatScore({ score, mate })}`}
    >
      {/* White's territory */}
      <div
        className={`absolute inset-x-0 bg-eval-white transition-[height] duration-500 ease-out ${
          flipped ? 'top-0' : 'bottom-0'
        }`}
        style={{ height: `${share}%` }}
      />

      {/* Midline marker */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-slate-500/40" />

      {/* Score label sits on the winning side's block */}
      <span
        className={[
          'absolute inset-x-0 text-center font-mono text-[10px] font-semibold tabular-nums',
          whiteIsAhead !== flipped
            ? 'bottom-1 text-slate-900'
            : 'top-1 text-slate-100',
        ].join(' ')}
      >
        {formatScore({ score, mate })}
      </span>
    </div>
  )
}
