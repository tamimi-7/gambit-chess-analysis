import { useEffect, useState } from 'react'
import EngineOutput from './EngineOutput'
import MoveList from './MoveList'
import ReviewPanel from './ReviewPanel'
import MoveExplanation from './MoveExplanation'
import useSpeech from '../../hooks/useSpeech'
import { explainMove, explainMoveEn } from '../../lib/explain'

function FenBar({ fen }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(fen)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="border-t border-slate-800 px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="label-micro">FEN</span>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[10px] uppercase tracking-wider text-slate-500 transition-colors hover:text-accent-400"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <code className="block truncate font-mono text-[11px] text-slate-500" title={fen}>
        {fen}
      </code>
    </div>
  )
}

function Tab({ active, onClick, children, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative flex-1 px-3 py-2 text-[12px] font-medium transition-colors',
        active ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300',
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {badge}
      </span>
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent-500" />}
    </button>
  )
}

/**
 * Right rail. A tab switches the top block between live engine output and the
 * whole-game review; the move list underneath is shared by both.
 */
export default function AnalysisPanel({
  engine,
  review,
  moves,
  activePly,
  onSelectPly,
  fen,
  tab,
  onTabChange,
}) {
  const running = review.progress.state === 'running' || review.progress.state === 'loading'

  const currentEntry = review.byPly?.[activePly] ?? null
  const openingName = review.report?.opening?.name
  const explanation = explainMove(currentEntry, { openingName })
  // Spoken aloud in English regardless of the display language — see useSpeech.
  const spokenExplanation = explainMoveEn(currentEntry, { openingName })
  const speech = useSpeech()

  // Reading the wrong move's explanation because the player kept navigating
  // is worse than not reading anything — cut it off the moment the ply changes.
  const stopSpeech = speech.stop
  useEffect(() => {
    stopSpeech()
  }, [activePly, stopSpeech])

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/30 backdrop-blur-sm">
      <div className="flex border-b border-slate-800 bg-slate-950/40">
        <Tab active={tab === 'engine'} onClick={() => onTabChange('engine')}>
          Engine
        </Tab>
        <Tab
          active={tab === 'review'}
          onClick={() => onTabChange('review')}
          badge={
            running ? (
              <span className="size-1.5 animate-pulse rounded-full bg-accent-400" />
            ) : review.report ? (
              <span className="size-1.5 rounded-full bg-accent-500" />
            ) : null
          }
        >
          Review
        </Tab>
      </div>

      {tab === 'engine' ? <EngineOutput {...engine} /> : <ReviewPanel {...review} />}

      <MoveExplanation
        entry={currentEntry}
        text={explanation}
        speaking={speech.speaking}
        supported={speech.supported}
        onToggleSpeech={() => (speech.speaking ? speech.stop() : speech.speak(spokenExplanation))}
      />

      <MoveList
        moves={moves}
        activePly={activePly}
        review={review.byPly}
        onSelect={onSelectPly}
      />
      <FenBar fen={fen} />
    </aside>
  )
}
