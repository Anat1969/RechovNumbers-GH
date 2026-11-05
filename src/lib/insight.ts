// תובנות מחושבות: נוסח קבוע שמתמלא במספרים מהמנוע. אין כאן מודל, ולכן זה עובד תמיד.
import type { Model, Param, QuarterSummary, Scored } from './model';

export const fmtVal = (p: Param, x: Scored) => {
  const v = x.values[p.key];
  return v == null ? 'לא נמדד' : `${p.fmt(v, x.s.m)}${p.unit && p.key !== 'class' ? ' ' + p.unit : ''}`;
};

export function answers(sum: QuarterSummary, place: string) {
  const { best, worst, weakParam: w, gapParam: g } = sum;
  return {
    best: best ? { name: best.s.name, score: best.total!, sub: `הציון הגבוה מתוך ${sum.streets.length} רחובות ב${place}.` } : null,
    worst: worst && worst !== best ? {
      name: worst.s.name, score: worst.total!,
      sub: g ? `הפער הגדול מול ${best!.s.name}: ${g.p.label} (${fmtVal(g.p, worst)} מול ${fmtVal(g.p, best!)}).` : 'הציון הנמוך בשכונה.',
    } : null,
    weak: w ? {
      name: w.p.label, score: Math.round(w.avg * 100),
      sub: `חציון בשכונה: ${w.value == null ? '—' : w.p.fmt(w.value, {}) + (w.p.unit && w.p.key !== 'class' ? ' ' + w.p.unit : '')}. היעד: ${w.p.target}.`,
    } : null,
  };
}

export function underMap(sum: QuarterSummary, place: string, colorBy: Param | null): string {
  if (!sum.streets.length) return 'אין ברובע הזה רחובות עם קו מדוד.';
  const pass = sum.streets.filter((x) => x.total! >= 60).length;
  if (colorBy) {
    const vals = sum.streets.map((x) => x.scores[colorBy.key]).filter((v): v is number => v != null);
    const full = vals.filter((v) => v >= 0.99).length, zero = vals.filter((v) => v <= 0.01).length;
    return `==**${full}** רחובות עומדים ביעד של ${colorBy.label}==, ו-**${zero}** רחוקים ממנו לגמרי. היעד: **${colorBy.target}**.`;
  }
  return `==**${pass}** מתוך **${sum.streets.length}** רחובות ב${place} עוברים ציון **60**.== ממוצע הרובע: **${sum.avg}**.`;
}

export function cityHeadline(model: Model) {
  const n = model.streets.filter((x) => x.total != null).length;
  return {
    line: `==**${n}** רחובות באשדוד, ציון אחד לכל רחוב.==`,
    explain: `**${model.measuredInd.length}** מתוך **44** מדדי שכונה 360 נמדדים ברחוב, ששווים **${model.maxPoints}** מתוך **120** נקודות.`,
  };
}

/** מה נשלח למודל: רק מספרים ציבוריים על רחובות, בלי מידע אישי. */
export function distillPayload(sum: QuarterSummary, place: string, model: Model) {
  return {
    place, streets: sum.streets.length, avg: sum.avg,
    best: sum.best && { name: sum.best.s.name, score: sum.best.total },
    worst: sum.worst && { name: sum.worst.s.name, score: sum.worst.total },
    params: model.entering.map((p) => {
      const vals = sum.streets.map((x) => x.scores[p.key]).filter((v): v is number => v != null);
      return { name: p.label, target: p.target, avgScore: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) : null };
    }),
    weakest: sum.streets.slice(-5).map((x) => ({ name: x.s.name, score: x.total })),
    notMeasured: ['עצים וצל', 'חזית מסחרית', 'ספסלים', 'תאורה'],
  };
}
