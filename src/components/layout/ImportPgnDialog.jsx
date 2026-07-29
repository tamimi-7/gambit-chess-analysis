import { useEffect, useRef, useState } from 'react'

const SAMPLE = `[White "Hikaru"]
[Black "Opponent"]

1. e4 c5 2. Nf3 e6 3. c3 Nf6 4. e5 Nd5 5. d4 cxd4 6. cxd4 d6 7. Bc4 Nb6`

export default function ImportPgnDialog({ open, onClose, onImport }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setTimeout(() => ref.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const submit = () => {
    try {
      onImport(value)
      setValue('')
      onClose()
    } catch (err) {
      setError(err.message ?? 'Could not read that PGN.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-100">Import PGN</h2>
            <p className="text-[11px] text-slate-500">
              Paste a game from chess.com, lichess, or any PGN file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            placeholder={SAMPLE}
            spellCheck={false}
            rows={12}
            className="w-full resize-none rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[12px] leading-relaxed text-slate-300 outline-none placeholder:text-slate-700 focus:border-accent-600"
          />

          {error && (
            <p className="mt-2 rounded border border-red-900/60 bg-red-950/40 px-2 py-1.5 font-mono text-[11px] text-red-300">
              {error}
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-[12px] text-slate-300 transition-colors hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              className="rounded-md bg-accent-500 px-4 py-1.5 text-[12px] font-semibold text-slate-950 transition-colors hover:bg-accent-400 disabled:bg-slate-800 disabled:text-slate-600"
            >
              Load game
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
