// ממצאים מחושבים: מקרו (עיר), רובע ומיקרו (רחוב). נוסח קבוע שמתמלא במספרים מהמנוע, בלי מודל.
import { ACTIONS, TIERS, type Tier } from './actions';
import { fmtVal } from './insight';
import { IND } from '../data/indicators';
import { QMAP, QUARTERS } from '../data/quarters';
import { summarize, type Model, type Param, type QuarterSummary, type Scored } from './model';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const fmtRaw = (p: Param, v: number | null) => (v == null ? '—' : p.fmt(v, {}) + (p.unit && p.key !== 'class' ? ' ' + p.unit : ''));

/** משקל פרמטר: הנקודות של המדדים שהוא מודד, מחולקות בין הפרמטרים שמודדים אותם. */
export function weightOf(model: Model, p: Param) {
  return p.indicators.reduce((a, id) => a + IND[id].maxScore / Math.max(1, model.entering.filter((q) => q.indicators.includes(id)).length), 0);
}

export interface ProfileRow { p: Param; score: number; meet: number; far: number; median: number | null }
/** פרופיל של קבוצת רחובות: כמה כל פרמטר מתקיים, כמה רחובות עומדים ביעד וכמה רחוקים ממנו. */
export function profile(model: Model, streets: Scored[]): ProfileRow[] {
  return model.entering.map((p) => {
    const ss = streets.map((x) => x.scores[p.key]).filter((v): v is number => v != null);
    const vs = streets.map((x) => x.values[p.key]).filter((v): v is number => v != null);
    return { p, score: Math.round(avg(ss) * 100), meet: pct(ss.filter((v) => v >= 0.99).length, ss.length), far: pct(ss.filter((v) => v <= 0.25).length, ss.length), median: med(vs) };
  });
}

export interface QRank { id: string; name: string; sum: QuarterSummary }
export function quarterRanks(model: Model): QRank[] {
  return QUARTERS.filter((q) => q.kind === 'quarter').map((q) => ({ id: q.id, name: q.name, sum: summarize(model, [q.id], q.id) }))
    .filter((x) => x.sum.streets.length >= 3).sort((a, b) => (b.sum.avg ?? 0) - (a.sum.avg ?? 0));
}

/** המקרו: מה העיר אומרת. */
export function cityStory(model: Model) {
  const city = summarize(model, null);
  const prof = profile(model, city.streets).sort((a, b) => a.score - b.score);
  const ranks = quarterRanks(model);
  const top = ranks[0], low = ranks[ranks.length - 1];
  const weak = prof[0], strong = prof[prof.length - 1];
  const hist = Array.from({ length: 10 }, (_, i) => city.streets.filter((x) => Math.min(9, Math.floor(x.total! / 10)) === i).length);
  const below50 = city.streets.filter((x) => x.total! < 50).length;
  // הפרמטר שמסביר את הפער בין הרובע המוביל לחלש
  let driver: { p: Param; gap: number } | null = null;
  if (top && low) {
    const pt = profile(model, top.sum.streets), pl = profile(model, low.sum.streets);
    for (const r of pt) { const l = pl.find((x) => x.p.key === r.p.key)!; const g = r.score - l.score; if (!driver || g > driver.gap) driver = { p: r.p, gap: g }; }
  }
  return {
    city, prof, ranks, hist, below50, top, low, driver,
    lines: [
      `==הצוואר הצר של אשדוד: **${weak.p.label}**.== רק **${weak.meet}%** מהרחובות עומדים ביעד (${weak.p.target}), ו-**${weak.far}%** רחוקים ממנו לגמרי.`,
      `החוזקה: **${strong.p.label}**, **${strong.meet}%** מהרחובות ביעד. העיר נבנתה עם ${strong.p.key === 'busdist' ? 'רשת תחנות צפופה' : strong.p.key === 'parkdist' ? 'גנים קרובים לבית' : 'בסיס טוב בפרמטר הזה'}.`,
      top && low ? `הפער בין **${top.name}** (**${top.sum.avg}**) ל**${low.name}** (**${low.sum.avg}**) הוא **${(top.sum.avg ?? 0) - (low.sum.avg ?? 0)}** נקודות${driver ? `, ורובו ב**${driver.p.label}**` : ''}.` : '',
      `**${below50}** מתוך **${city.streets.length}** רחובות מתחת ל-**50**. הם רשימת העבודה הראשונה.`,
    ].filter(Boolean),
  };
}

/** הרובע: מה מייחד אותו מול העיר, ומה מפריד בין הרחובות שלו. */
export function quarterStory(model: Model, qid: string) {
  const sum = summarize(model, [qid], qid);
  const city = summarize(model, null);
  const ranks = quarterRanks(model);
  const place = ranks.findIndex((r) => r.id === qid) + 1;
  const name = QMAP[qid]?.name ?? 'הרובע';
  if (!sum.streets.length) return { sum, lines: ['אין ברובע הזה רחובות מדודים.'], rel: [] as { p: Param; d: number; q: number; c: number }[] };
  const pq = profile(model, sum.streets), pc = profile(model, city.streets);
  const rel = pq.map((r) => ({ p: r.p, q: r.score, c: pc.find((x) => x.p.key === r.p.key)!.score, d: r.score - pc.find((x) => x.p.key === r.p.key)!.score })).sort((a, b) => b.d - a.d);
  const better = rel[0], worse = rel[rel.length - 1];
  const weakStreets = sum.streets.filter((x) => x.total! < 50);
  const plans = new Set(sum.streets.filter((x) => x.s.m.plan).map((x) => x.s.m.plan!.title));
  const diff = (sum.avg ?? 0) - (city.avg ?? 0);
  return {
    sum, rel,
    lines: [
      `==**${name}**: ממוצע **${sum.avg}**, ${diff >= 0 ? `**${diff}** מעל` : `**${-diff}** מתחת ל`}ממוצע העיר.==${place ? ` מקום **${place}** מתוך **${ranks.length}** רבעי המגורים.` : ''}`,
      `חזק מהעיר ב**${better.p.label}** (**${better.q}** מול **${better.c}**). חלש ממנה ב**${worse.p.label}** (**${worse.q}** מול **${worse.c}**).`,
      sum.gapParam && sum.best && sum.worst ? `בין **${sum.best.s.name}** (**${sum.best.total}**) ל**${sum.worst.s.name}** (**${sum.worst.total}**) מפריד בעיקר **${sum.gapParam.p.label}**: ${fmtVal(sum.gapParam.p, sum.best)} מול ${fmtVal(sum.gapParam.p, sum.worst)}.` : '',
      weakStreets.length ? `**${weakStreets.length}** רחובות מתחת ל-**50**: ${weakStreets.slice(-4).map((x) => x.s.name).join(', ')}.` : 'אין ברובע רחוב מתחת ל-**50**.',
      plans.size ? `**${plans.size}** תוכניות התחדשות נוגעות ברחובות הרובע: ${[...plans].slice(0, 2).join(', ')}. הן הזדמנות לתקן את החולשה בתכנון.` : '',
    ].filter(Boolean),
  };
}

export interface StreetAct { p: Param; tier: Tier; text: string; guideline: string; who: string; gap: number }
/** הרחוב: למה הציון הזה, מול הרובע ומול היעד, ומה עושים. */
export function streetStory(model: Model, x: Scored) {
  const qid = x.s.quarter_id;
  const sum = qid ? summarize(model, [qid], qid) : null;
  const rows = model.entering.map((p) => {
    const s = x.scores[p.key];
    const qMed = sum ? med(sum.streets.map((y) => y.values[p.key]).filter((v): v is number => v != null)) : null;
    return { p, s, v: x.values[p.key], qMed };
  }).filter((r) => r.s != null);
  const weak = rows.filter((r) => r.s! < 0.6).sort((a, b) => (a.s! - b.s!) || (weightOf(model, b.p) - weightOf(model, a.p)));
  const strong = rows.filter((r) => r.s! >= 0.99);
  const acts: StreetAct[] = weak.map((r) => ({ p: r.p, tier: ACTIONS[r.p.key]?.tier ?? 'plan', text: ACTIONS[r.p.key]?.existing ?? '', guideline: ACTIONS[r.p.key]?.guideline ?? '', who: ACTIONS[r.p.key]?.who ?? '', gap: Math.round((1 - r.s!) * weightOf(model, r.p) * 10) / 10 }));
  const lines = [
    strong.length ? `==עומד ביעד ב-**${strong.length}** מתוך **${rows.length}** פרמטרים:== ${strong.map((r) => r.p.label).join(', ')}.` : `==לא עומד ביעד באף פרמטר.==`,
    ...weak.slice(0, 3).map((r) => `**${r.p.label}**: ${fmtRaw(r.p, r.v)}, היעד ${r.p.target}${r.qMed != null ? `, חציון הרובע ${fmtRaw(r.p, r.qMed)}` : ''}.`),
  ];
  return { lines, acts };
}

export interface PlanRow { p: Param; tier: Tier; streets: Scored[]; stake: number; existing: string; guideline: string; who: string }
/** תוכנית פעולה לקבוצת רחובות: כל פרמטר, כמה רחובות מתחת ל-50% מהיעד, וכמה נקודות על הכף. */
export function actionPlan(model: Model, streets: Scored[]): PlanRow[] {
  return model.entering.map((p) => {
    const below = streets.filter((x) => x.scores[p.key] != null && x.scores[p.key]! < 0.5);
    const stake = Math.round(below.reduce((a, x) => a + (1 - x.scores[p.key]!) * weightOf(model, p), 0));
    const a = ACTIONS[p.key];
    return { p, tier: a.tier, streets: below.sort((u, v) => u.scores[p.key]! - v.scores[p.key]!), stake, existing: a.existing, guideline: a.guideline, who: a.who };
  }).filter((r) => r.streets.length).sort((a, b) => b.stake - a.stake);
}
export const tierTitle = (t: Tier) => TIERS[t].title;
