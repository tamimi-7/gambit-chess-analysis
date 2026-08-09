/**
 * Turns a graded move into one short sentence explaining *why* it earned
 * that grade — an Arabic version for on-screen display, an English version
 * for the speaker button (the only Arabic voice on most systems is a single
 * low-quality SAPI voice; English text-to-speech is near-universally better).
 *
 * Built entirely from data the review already computed — the piece the
 * opponent's best reply captures, the material swing after that reply, and
 * forced-mate distances — so it needs no LLM call and works fully offline,
 * same as the rest of the engine.
 */

const PIECE_NAME_AR = {
  p: 'البيدق',
  n: 'الحصان',
  b: 'الفيل',
  r: 'الرخ',
  q: 'الوزير',
  k: 'الملك',
}

const PIECE_NAME_EN = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

/**
 * A forced mate always maps to the same extreme score regardless of how many
 * moves it takes (see toCp), so a move that keeps *a* mate but not the
 * fastest one shows up as ~0% win-probability lost — the classifier has no
 * way to see it. This catches that case directly by comparing to the
 * engine's own top choice, independent of whatever bucket the move landed in.
 */
function slowerMateNote(ply, lang) {
  const { classification, moverMateBefore, moverMateAfter, bestSan } = ply
  if (classification === 'blunder' || classification === 'mistake' || classification === 'miss') {
    return null // already explained — the mate was lost outright, not just slowed
  }
  if (!(moverMateBefore > 0) || !(moverMateAfter > 0) || moverMateAfter >= moverMateBefore) {
    return null
  }

  return lang === 'en'
    ? `A faster forced mate was on the board (in ${moverMateBefore})${
        bestSan ? ` with ${bestSan}` : ''
      } — this move still wins, just not as quickly.`
    : `كان فيه كش مات أسرع (خلال ${moverMateBefore} نقلة)${
        bestSan ? ` بلعب ${bestSan}` : ''
      } — النقلة هذي لسه رابحة بس أبطأ.`
}

export function explainMove(ply, { openingName } = {}) {
  if (!ply) return ''

  const slower = slowerMateNote(ply, 'ar')
  if (slower) return slower

  const { classification, bestSan, replySan, hanging, swing, moverMateBefore, moverMateAfter } = ply
  const piece = hanging ? PIECE_NAME_AR[hanging.type] : null

  switch (classification) {
    case 'book':
      return openingName
        ? `نقلة افتتاح معروفة ضمن ${openingName}.`
        : 'نقلة افتتاح معروفة ومدروسة.'

    case 'forced':
      return 'النقلة الشرعية الوحيدة في هذا الموضع — ما فيه بديل.'

    case 'brilliant':
      return 'تضحية صحيحة: تتخلى عن مادة، لكن المقابل — هجوم قوي أو تفوق حاسم — يعوّضها بالكامل، وهي أقوى نقلة حسب المحرك.'

    case 'great':
      return 'النقلة الوحيدة اللي تحافظ على الموقف — أي بديل ثاني كان يخسر تقدم كبير.'

    case 'best':
      return 'أفضل نقلة ممكنة في هذا الموضع حسب المحرك.'

    case 'excellent':
      return 'نقلة قوية جداً، قريبة من اختيار المحرك.'

    case 'good':
      return bestSan ? `نقلة سليمة، بس ${bestSan} كانت أدق شوي.` : 'نقلة سليمة.'

    case 'inaccuracy':
      return bestSan
        ? `مو أدق نقلة — ${bestSan} كانت تحافظ على ميزة أوضح.`
        : 'فيه نقلة أفضل بشوي في هذا الموضع.'

    case 'miss':
      if (moverMateBefore > 0) {
        return `كان عندك كش مات مضمون خلال ${moverMateBefore} نقلة${
          bestSan ? ` بلعب ${bestSan}` : ''
        }، وفوّته.`
      }
      return bestSan
        ? `كان عندك فرصة حاسمة (${bestSan}) وفوّتها.`
        : 'كان عندك فرصة حاسمة في هذا الموضع وفوّتها.'

    case 'mistake':
      if (moverMateAfter < 0) {
        return `تسمح للخصم بكش مات مضمون خلال ${Math.abs(moverMateAfter)} نقلة.`
      }
      if (piece) {
        return `تُعلّق ${piece} على ${hanging.square} — الخصم ياخذه بـ ${replySan ?? 'النقلة التالية'}.`
      }
      return 'تفقد جزء من التقدم وتعطي الخصم موقف أفضل.'

    case 'blunder':
      if (moverMateAfter < 0) {
        return `خطأ خطير: يسمح للخصم بكش مات مضمون خلال ${Math.abs(moverMateAfter)} نقلة.`
      }
      if (piece) {
        return `تُعلّق ${piece} مجاناً على ${hanging.square} — الخصم ياخذه بـ ${replySan ?? 'النقلة التالية'}.`
      }
      if (swing >= 2) {
        return `تخسر حوالي ${Math.round(swing)} نقطة مادة بدون مقابل كافٍ.`
      }
      return 'خطأ كبير يدمّر الموقف رغم إنها ما تخسر مادة مباشرة.'

    default:
      return ''
  }
}

/** Same explanation, in English — used only for the speaker button. */
export function explainMoveEn(ply, { openingName } = {}) {
  if (!ply) return ''

  const slower = slowerMateNote(ply, 'en')
  if (slower) return slower

  const { classification, bestSan, replySan, hanging, swing, moverMateBefore, moverMateAfter } = ply
  const piece = hanging ? PIECE_NAME_EN[hanging.type] : null

  switch (classification) {
    case 'book':
      return openingName ? `Known opening theory — ${openingName}.` : 'A known, well-studied opening move.'

    case 'forced':
      return 'The only legal move in this position — there was no alternative.'

    case 'brilliant':
      return "A sound sacrifice: it gives up material, but the compensation — a strong attack or a decisive edge — makes up for it in full, and it's the engine's top choice."

    case 'great':
      return 'The only move that held the position — anything else would have thrown away a big advantage.'

    case 'best':
      return "The strongest move available in this position, according to the engine."

    case 'excellent':
      return "A very strong move, close to the engine's own choice."

    case 'good':
      return bestSan ? `A sound move, though ${bestSan} was a touch more precise.` : 'A sound move.'

    case 'inaccuracy':
      return bestSan
        ? `Not the most precise move — ${bestSan} kept a clearer advantage.`
        : 'There was a slightly better move available here.'

    case 'miss':
      if (moverMateBefore > 0) {
        return `A forced mate in ${moverMateBefore}${bestSan ? ` with ${bestSan}` : ''} was on the board, and it was missed.`
      }
      return bestSan
        ? `A decisive chance (${bestSan}) was there, and it was missed.`
        : 'A decisive chance was on the board here, and it was missed.'

    case 'mistake':
      if (moverMateAfter < 0) {
        return `This lets the opponent force mate in ${Math.abs(moverMateAfter)}.`
      }
      if (piece) {
        return `This hangs the ${piece} on ${hanging.square} — the opponent takes it with ${replySan ?? 'the next move'}.`
      }
      return 'This gives away part of the advantage and hands the opponent a better position.'

    case 'blunder':
      if (moverMateAfter < 0) {
        return `Serious error: this lets the opponent force mate in ${Math.abs(moverMateAfter)}.`
      }
      if (piece) {
        return `This hangs the ${piece} for free on ${hanging.square} — the opponent takes it with ${replySan ?? 'the next move'}.`
      }
      if (swing >= 2) {
        return `This loses roughly ${Math.round(swing)} points of material without enough compensation.`
      }
      return 'A serious error that wrecks the position, even without losing material outright.'

    default:
      return ''
  }
}
