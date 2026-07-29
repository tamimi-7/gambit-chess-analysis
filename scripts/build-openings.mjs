/**
 * Builds src/lib/openings.json from the lichess opening book.
 *
 * The TSVs list ~3,500 named lines as PGN. We replay each one and key the
 * resulting position by its FEN (board/turn/castling/ep — move counters are
 * irrelevant to opening identity, and dropping them makes transpositions
 * resolve to the same entry).
 *
 * Run manually: `npm run openings`. The output is committed, so builds and
 * dev servers never need the network.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master'

/** Move counters carry no opening information. */
const positionKey = (fen) => fen.split(' ').slice(0, 4).join(' ')

const book = {}
let lines = 0

for (const file of ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']) {
  const response = await fetch(`${BASE}/${file}`)
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)

  const rows = (await response.text()).split('\n').slice(1)

  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t')
    if (!eco || !pgn) continue

    const game = new Chess()
    try {
      game.loadPgn(pgn)
    } catch {
      continue
    }

    book[positionKey(game.fen())] = `${eco}|${name}`
    lines += 1
  }
}

writeFileSync(join(root, 'src', 'lib', 'openings.json'), JSON.stringify(book))
console.log(`[openings] ${lines} lines -> ${Object.keys(book).length} positions`)
