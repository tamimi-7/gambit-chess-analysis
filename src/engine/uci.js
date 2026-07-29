import { Chess } from 'chess.js'

/**
 * Parse a single UCI `info` line into a plain object.
 *
 * Lines without a `pv` (currmove progress reports, `info string ...`) carry no
 * evaluation and are dropped.
 */
export function parseInfo(line) {
  if (!line.startsWith('info ')) return null

  const t = line.split(/\s+/)
  const info = {}

  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        info.depth = Number(t[++i])
        break
      case 'seldepth':
        info.seldepth = Number(t[++i])
        break
      case 'multipv':
        info.multipv = Number(t[++i])
        break
      case 'nodes':
        info.nodes = Number(t[++i])
        break
      case 'nps':
        info.nps = Number(t[++i])
        break
      case 'time':
        info.time = Number(t[++i])
        break
      case 'hashfull':
        info.hashfull = Number(t[++i])
        break
      case 'score': {
        const type = t[++i]
        const value = Number(t[++i])
        if (type === 'cp') info.cp = value
        else if (type === 'mate') info.mate = value
        break
      }
      case 'wdl':
        info.wdl = [Number(t[i + 1]), Number(t[i + 2]), Number(t[i + 3])]
        i += 3
        break
      // A fail-high/fail-low result: the true score is outside the search
      // window, so the number reported is a bound, not an evaluation.
      // Displaying these is what makes hobby analysis boards flicker.
      case 'lowerbound':
      case 'upperbound':
        info.bound = t[i]
        break
      case 'pv':
        info.pv = t.slice(i + 1)
        i = t.length
        break
      default:
        break
    }
  }

  return info.pv?.length ? info : null
}

/**
 * Flip a side-to-move relative score into White's frame of reference.
 *
 * UCI *always* reports from the perspective of the player to move: "+1.20"
 * in a black-to-move position means Black is winning. Skipping this is the
 * single most common reason a homemade board disagrees with lichess.
 */
export function toWhitePov({ cp, mate }, fen) {
  const sign = fen.split(' ')[1] === 'b' ? -1 : 1
  return {
    score: cp == null ? null : (cp * sign) / 100,
    mate: mate == null ? null : mate * sign,
  }
}

/** Render a UCI principal variation as SAN, numbered from the real move number. */
export function pvToSan(fen, uciMoves, limit = 14) {
  const game = new Chess(fen)
  const parts = []
  let moveNumber = Number(fen.split(' ')[5]) || 1
  let whiteToMove = fen.split(' ')[1] === 'w'

  for (const uci of uciMoves.slice(0, limit)) {
    let move
    try {
      move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      })
    } catch {
      break // engine PVs can run past what we can legally replay — stop cleanly
    }

    if (whiteToMove) parts.push(`${moveNumber}.`)
    else if (parts.length === 0) parts.push(`${moveNumber}...`)

    parts.push(move.san)

    if (!whiteToMove) moveNumber += 1
    whiteToMove = !whiteToMove
  }

  return parts.join(' ')
}
