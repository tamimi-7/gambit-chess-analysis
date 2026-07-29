/** Pure helpers around FEN strings — no React, no chess.js instance needed. */

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 }
const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' }
const ORDER = ['q', 'r', 'b', 'n', 'p']

/**
 * Captured material per side, derived by diffing the board against the
 * starting army. Returns glyph strings plus the point balance.
 */
export function materialInfo(fen) {
  const board = fen.split(' ')[0]
  const alive = { w: {}, b: {} }

  for (const ch of board) {
    if (!/[pnbrq]/i.test(ch)) continue
    const color = ch === ch.toUpperCase() ? 'w' : 'b'
    const type = ch.toLowerCase()
    alive[color][type] = (alive[color][type] ?? 0) + 1
  }

  const side = (color) => {
    let glyphs = ''
    let points = 0
    for (const type of ORDER) {
      // Pieces missing from `color`'s army were captured by the opponent.
      const lost = Math.max(0, START_COUNT[type] - (alive[color][type] ?? 0))
      glyphs += GLYPH[type].repeat(lost)
      points += lost * PIECE_VALUE[type]
    }
    return { glyphs, points }
  }

  const white = side('w')
  const black = side('b')

  return {
    // What each player has taken from the other, and by how much they lead.
    white: { captured: black.glyphs, diff: Math.max(0, black.points - white.points) },
    black: { captured: white.glyphs, diff: Math.max(0, white.points - black.points) },
  }
}

/** Locate a king on the board, e.g. findKing(fen, 'w') -> 'e1'. */
export function findKing(fen, color) {
  const rows = fen.split(' ')[0].split('/')
  const target = color === 'w' ? 'K' : 'k'

  for (let r = 0; r < 8; r++) {
    let file = 0
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) {
        file += Number(ch)
      } else {
        if (ch === target) return `${'abcdefgh'[file]}${8 - r}`
        file += 1
      }
    }
  }
  return null
}
