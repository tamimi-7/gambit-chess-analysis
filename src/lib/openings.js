/**
 * Opening book lookup, backed by the lichess opening dataset
 * (3,807 named lines — see scripts/build-openings.mjs).
 *
 * Loaded on demand: it is ~430 KB of JSON that most sessions never touch
 * until a game is reviewed, so it lives in its own chunk.
 */
let book = null
let loading = null

export function loadOpenings() {
  if (book) return Promise.resolve(book)
  loading ??= import('./openings.json').then((module) => {
    book = module.default
    return book
  })
  return loading
}

/** Move counters are not part of an opening's identity. */
const key = (fen) => fen.split(' ').slice(0, 4).join(' ')

/** `{ eco, name }` when the position is a named opening, otherwise null. */
export function lookupOpening(fen) {
  const entry = book?.[key(fen)]
  if (!entry) return null
  const [eco, ...rest] = entry.split('|')
  return { eco, name: rest.join('|') }
}

/**
 * How far the game followed known theory.
 *
 * Book moves are treated as a contiguous prefix: the last position found in
 * the dataset ends theory. Without that rule a single unnamed transposition
 * mid-sequence would split the opening into "book, not book, book".
 */
export function bookPrefix(fens) {
  let lastBookPly = -1
  let opening = null

  for (let i = 1; i < fens.length && i <= 30; i++) {
    const found = lookupOpening(fens[i])
    if (found) {
      lastBookPly = i
      opening = found
    }
  }

  return { lastBookPly, opening }
}
