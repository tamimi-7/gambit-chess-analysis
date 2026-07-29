import { defaultPieces } from 'react-chessboard'

const CHOICES = ['q', 'n', 'r', 'b']
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

/**
 * Piece selector rendered over the promotion file, anchored to the promoting
 * side's edge of the board (chess.com style) rather than a centred modal —
 * the pieces land exactly where the user is already looking.
 */
export default function PromotionPicker({ target, color, orientation, onSelect, onCancel }) {
  const fileIndex = FILES.indexOf(target[0])
  const col = orientation === 'white' ? fileIndex : 7 - fileIndex
  // White promotes on rank 8: top of the board when viewed from white's side.
  const fromTop = (color === 'w') === (orientation === 'white')

  return (
    <div
      className="absolute inset-0 z-30 bg-slate-950/70 backdrop-blur-[2px]"
      onClick={onCancel}
      onContextMenu={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div
        className={`absolute flex w-[12.5%] flex-col overflow-hidden rounded-md bg-slate-800 shadow-2xl shadow-black/60 ring-1 ring-slate-600 ${
          fromTop ? 'top-0' : 'bottom-0 flex-col-reverse'
        }`}
        style={{ left: `${col * 12.5}%` }}
        onClick={(e) => e.stopPropagation()}
      >
        {CHOICES.map((piece) => {
          const Piece = defaultPieces[`${color}${piece.toUpperCase()}`]
          return (
            <button
              key={piece}
              type="button"
              onClick={() => onSelect(piece)}
              aria-label={`Promote to ${piece}`}
              className="aspect-square p-[6%] transition-colors hover:bg-accent-500/30"
            >
              <Piece />
            </button>
          )
        })}
      </div>
    </div>
  )
}
