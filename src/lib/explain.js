/**
 * Turns a graded move into one short, spoken-friendly Arabic sentence
 * explaining *why* it earned that grade.
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

export function explainMove(ply, { openingName } = {}) {
  if (!ply) return ''

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
