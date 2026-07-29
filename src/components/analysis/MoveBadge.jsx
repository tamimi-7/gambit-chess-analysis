import { CLASSES } from '../../lib/classify'

/**
 * Move-quality badge, drawn as SVG on a 100x100 grid.
 *
 * The exclamation glyphs are geometry rather than typography: a font's "!!"
 * sits on a text baseline with font-dependent spacing, which never centres
 * cleanly inside a disc and changes shape with the loaded weight. Bars and
 * dots are drawn to fixed proportions, so the badge looks identical at 13px
 * in the move list and at 40px on a board square.
 */

const GLYPH = '#eceff0'
const SHADOW = 'rgba(0, 0, 0, 0.16)'

/** One exclamation mark: a tall rounded bar with a squared dot beneath it. */
function Bang({ x }) {
  return (
    <>
      <rect x={x} y="19" width="15.9" height="44" rx="2.4" />
      <rect x={x} y="69" width="15.9" height="14" rx="2.4" />
    </>
  )
}

const STAR =
  'M50 16 L60.4 39.3 L85.8 42 L66.8 59.1 L72.1 84 L50 71.3 L27.9 84 L33.2 59.1 L14.2 42 L39.6 39.3 Z'

const CHECK = 'M24 51 L41 68 L77 32 L85 40 L41 84 L16 59 Z'

const CROSS =
  'M28 20 L50 42 L72 20 L80 28 L58 50 L80 72 L72 80 L50 58 L28 80 L20 72 L42 50 L20 28 Z'

/** Book: two page blocks either side of a spine. */
const BOOK = 'M18 26 h26 a4 4 0 0 1 4 4 v46 a10 10 0 0 0 -8 -4 H18 Z M82 26 h-26 a4 4 0 0 0 -4 4 v46 a10 10 0 0 1 8 -4 H82 Z'

const FORCED = 'M22 38 h56 a3 3 0 0 1 0 8 H22 a3 3 0 0 1 0 -8 Z M22 54 h56 a3 3 0 0 1 0 8 H22 a3 3 0 0 1 0 -8 Z'

/** Shapes for classes that read best as glyphs; sized to match the bars. */
const TEXT = {
  inaccuracy: { label: '?!', size: 52 },
  mistake: { label: '?', size: 58 },
  blunder: { label: '??', size: 50 },
}

function Shape({ classification }) {
  switch (classification) {
    case 'brilliant':
      return (
        <>
          <Bang x="28.8" />
          <Bang x="56.4" />
        </>
      )
    case 'great':
      return <Bang x="42" />
    case 'best':
      return <path d={STAR} />
    case 'excellent':
    case 'good':
      return <path d={CHECK} />
    case 'miss':
      return <path d={CROSS} />
    case 'book':
      return <path d={BOOK} />
    case 'forced':
      return <path d={FORCED} />
    default: {
      const text = TEXT[classification]
      if (!text) return null
      return (
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={text.size}
          fontWeight="800"
          fontFamily="inherit"
        >
          {text.label}
        </text>
      )
    }
  }
}

export default function MoveBadge({ classification, size = 14, fluid = false, title }) {
  const meta = CLASSES[classification]
  if (!meta) return null

  const dimensions = fluid ? { width: '100%', height: 'auto' } : { width: size, height: size }

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={meta.label}
      style={dimensions}
      className={`shrink-0 ${fluid ? 'block drop-shadow-md' : 'inline-block align-[-0.15em]'}`}
    >
      <title>{title ?? meta.label}</title>
      <circle cx="50" cy="50" r="50" fill={meta.color} />
      {/* Offset copy first: gives the glyph the same soft lift as the reference. */}
      <g fill={SHADOW} transform="translate(0 2.5)">
        <Shape classification={classification} />
      </g>
      <g fill={GLYPH}>
        <Shape classification={classification} />
      </g>
    </svg>
  )
}
