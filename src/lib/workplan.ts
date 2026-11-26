// תוכנית העבודה למהנדס העיר ולמנכ"ל: שני צירים (רובע ונושא), שלושה שלבים, ותרחיש השפעה.
// כל המספרים מחושבים מהמנוע. מה שאינו מחושב מסומן כהנחה או כהצעה.
import { IND } from '../data/indicators';
import { QMAP, QUARTERS } from '../data/quarters';
import { ACTIONS, GAPS, type Tier } from './actions';
import { PMAP, summarize, type Metrics, type Model, type Param, type Scored } from './model';
import { quarterRanks, weightOf } from './story';

/** רחוב "צריך טיפול" בפרמטר כשהוא מתחת למחצית היעד. אותו סף כמו בדף הפעולות. */
export const NEED = 0.5;

/**
 * אמינות הנתון לכל פרמטר. "חלקי": השכבה ממופה רק בחלק מהעיר, ולכן אפס הוא "לא ידוע" ולא "חסר".
 * כלל ענת, 26.11.2026: לא אומרים "חסרים ספסלים" כשחסרה שכבת ספסלים.
 */
export const PARTIAL: Record<string, string> = {
  cross100: 'שכבת סימון הכבישים של אגף התנועה',
  svc400: 'קובץ רישוי העסקים, עם כתובת',
};
/** הרחוב לא נמדד בפועל בפרמטר הזה: השכבה חלקית ואין בו אף פריט ממופה. */
export const isUnknown = (p: Param, x: Scored) => !!PARTIAL[p.key] && x.values[p.key] === 0;
/** הרחוב באמת מתחת למחצית היעד, לפי מה שממופה. */
export const isNeed = (p: Param, x: Scored) => x.scores[p.key] != null && x.scores[p.key]! < NEED && !isUnknown(p, x);

/** השכבות שחסרות כדי שהתוכנית תהיה מדויקת: כיסוי מחושב, מאיפה מביאים, ומה זה פותח. */
export interface Layer { what: string; from: string; cov: number | null; covText?: string; opens: string; affects: boolean }
export function missingLayers(model: Model): Layer[] {
  const ranked = model.streets.filter((x) => x.total != null);
  const cov = (key: string) => {
    const p = PMAP[key];
    return ranked.length ? Math.round((ranked.filter((x) => p.present(x.s.m as Metrics)).length / ranked.length) * 100) : 0;
  };
  const crossUnknown = ranked.filter((x) => x.values.cross100 === 0).length;
  return [
    { what: 'מעברי חצייה', from: PARTIAL.cross100, cov: cov('cross100'), opens: `שלב א'. היום **${crossUnknown}** רחובות בלי מעבר ממופה מסומנים "לא ידוע", ולא נספרים כחסרים.`, affects: true },
    { what: 'עסקים וחזית פעילה', from: PARTIAL.svc400, cov: cov('shop100'), opens: 'שירותים במרחק הליכה וחזית פעילה. רחוב בלי עסק ממופה מסומן "לא ידוע".', affects: true },
    { what: 'עצים וצל', from: 'סקר העצים של שפ"ע, או צילום לוויין (Sentinel-2)', cov: cov('tree100'), opens: `נטיעה בשלב א', ו-**11** נקודות של שכונה 360. היום לא נכנס לתוכנית.`, affects: false },
    { what: 'ספסלים וריהוט רחוב', from: 'מאגר ריהוט הרחוב של שפ"ע', cov: cov('bench100'), opens: `ישיבה בשלב א'. היום לא נכנס לתוכנית.`, affects: false },
    { what: 'תאורת רחוב', from: 'מאגר עמודי התאורה של אגף החשמל', cov: cov('lamp100'), opens: `תאורה להולכי רגל בשלב א'. היום לא נכנס לתוכנית.`, affects: false },
    { what: 'מדרכות', from: 'שכבת המדרכות העירונית', cov: cov('sidewalk'), opens: `רציפות והנגשה בשלב א'. היום לא נכנס לתוכנית.`, affects: false },
    ...GAPS.filter((g) => ['יחס גובה לרוחב', 'תדירות התחבורה הציבורית', 'תחזוקה וביטחון', 'רוחב קיר לקיר'].includes(g.what))
      .map((g) => ({ what: g.what, from: g.source.split('.')[0], cov: null, covText: g.now, opens: g.gain, affects: false })),
  ];
}

export interface Phase { tier: Tier; n: string; title: string; when: string; how: string }
export const PHASES: Phase[] = [
  { tier: 'now', n: 'א', title: 'תיקונים מהירים', when: '0 עד 6 חודשים', how: 'סימון, ריהוט, תאורה ונטיעה מתקציב התחזוקה, ברחובות שהתוכנית מסמנת.' },
  { tier: 'think', n: 'ב', title: 'שינוי ברחוב הקיים', when: '6 עד 18 חודשים', how: 'בדיקה תכנונית ותנועתית, ואז ביצוע: מיתון תנועה, מעברים בין מגרשים, תחנות.' },
  { tier: 'plan', n: 'ג', title: 'דרך התכנון', when: 'מתמשך', how: 'הנחיות שנכנסות לכל תב"ע, תוכנית בינוי והתחדשות עירונית, כתנאי לאישור.' },
];

/** הציון של רחוב, כשחלק מהפרמטרים הגיעו ליעד. אותה נוסחה כמו ב-buildModel. */
export function totalWith(model: Model, x: Scored, fixed: Set<string>): number | null {
  if (x.total == null) return null;
  let points = 0, max = 0;
  for (const id of model.measuredInd) {
    const ss = model.entering.filter((p) => p.indicators.includes(id))
      .map((p) => (fixed.has(p.key) && isNeed(p, x) ? 1 : x.scores[p.key]))
      .filter((v): v is number => v != null);
    if (!ss.length) continue;
    points += IND[id].maxScore * (ss.reduce((a, b) => a + b, 0) / ss.length);
    max += IND[id].maxScore;
  }
  return max ? Math.round((points / max) * 100) : null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** תרחיש: ממוצע הציון ומספר הרחובות מתחת ל-50, לפני ואחרי כל שלב. */
export function scenario(model: Model, streets: Scored[]) {
  const keysOf = (tiers: Tier[]) => new Set(model.entering.filter((p) => tiers.includes(ACTIONS[p.key].tier)).map((p) => p.key));
  const steps: { label: string; avg: number; below: number }[] = [];
  const run = (label: string, keys: Set<string>) => {
    const t = streets.map((x) => totalWith(model, x, keys)).filter((v): v is number => v != null);
    steps.push({ label, avg: Math.round(mean(t)), below: t.filter((v) => v < 50).length });
  };
  run('היום', new Set());
  run("אחרי שלב א'", keysOf(['now']));
  run("אחרי שלב ב'", keysOf(['now', 'think']));
  run("אחרי שלב ג'", keysOf(['now', 'think', 'plan']));
  return steps;
}

export interface Cell { p: Param; qid: string; streets: Scored[]; unknown: Scored[]; all: Scored[]; stake: number }
export interface Topic { p: Param; tier: Tier; who: string; streets: number; unknown: number; stake: number; cells: Cell[] }
export interface QRow { qid: string; name: string; area: boolean; avg: number | null; n: number; stake: number; cells: Record<string, Cell>; top: Cell[] }

/** המטריצה: רובע מול נושא. בכל תא, הרחובות שמתחת למחצית היעד והנקודות שאפשר להחזיר. */
export function workMatrix(model: Model) {
  // רבעי המגורים, ואחריהם האזורים שאינם מגורים (תעשייה, נמל, צירים): שם רוב הרחובות החלשים
  const groups = QUARTERS.map((q) => ({ id: q.id, name: q.name, area: q.kind === 'area', sum: summarize(model, [q.id], q.id) }))
    .filter((g) => g.sum.streets.length >= 3);
  const topicsP = model.entering.filter((p) => ACTIONS[p.key]);
  const rows: QRow[] = groups.map((r) => {
    const cells: Record<string, Cell> = {};
    for (const p of topicsP) {
      const below = r.sum.streets.filter((x) => isNeed(p, x)).sort((a, b) => a.scores[p.key]! - b.scores[p.key]!);
      const unknown = r.sum.streets.filter((x) => isUnknown(p, x));
      const stake = Math.round(below.reduce((a, x) => a + (1 - x.scores[p.key]!) * weightOf(model, p), 0));
      cells[p.key] = { p, qid: r.id, streets: below, unknown, all: r.sum.streets, stake };
    }
    const top = Object.values(cells).filter((c) => c.stake > 0).sort((a, b) => b.stake - a.stake);
    return { qid: r.id, name: r.name, area: r.area, avg: r.sum.avg, n: r.sum.streets.length, stake: top.reduce((a, c) => a + c.stake, 0), cells, top };
  });
  rows.sort((a, b) => Number(a.area) - Number(b.area) || b.stake - a.stake);
  const topics: Topic[] = topicsP.map((p) => {
    const cells = rows.map((r) => r.cells[p.key]).filter((c) => c.stake > 0).sort((a, b) => b.stake - a.stake);
    return { p, tier: ACTIONS[p.key].tier, who: ACTIONS[p.key].who, cells, streets: cells.reduce((a, c) => a + c.streets.length, 0), unknown: rows.reduce((a, r) => a + r.cells[p.key].unknown.length, 0), stake: cells.reduce((a, c) => a + c.stake, 0) };
  }).filter((t) => t.stake > 0);
  // סדר העמודות: לפי שלב, ובתוך השלב לפי הנקודות על הכף
  const order: Tier[] = ['now', 'think', 'plan'];
  topics.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || b.stake - a.stake);
  const maxCell = Math.max(1, ...rows.flatMap((r) => Object.values(r.cells).map((c) => c.stake)));
  return { rows, topics, maxCell };
}

/** רובע הפיילוט: הרובע שבו שלבים א' וב' מחזירים הכי הרבה נקודות בסך הכול, מתוך רבעים עם 10 רחובות לפחות. */
export function pilot(model: Model) {
  const keys = new Set(model.entering.filter((p) => ACTIONS[p.key].tier !== 'plan').map((p) => p.key));
  let best: { qid: string; name: string; now: number; after: number; gain: number; total: number; n: number; below: number } | null = null;
  for (const r of quarterRanks(model)) {
    if (r.sum.streets.length < 10) continue;
    const t = r.sum.streets.map((x) => totalWith(model, x, keys)).filter((v): v is number => v != null);
    const total = t.reduce((a, v, i) => a + v - r.sum.streets[i].total!, 0);
    const after = Math.round(mean(t));
    if (!best || total > best.total) best = { qid: r.id, name: r.name, now: r.sum.avg ?? 0, after, gain: after - (r.sum.avg ?? 0), total, n: r.sum.streets.length, below: r.sum.streets.filter((x) => x.total! < 50).length };
  }
  return best;
}

/** ההחלטות שמבקשים מהמנכ"ל. חלקן מחושבות, חלקן הצעה קבועה. */
export function decisions(model: Model) {
  const pl = pilot(model);
  const owners = [...new Set(model.entering.flatMap((p) => ACTIONS[p.key].who.split(/,\s*/)))].filter((w) => w !== 'רישוי');
  const cityData = GAPS.filter((g) => g.can === 'city').map((g) => g.what);
  return [
    { t: 'לאשר את המסגרת', d: 'שלושה שלבים, וסדר עדיפות לפי הנקודות שאפשר להחזיר ולא לפי מספר הרחובות.' },
    pl ? { t: `פיילוט ב${pl.name}`, d: `**${pl.n}** רחובות, **${pl.below}** מהם מתחת ל-**50**. שלבים א' וב' מעלים את הממוצע מ-**${pl.now}** ל-**${pl.after}**, התוספת הגדולה בעיר בסך הנקודות. מנהל הרובע מוביל, והאגפים מבצעים.` } : null,
    { t: 'אחראי לכל נושא', d: `נציג קבוע מכל גוף: ${owners.join(', ')}. מנהל הרובע מתאם את הביצוע ברובע שלו.` },
    { t: 'העברת שכבות עירוניות לפני הביצוע', d: `${['מעברי חצייה', ...cityData].join(', ')}. בלי השכבות האלה התוכנית יודעת רק מה ממופה, ולא מה באמת חסר ברחוב.` },
    { t: 'הנחיות הרחוב כתנאי בתכנון', d: 'שלב ג\' נכנס לכל תב"ע, תוכנית בינוי והתחדשות עירונית, בלי תקציב ייעודי.' },
    { t: 'מדידה חוזרת כל רבעון', d: 'אותו מנוע, אותם רחובות: הממוצע ומספר הרחובות מתחת ל-50 מדווחים למנכ"ל.' },
  ].filter(Boolean) as { t: string; d: string }[];
}

/** תקציר למנכ"ל, טקסט מוכן להעתקה. */
export function briefText(model: Model) {
  const city = summarize(model, null);
  const steps = scenario(model, city.streets);
  const { topics } = workMatrix(model);
  const pl = pilot(model);
  const strip = (s: string) => s.replace(/\*\*|==/g, '');
  const lines = [
    'תוכנית עבודה לשדרוג הרחובות באשדוד',
    'מבוסס על "רחוב טוב במספרים": ' + city.streets.length + ' רחובות מדודים.',
    '',
    `היום: ממוצע ${steps[0].avg}, ו-${steps[0].below} רחובות מתחת ל-50.`,
    `אחרי שלושת השלבים (תרחיש תקרה): ממוצע ${steps[3].avg}, ו-${steps[3].below} רחובות מתחת ל-50.`,
    '',
    'השלבים',
    ...PHASES.map((ph) => {
      const ts = topics.filter((t) => t.tier === ph.tier);
      return `שלב ${ph.n}' (${ph.when}), ${ph.title}: ${ts.length ? ts.map((t) => `${t.p.label} (${t.streets} רחובות, ${t.who})`).join('; ') : 'אין נושא מדוד בשלב הזה'}.`;
    }),
    '',
    pl ? `רובע מומלץ לפיילוט: ${pl.name}, מ-${pl.now} ל-${pl.after}.` : '',
    '',
    'ההחלטות המבוקשות',
    ...decisions(model).map((d, i) => `${i + 1}. ${d.t}: ${strip(d.d)}`),
    '',
    'השכבות שחסרות כדי שהתוכנית תהיה מדויקת',
    ...missingLayers(model).map((l, i) => `${i + 1}. ${l.what}: ${l.cov != null ? `ממופה ב-${l.cov}% מהרחובות` : l.covText}. מקור: ${l.from}.`),
    '',
    'מגבלה: רחוב שאין בו פריט ממופה מסומן "לא ידוע" ולא "חסר". התרחיש מניח שכל רחוב שמתחת למחצית היעד מגיע ליעד. העלות לא הוערכה, ונדרש אומדן מאגף ההנדסה.',
  ];
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

export const qname = (qid: string) => QMAP[qid]?.name ?? qid;
