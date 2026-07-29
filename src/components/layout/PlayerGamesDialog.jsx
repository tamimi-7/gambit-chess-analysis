import { useCallback, useEffect, useRef, useState } from 'react'
import { ChessComError, fetchArchives, fetchMonth, normalizeUsername } from '../../lib/chesscom'

const STORAGE_KEY = 'gambit:last-chesscom-user'

const TIME_CLASS_STYLE = {
  bullet: 'bg-amber-500/15 text-amber-300',
  blitz: 'bg-yellow-500/15 text-yellow-300',
  rapid: 'bg-accent-500/15 text-accent-300',
  daily: 'bg-sky-500/15 text-sky-300',
}

function ResultDot({ result, playerIsWhite }) {
  const score = result === '½-½' ? 'draw' : (result === '1-0') === playerIsWhite ? 'win' : 'loss'
  const style = {
    win: 'bg-accent-500 text-slate-950',
    loss: 'bg-red-600 text-slate-100',
    draw: 'bg-slate-600 text-slate-100',
  }[score]

  return (
    <span className={`grid size-4 shrink-0 place-items-center rounded-sm text-[9px] font-bold ${style}`}>
      {score === 'win' ? 'W' : score === 'loss' ? 'L' : 'D'}
    </span>
  )
}

function GameRow({ game, username, onSelect }) {
  const playerIsWhite = game.white.name.toLowerCase() === username
  const opponent = playerIsWhite ? game.black : game.white
  const unsupported = game.rules !== 'chess'

  return (
    <button
      type="button"
      disabled={unsupported}
      onClick={() => onSelect(game)}
      title={unsupported ? `${game.rules} is not supported` : `${game.result} · ${game.reason ?? ''}`}
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-35"
    >
      <ResultDot result={game.result} playerIsWhite={playerIsWhite} />

      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span
            className={`size-2 shrink-0 rounded-full ${
              playerIsWhite ? 'bg-slate-200' : 'bg-slate-600 ring-1 ring-slate-500'
            }`}
            title={playerIsWhite ? 'played white' : 'played black'}
          />
          <span className="truncate text-[13px] text-slate-200">{opponent.name}</span>
          <span className="shrink-0 font-mono text-[11px] text-slate-500">{opponent.rating}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-slate-500">
          <span>{game.playedAt.toLocaleDateString()}</span>
          <span className={`rounded px-1 ${TIME_CLASS_STYLE[game.timeClass] ?? 'bg-slate-800'}`}>
            {unsupported ? game.rules : game.timeClass}
          </span>
          {!game.rated && <span>unrated</span>}
        </span>
      </span>

      {game.accuracies && (
        <span className="shrink-0 text-right font-mono text-[10px] leading-tight text-slate-500">
          <span className="block text-slate-400">
            {(playerIsWhite ? game.accuracies.white : game.accuracies.black).toFixed(1)}
          </span>
          <span className="block">chess.com</span>
        </span>
      )}
    </button>
  )
}

export default function PlayerGamesDialog({ open, onClose, onSelect }) {
  const [username, setUsername] = useState('')
  const [archives, setArchives] = useState(null)
  const [month, setMonth] = useState(null)
  const [games, setGames] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setUsername((current) => current || localStorage.getItem(STORAGE_KEY) || '')
    setTimeout(() => inputRef.current?.select(), 30)
  }, [open])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const loadMonth = useCallback(async (archive) => {
    setMonth(archive)
    setStatus('loading-games')
    setError(null)
    try {
      setGames(await fetchMonth(archive.url))
      setStatus('ready')
    } catch (err) {
      setError(err instanceof ChessComError ? err.message : 'Could not load those games.')
      setStatus('idle')
    }
  }, [])

  const search = useCallback(async () => {
    const handle = normalizeUsername(username)
    if (!handle) return

    setUsername(handle)
    setStatus('loading-archives')
    setError(null)
    setGames(null)
    setArchives(null)

    try {
      const list = await fetchArchives(handle)
      if (list.length === 0) {
        setError('That player has no games on chess.com yet.')
        setStatus('idle')
        return
      }
      localStorage.setItem(STORAGE_KEY, handle)
      setArchives(list)
      await loadMonth(list[0])
    } catch (err) {
      setError(err instanceof ChessComError ? err.message : 'Could not reach chess.com.')
      setStatus('idle')
    }
  }, [username, loadMonth])

  if (!open) return null

  const handle = normalizeUsername(username)

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-100">Load from chess.com</h2>
            <p className="text-[11px] text-slate-500">
              Any username — the games come straight from the public API.
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

        <div className="flex gap-2 border-b border-slate-800 px-4 py-3">
          <input
            ref={inputRef}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Hikaru"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-700 focus:border-accent-600"
          />
          <button
            type="button"
            onClick={search}
            disabled={!handle || status.startsWith('loading')}
            className="shrink-0 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-slate-950 transition-colors hover:bg-accent-400 disabled:bg-slate-800 disabled:text-slate-600"
          >
            {status === 'loading-archives' ? 'Searching…' : 'Find games'}
          </button>
        </div>

        {archives && (
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2">
            <span className="label-micro shrink-0">Month</span>
            <select
              value={month?.url ?? ''}
              onChange={(e) => loadMonth(archives.find((a) => a.url === e.target.value))}
              className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[12px] text-slate-300 outline-none focus:border-accent-600"
            >
              {archives.map((archive) => (
                <option key={archive.url} value={archive.url}>
                  {archive.label}
                </option>
              ))}
            </select>
            {games && (
              <span className="shrink-0 font-mono text-[10px] text-slate-600">
                {games.length} games
              </span>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {error && (
            <p className="m-2 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">
              {error}
            </p>
          )}

          {status === 'loading-games' && (
            <p className="p-4 text-center font-mono text-[12px] text-slate-600">Loading games…</p>
          )}

          {!error && !games && status === 'idle' && (
            <p className="p-6 text-center text-[12px] leading-relaxed text-slate-600">
              Type a chess.com username and press Enter.
              <br />
              Pick a game to load it onto the board, then run the review.
            </p>
          )}

          {games?.map((game) => (
            <GameRow key={game.id} game={game} username={handle} onSelect={onSelect} />
          ))}

          {games?.length === 0 && (
            <p className="p-6 text-center text-[12px] text-slate-600">
              No games in that month.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
