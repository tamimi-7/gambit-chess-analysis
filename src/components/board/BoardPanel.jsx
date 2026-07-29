import Board from './Board'
import EvalBar from './EvalBar'
import PlayerStrip from './PlayerStrip'
import BoardControls from './BoardControls'

/**
 * The board column: player strips, evaluation bar + board, and controls.
 * Width is capped by viewport height so the board never overflows the fold.
 */
export default function BoardPanel({
  game,
  orientation,
  onFlip,
  evaluation,
  bestMove,
  moveReview,
  accuracy,
  onReset,
}) {
  const top = orientation === 'white' ? 'black' : 'white'
  const bottom = orientation === 'white' ? 'white' : 'black'

  const strip = (side) => ({
    color: side,
    name: side === 'white' ? game.players.white : game.players.black,
    rating: side === 'white' ? game.players.whiteElo : game.players.blackElo,
    captured: game.material[side].captured,
    diff: game.material[side].diff,
    toMove: game.turn === side[0],
    accuracy: accuracy?.[side[0]] ?? null,
  })

  return (
    <section className="mx-auto flex w-full max-w-[min(100%,calc(100dvh-12.5rem))] flex-col gap-2.5">
      <PlayerStrip {...strip(top)} />

      <div className="flex gap-2.5">
        <EvalBar {...evaluation} orientation={orientation} />
        <div className="min-w-0 flex-1">
          <Board
            fen={game.fen}
            orientation={orientation}
            turn={game.turn}
            lastMove={game.lastMove}
            checkSquare={game.checkSquare}
            movesFrom={game.movesFrom}
            onMove={game.makeMove}
            locked={game.status.over}
            bestMove={bestMove}
            moveReview={moveReview}
          />
        </div>
      </div>

      <PlayerStrip {...strip(bottom)} />

      <BoardControls
        onFirst={() => game.goTo(0)}
        onPrev={() => game.goTo(game.ply - 1)}
        onNext={() => game.goTo(game.ply + 1)}
        onLast={() => game.goTo(game.history.length)}
        onFlip={onFlip}
        onReset={onReset ?? game.reset}
        canGoBack={game.canGoBack}
        canGoForward={game.canGoForward}
        status={game.status}
      />
    </section>
  )
}
