import { CLASSES } from '../../lib/classify'
import MoveBadge from './MoveBadge'

function SpeakerIcon({ active }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      {active ? (
        <rect x="7" y="7" width="10" height="10" rx="2" />
      ) : (
        <>
          <path d="M4 9v6h4l5 5V4L8 9H4z" />
          <path d="M16.2 8.3a5 5 0 0 1 0 7.4" />
        </>
      )}
    </svg>
  )
}

/**
 * One-line "why" for the currently reviewed move, with a button to have it
 * read aloud via the browser's Speech API. Sits above the move list so it is
 * visible no matter which tab (engine / review) is active.
 */
export default function MoveExplanation({ entry, text, speaking, supported, onToggleSpeech }) {
  if (!entry || !text) return null

  const meta = CLASSES[entry.classification]

  return (
    <div className="flex items-start gap-2.5 border-b border-slate-800 bg-slate-950/40 px-3 py-2.5">
      <MoveBadge classification={entry.classification} size={22} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[12px] text-slate-300">{entry.san}</span>
          <span className="text-[11px] font-semibold" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <p dir="rtl" className="mt-0.5 text-right text-[12px] leading-relaxed text-slate-300">
          {text}
        </p>
      </div>

      {supported && (
        <button
          type="button"
          onClick={onToggleSpeech}
          aria-label={speaking ? 'إيقاف القراءة' : 'استمع للشرح'}
          title={speaking ? 'إيقاف' : 'استمع للشرح'}
          className={[
            'grid size-8 shrink-0 place-items-center rounded-md transition-colors',
            speaking
              ? 'bg-accent-500 text-slate-950'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
          ].join(' ')}
        >
          <SpeakerIcon active={speaking} />
        </button>
      )}
    </div>
  )
}
