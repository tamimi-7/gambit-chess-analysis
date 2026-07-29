import { useCallback, useEffect, useMemo, useState } from 'react'
import { Chessboard, defaultArrowOptions } from 'react-chessboard'
import PromotionPicker from './PromotionPicker'
import MoveBadge from '../analysis/MoveBadge'

const FILES = 'abcdefgh'

/** Square name -> percentage offsets inside the board, honouring orientation. */
function squareOffset(square, orientation) {
  const file = FILES.indexOf(square[0])
  const rank = Number(square[1]) - 1
  const col = orientation === 'white' ? file : 7 - file
  const row = orientation === 'white' ? 7 - rank : rank
  return { left: `${col * 12.5}%`, top: `${row * 12.5}%` }
}

/* Square decorations. Gradients (not borders) so nothing shifts the layout. */
const HIGHLIGHT = { backgroundColor: 'rgba(247, 210, 106, 0.42)' }
const SELECTED = { backgroundColor: 'rgba(247, 210, 106, 0.58)' }
const MOVE_DOT = {
  background: 'radial-gradient(circle, rgba(15,23,42,0.32) 17%, transparent 18%)',
}
const CAPTURE_RING = {
  background: 'radial-gradient(circle, transparent 62%, rgba(15,23,42,0.32) 63%)',
}
const CHECK = {
  background:
    'radial-gradient(circle, rgba(220,38,38,0.95) 8%, rgba(220,38,38,0.55) 45%, transparent 74%)',
}

export default function Board({
  fen,
  orientation,
  turn,
  lastMove,
  checkSquare,
  movesFrom,
  onMove,
  locked = false,
  bestMove = null,
  moveReview = null,
}) {
  const [selected, setSelected] = useState(null)
  const [promotion, setPromotion] = useState(null)

  // Any position change (move, navigation, reset) invalidates the selection.
  useEffect(() => {
    setSelected(null)
    setPromotion(null)
  }, [fen])

  const targets = useMemo(
    () => (selected ? movesFrom(selected) : []),
    [selected, movesFrom],
  )

  /**
   * Central move gate for both drag and click input.
   * Returns true when the move was consumed (played, or promotion opened).
   */
  const attemptMove = useCallback(
    (from, to) => {
      const candidates = movesFrom(from).filter((m) => m.to === to)
      if (candidates.length === 0) return false

      // Four legal moves share from/to when a pawn promotes — ask the user.
      if (candidates.some((m) => m.promotion)) {
        setPromotion({ from, to, color: candidates[0].color })
        return false
      }

      setSelected(null)
      return Boolean(onMove({ from, to }))
    },
    [movesFrom, onMove],
  )

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }) => {
      if (locked || !targetSquare) return false
      return attemptMove(sourceSquare, targetSquare)
    },
    [attemptMove, locked],
  )

  const onSquareClick = useCallback(
    ({ square, piece }) => {
      if (locked) return

      if (selected && square !== selected && attemptMove(selected, square)) return

      // Select only your own pieces; clicking elsewhere clears.
      const isOwnPiece = piece && piece.pieceType[0] === turn
      setSelected(isOwnPiece && square !== selected ? square : null)
    },
    [attemptMove, locked, selected, turn],
  )

  const squareStyles = useMemo(() => {
    const styles = {}
    if (lastMove) {
      styles[lastMove.from] = HIGHLIGHT
      styles[lastMove.to] = HIGHLIGHT
    }
    if (checkSquare) styles[checkSquare] = CHECK
    if (selected) styles[selected] = SELECTED
    for (const move of targets) {
      styles[move.to] = move.captured ? CAPTURE_RING : MOVE_DOT
    }
    return styles
  }, [lastMove, checkSquare, selected, targets])

  // The engine's best move, drawn as an arrow while nothing is selected.
  const arrows = useMemo(() => {
    if (!bestMove || selected) return []
    return [
      {
        startSquare: bestMove.slice(0, 2),
        endSquare: bestMove.slice(2, 4),
        color: 'rgba(150, 224, 97, 0.62)',
      },
    ]
  }, [bestMove, selected])

  const options = useMemo(
    () => ({
      id: 'analysis-board',
      position: fen,
      boardOrientation: orientation,
      allowDragging: !locked,
      allowDrawingArrows: true,
      animationDurationInMs: 180,
      arrows,
      squareStyles,
      onPieceDrop,
      onSquareClick,
      boardStyle: {
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: '0 24px 48px -12px rgba(0,0,0,0.55)',
      },
      darkSquareStyle: { backgroundColor: 'var(--color-board-dark)' },
      lightSquareStyle: { backgroundColor: 'var(--color-board-light)' },
      dropSquareStyle: { boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.65)' },
      darkSquareNotationStyle: { color: 'var(--color-board-light)', fontSize: '11px' },
      lightSquareNotationStyle: { color: 'var(--color-board-dark)', fontSize: '11px' },
      // Must spread the defaults: the board reads geometry values (widths,
      // offsets) straight off this object and renders NaN without them.
      arrowOptions: { ...defaultArrowOptions, color: 'rgba(150, 224, 97, 0.75)' },
    }),
    [fen, orientation, locked, arrows, squareStyles, onPieceDrop, onSquareClick],
  )

  return (
    <div className="relative aspect-square w-full ring-1 ring-slate-700/50 rounded-md">
      <Chessboard options={options} />

      {/* Review verdict, pinned to the corner of the square just played. */}
      {moveReview && lastMove && (
        <div
          className="pointer-events-none absolute z-20 w-[12.5%]"
          style={squareOffset(lastMove.to, orientation)}
        >
          <div className="-mt-[9%] ml-[68%] w-[46%]">
            <MoveBadge
              classification={moveReview.classification}
              fluid
              title={
                moveReview.bestSan
                  ? `${moveReview.classification} · best was ${moveReview.bestSan}`
                  : moveReview.classification
              }
            />
          </div>
        </div>
      )}

      {promotion && (
        <PromotionPicker
          target={promotion.to}
          color={promotion.color}
          orientation={orientation}
          onCancel={() => setPromotion(null)}
          onSelect={(piece) => {
            onMove({ from: promotion.from, to: promotion.to, promotion: piece })
            setPromotion(null)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
