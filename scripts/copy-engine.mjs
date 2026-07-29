/**
 * Copies the Stockfish WASM binaries out of node_modules into public/engine
 * so they are served as static assets (the engine loads its own .wasm at
 * runtime, so it cannot go through Vite's bundler).
 *
 * Default: the "lite" build (~7 MB, small NNUE net) — the same class of net
 * lichess ships to browsers. Run with `--full` to also copy the big-net build
 * (~108 MB) and set VITE_SF_BUILD=full to use it.
 */
import { existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'stockfish', 'bin')
const dest = join(root, 'public', 'engine')

const files = [
  'stockfish-18-lite.js',
  'stockfish-18-lite.wasm',
  'stockfish-18-lite-single.js',
  'stockfish-18-lite-single.wasm',
]

if (process.argv.includes('--full')) {
  files.push('stockfish-18.js', 'stockfish-18.wasm')
  files.push('stockfish-18-single.js', 'stockfish-18-single.wasm')
}

mkdirSync(dest, { recursive: true })

let copied = 0
for (const file of files) {
  const from = join(src, file)
  const to = join(dest, file)

  if (!existsSync(from)) {
    console.warn(`[engine] missing ${file} — run "npm install stockfish"`)
    continue
  }
  // Skip unchanged files: the big net is 108 MB and this runs on every dev start.
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue

  copyFileSync(from, to)
  copied += 1
}

console.log(
  copied ? `[engine] copied ${copied} file(s) to public/engine` : '[engine] up to date',
)
