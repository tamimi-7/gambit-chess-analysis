# Gambit — Chess Analysis Board

Client-side chess analysis board. Stockfish 18 (NNUE) runs in a Web Worker in
the browser — no server, no API calls, no per-user cost.

```bash
npm install
npm run dev
```

## Stack

| Concern | Choice |
| --- | --- |
| Build | Vite + React 19 |
| Styling | Tailwind CSS v4 (tokens in `src/index.css`) |
| Rules / SAN / FEN | `chess.js` |
| Board UI | `react-chessboard` v5 |
| Engine | `stockfish` 18 WASM (NNUE), run as a Web Worker |

## The engine

`npm run engine` copies the WASM binaries from `node_modules/stockfish/bin`
into `public/engine/`. It runs automatically before `dev` and `build`.

The default build is **Stockfish 18 Lite** (~7 MB, small NNUE net) — the same
class of network lichess ships to browsers, and strong enough that its
evaluations track a full-strength engine closely at analysis depths.

For the full-size net (~108 MB download, marginal accuracy gain):

```bash
npm run engine:full
```

Then point `THREADED_BUILD` / `SINGLE_BUILD` in
`src/engine/StockfishEngine.js` at `stockfish-18` / `stockfish-18-single`.

### Cross-origin isolation (important)

Multi-threaded WASM requires `SharedArrayBuffer`, which browsers only grant to
cross-origin isolated pages. `vite.config.js` sets the headers for `dev` and
`preview`. **Your production host must send them too**, or the app falls back
to the single-threaded engine — correct results, several times slower.

Netlify (`public/_headers`):

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

Vercel (`vercel.json`):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

The engine panel shows the active thread count, so you can confirm isolation
worked in production at a glance (`… · 7t` vs `… · 1t · single`).

## Loading games

**chess.com** in the top bar takes any username and lists that player's games
month by month, straight from `api.chess.com/pub`. No proxy: the API sends
`Access-Control-Allow-Origin: *`, and a response fetched through CORS is exempt
from the `Cross-Origin-Resource-Policy` rule that this app's COEP header
otherwise enforces — so the whole thing stays client-side.

Games that chess.com has already reviewed carry their own accuracy figures.
Those are shown in the list and again beside our numbers after a review, as a
free cross-check.

**Import PGN** takes a pasted game from anywhere. Variants (chess960 and the
rest) are listed but not loadable — the rules engine here is standard chess.

## Game review

Import a PGN, then **Review game**. Every position is evaluated once, and each
move is graded against the evaluation of the position it came from.

Two passes: the first sweeps the game under a per-position *time* budget (a
depth budget has no predictable runtime — sharp positions cost far more per
depth than quiet ones). The second re-examines only the moves that were
flagged, with 4× the budget, so a shallow misread does not end up labelling a
forced recapture a mistake.

Grades come from **win probability**, not centipawns: giving up 100cp at 0.00
is serious, giving up 100cp at +9 is nothing. Accuracy uses lichess's
published model (`AccuracyPercent.scala`).

That model is not chess.com's. Their CAPS2 scoring is proprietary and grades
harder, so the percentages here read a few points higher — the evaluations and
move classifications track chess.com closely, the final percentage is a
different formula and is labelled as such in the panel.

`▣ Book` comes from the lichess opening dataset — 3,807 named lines, rebuilt
with `npm run openings` (needs network; the output is committed).

A move is `!! Brilliant` only when it is the engine's first choice, gives up
at least two points of material, the opponent's best answer takes what was
offered, and the player was not already up material. Each of those clauses
removes a specific class of false positive.

### Why — one sentence per move

Selecting a graded move shows a one-line reason above the move list: which
piece the opponent's best reply captures and where, a forced-mate distance,
or "the engine's first choice" for a `Best`. All of it comes from data the
review already computed (`src/lib/explain.js` — no LLM call).

A speaker button reads that sentence aloud with the browser's built-in
**Web Speech API** (`src/hooks/useSpeech.js`) — no network call, no API key.
It prefers an Arabic voice (`ar-SA`) if the OS has one installed; otherwise
the browser's default voice reads it. Switching moves cuts off anything still
being read, so it never narrates the wrong position.

## Layout

```
src/
├─ engine/          UCI parsing + worker lifecycle
├─ hooks/           useChessGame (position), useEngine (live search),
│                   useGameReview (whole-game pass)
├─ lib/             FEN helpers, classification model, opening book
└─ components/      board/ + analysis/ + layout/
```

## Keyboard

| Key | Action |
| --- | --- |
| `←` `→` | Previous / next move |
| `Home` `End` | Start / end of game |
| `F` | Flip the board |

## Licence note

Stockfish is GPLv3. Shipping its WASM binaries makes this project's
distribution subject to the GPL — keep the source available if you deploy it
publicly.
