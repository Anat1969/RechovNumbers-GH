// מנוע הציון: דטרמיניסטי, רץ בדפדפן, בלי שרת. כל פרמטר מסביר את עצמו: מה נמדד, איך חושב, על מה נשען ומה המגבלה.
import { CRIT, CROSS, FAMILIES, type FamilyKey } from '../data/criteria';
import { IND } from '../data/indicators';

export interface Metrics {
  len?: number; junctions?: number; block?: number; bld100?: number; levels?: number; levels_n?: number;
  shop100?: number; cross100?: number; bench100?: number; tree100?: number; lamp100?: number;
  bus300?: number; busdist?: number; parkdist?: number; svc400?: number; edu400?: number;
  class?: string; maxspeed?: number; lanes?: number; cycle?: boolean; sidewalk?: boolean;
  geo?: 'outside' | 'trimmed';
  plan?: { id: string; title: string; status: string; number: string | null; points: number | null; street?: Record<string, number | null> };
  votes?: { n: number; avg: number };
}
export interface Street { code: number; name: string; quarter_id: string | null; quarter_source: string | null; line: number[][][] | null; m: Metrics }

/** סף הכיסוי: פרמטר נכנס לציון רק אם יש לו ערך ביותר מרבע מרחובות העיר. מתחתיו, אפס הוא כנראה "לא מופה". */
export const COVERAGE_MIN = 0.25;
/** רחוב קצר מזה לא מדורג: אורך בלוק ומקצב בניינים לא אומרים כלום על קטע של 100 מ'. */
export const MIN_LEN = 120;

/** למה רחוב לא מקבל ציון. null = מדורג. */
export function unranked(m: Metrics): string | null {
  if (m.geo === 'outside') return 'קו הרחוב שנמצא במפה רחוק מהרובע שהעירייה שייכה אליו. כנראה רחוב אחר באותו שם, ולכן הוא לא מדורג.';
  if ((m.len ?? 0) < MIN_LEN) return `הקטע שנמדד קצר מ-${MIN_LEN} מ', ולכן הוא לא מדורג.`;
  return null;
}

const CLASS: Record<string, { he: string; s: number }> = {
  living_street: { he: 'רחוב משולב', s: 1 }, pedestrian: { he: 'מדרחוב', s: 1 }, footway: { he: 'שביל הולכי רגל', s: 1 },
  residential: { he: 'רחוב מגורים', s: 0.8 }, service: { he: 'דרך שירות', s: 0.6 }, unclassified: { he: 'רחוב מקומי', s: 0.6 },
  path: { he: 'שביל', s: 0.8 }, tertiary: { he: 'רחוב מאסף', s: 0.45 }, secondary: { he: 'דרך עורקית משנית', s: 0.2 },
  primary: { he: 'דרך עורקית ראשית', s: 0.05 }, trunk: { he: 'דרך ראשית', s: 0 },
};
export const classHe = (c?: string) => (c ? CLASS[c]?.he ?? c : 'לא ידוע');

const lin = (v: number, full: number, zero: number) => {
  if (full < zero) return v <= full ? 1 : v >= zero ? 0 : (zero - v) / (zero - full);
  return v >= full ? 1 : v <= zero ? 0 : (v - zero) / (full - zero);
};

export interface Param {
  key: string; label: string; unit: string; criterion: string; indicators: string[];
  read: (m: Metrics) => number | null;
  present: (m: Metrics) => boolean;
  /** relative: אחוזון בין רחובות העיר. אחרת: מול יעד. */
  relative?: boolean;
  score: (v: number) => number;
  fmt: (v: number, m: Metrics) => string;
  target: string; rule: string; basis: string; source: string; limit: string;
  higherBetter: boolean;
  /** לא נכנס לציון גם בכיסוי גבוה: היעדר תיוג אינו היעדר הדבר עצמו. */
  displayOnly?: boolean;
}

const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('he-IL');
const n0 = (v: number) => Math.round(v).toLocaleString('he-IL');

export const PARAMS: Param[] = [
  {
    key: 'block', label: 'אורך בלוק', unit: "מ'", criterion: 'intersection_density', indicators: ['a14', 'a15'],
    read: (m) => m.block ?? null, present: (m) => m.block != null, score: (v) => lin(v, 125, 300), fmt: (v) => n0(v), higherBetter: false,
    target: "עד 125 מ'", rule: "אורך הרחוב חלקי מספר הצמתים פחות אחד. צומת הוא מגע עם דרך אחרת, מקובץ ברדיוס 25 מ'. ציון מלא עד 125 מ', אפס מ-300 מ'.",
    basis: "הרחובות הטובים (מינהל התכנון, 2026): ב-15 מתוך 18 רחובות המרחק בין צמתים קטן מ-150 מ'. אב טיפוס רחוב מגורים: 80 עד 125 מ'.",
    source: 'קווי הרחוב מרשימת הרחובות הארצית מותאמת ל-OpenStreetMap. הצמתים מ-OpenStreetMap.', limit: 'רחוב שמפוצל לכמה קטעים נמדד כרחוב אחד. כיכר נספרת כצומת.',
  },
  {
    key: 'bld100', label: 'מקצב בניינים', unit: "ל-100 מ'", criterion: 'building_rhythm', indicators: ['a13'],
    read: (m) => m.bld100 ?? null, present: (m) => (m.bld100 ?? 0) > 0, score: (v) => lin(v, 3, 0), fmt: (v) => n1(v), higherBetter: true,
    target: "3 בניינים ומעלה", rule: "בניינים שמרכזם עד 35 מ' מקו הרחוב, חלקי שני צדדים, לכל 100 מ'. ציון מלא מ-3.",
    basis: "הרחובות הטובים: ברוב הרחובות 3 עד 5 בניינים לכל 100 מ' דופן.",
    source: 'שכבת הבניינים של OpenStreetMap.', limit: 'ממוצע שני הצדדים, לא הצד הגבוה. בניין ארוך עם כמה כניסות נספר פעם אחת.',
  },
  {
    key: 'class', label: 'אופי הדרך', unit: '', criterion: 'place_and_movement', indicators: ['b02', 'b01'],
    read: (m) => (m.class && CLASS[m.class] ? CLASS[m.class].s : null), present: (m) => !!m.class, score: (v) => v, fmt: (_v, m) => classHe(m.class), higherBetter: true,
    target: 'רחוב מגורים או משולב', rule: 'הסיווג השכיח של הדרך לאורך הרחוב. רחוב משולב ומדרחוב 1, מגורים 0.8, מאסף 0.45, עורקית 0.2 עד 0.',
    basis: 'מטריצת מקום–תנועה (Link and Place) שבזיקוק הרחובות הטובים: ככל שהרחוב יותר "מקום" ופחות "צינור", הוא מזמין הליכה. הסולם עצמו הוא הצעה של האפליקציה.',
    source: 'סיווג הדרך ב-OpenStreetMap (highway).', limit: 'סיווג של מיפוי, לא הסיווג התכנוני של העירייה.',
  },
  {
    key: 'cross100', label: 'מעברי חצייה', unit: "ל-100 מ'", criterion: 'row_split', indicators: ['b01', 'b02'],
    read: (m) => m.cross100 ?? null, present: (m) => (m.cross100 ?? 0) > 0, score: (v) => lin(v, 1, 0), fmt: (v) => n1(v), higherBetter: true,
    target: "מעבר אחד לכל 100 מ'", rule: "מעברי חצייה עד 12 מ' מקו הרחוב, לכל 100 מ'. ציון מלא ממעבר אחד ל-100 מ'.",
    basis: 'שכונה 360, רחובות הליכתיים ומיתון תנועה: חצייה קלה ובטוחה. היעד המספרי הוא הצעה של האפליקציה.',
    source: 'מעברי חצייה ב-OpenStreetMap.', limit: 'מעבר שלא מופה נספר כאפס.',
  },
  {
    key: 'busdist', label: 'מרחק לתחנת אוטובוס', unit: "מ'", criterion: 'place_and_movement', indicators: ['b03'],
    read: (m) => m.busdist ?? null, present: (m) => m.busdist != null, score: (v) => lin(v, 150, 450), fmt: (v) => n0(v), higherBetter: false,
    target: "עד 150 מ'", rule: "המרחק הקצר ביותר מהרחוב לתחנה. ציון מלא עד 150 מ', אפס מ-450 מ'.",
    basis: 'שכונה 360, תחבורה ציבורית תדירה, נגישה ונוחה (7 נקודות, המדד הכבד בחוברת). הסף הוא הצעה של האפליקציה.',
    source: 'תחנות אוטובוס ב-OpenStreetMap.', limit: 'נמדד מהנקודה הקרובה ברחוב. ברחוב ארוך הקצה הרחוק יכול להיות רחוק יותר. התדירות לא נמדדת.',
  },
  {
    key: 'parkdist', label: 'מרחק לגן או למגרש משחקים', unit: "מ'", criterion: 'staying', indicators: ['b07'],
    read: (m) => m.parkdist ?? null, present: (m) => m.parkdist != null, score: (v) => lin(v, 100, 400), fmt: (v) => n0(v), higherBetter: false,
    target: "עד 100 מ'", rule: "המרחק הקצר ביותר מהרחוב לגן, לפארק או למגרש משחקים. ציון מלא עד 100 מ', אפס מ-400 מ'.",
    basis: "ארגון הבריאות העולמי, אירופה (WHO Europe), 2016: שטח ירוק במרחק של עד 300 מ' מהבית.",
    source: 'גנים, פארקים ומגרשי משחקים ב-OpenStreetMap (נמדד למרכז השטח).', limit: 'גודל הגן ואיכותו לא נמדדים.',
  },
  {
    key: 'svc400', label: 'שירותים במרחק הליכה', unit: "ב-400 מ'", criterion: 'mixed_use', indicators: ['a10'], relative: true,
    read: (m) => m.svc400 ?? null, present: (m) => (m.svc400 ?? 0) > 0, score: (v) => v, fmt: (v) => n0(v), higherBetter: true,
    target: 'גבוה מרוב רחובות העיר', rule: "חנויות, מרפאות, בתי מרקחת, בנקים, ספריות ומרכזים קהילתיים עד 400 מ' מהרחוב. הציון הוא האחוזון בין רחובות אשדוד.",
    basis: 'שכונה 360, נגישות למגוון שירותים: שירותים יומיומיים במרחק הליכה (5 נקודות).',
    source: 'OpenStreetMap.', limit: 'המסחר באשדוד ממופה חלקית, ולכן הציון יחסי ולא מוחלט.',
  },
  {
    key: 'edu400', label: 'מוסדות חינוך במרחק הליכה', unit: "ב-400 מ'", criterion: 'mixed_use', indicators: ['a11'], relative: true,
    read: (m) => m.edu400 ?? null, present: (m) => (m.edu400 ?? 0) > 0, score: (v) => v, fmt: (v) => n0(v), higherBetter: true,
    target: 'גבוה מרוב רחובות העיר', rule: "גני ילדים, בתי ספר, מעונות ומשפחתונים עד 400 מ' מהרחוב. הציון הוא האחוזון בין רחובות אשדוד.",
    basis: 'שכונה 360, מבני ציבור (2 נקודות).',
    source: 'שכבת מוסדות החינוך העירונית (ASHDODMAP, mt_existing).', limit: 'סופר מוסדות, לא כיתות או תלמידים.',
  },
  // ===== נמדדים חלקית: נכנסים לציון אוטומטית כשהכיסוי יעבור את הסף =====
  {
    key: 'tree100', label: 'עצים', unit: "ל-100 מ'", criterion: 'tree_canopy', indicators: ['b14', 'b15', 'b13'],
    read: (m) => m.tree100 ?? null, present: (m) => (m.tree100 ?? 0) > 0, score: (v) => lin(v, 10, 0), fmt: (v) => n1(v), higherBetter: true,
    target: "10 עצים ל-100 מ'", rule: "עצים ושדרות עצים עד 20 מ' מקו הרחוב, לכל 100 מ'.",
    basis: 'שכונה 360, רשת עצים (6 נקודות) וצל (3). הרחובות הטובים: חופת עצים מעל 20% בשמונה מתוך 18 רחובות.',
    source: 'עצים ב-OpenStreetMap.', limit: 'רוב העצים באשדוד לא ממופים. דרוש סקר עצים עירוני או צילום אוויר.',
  },
  {
    key: 'shop100', label: 'חזית מסחרית', unit: "ל-100 מ'", criterion: 'transparency', indicators: ['a13'],
    read: (m) => m.shop100 ?? null, present: (m) => (m.shop100 ?? 0) > 0, score: (v) => lin(v, 3, 0), fmt: (v) => n1(v), higherBetter: true,
    target: "3 עסקים ל-100 מ'", rule: "חנויות, בתי קפה ושירותים עד 30 מ' מקו הרחוב, לכל 100 מ'.",
    basis: 'הרחובות הטובים: שקיפות וחזית פעילה. שכונה 360: בינוי מלווה רחוב.',
    source: 'OpenStreetMap.', limit: 'המסחר ממופה חלקית. דרוש רישוי עסקים עירוני.',
  },
  {
    key: 'bench100', label: 'ספסלים', unit: "ל-100 מ'", criterion: 'staying', indicators: ['b01'],
    read: (m) => m.bench100 ?? null, present: (m) => (m.bench100 ?? 0) > 0, score: (v) => lin(v, 1, 0), fmt: (v) => n1(v), higherBetter: true,
    target: "ספסל ל-100 מ'", rule: "ספסלים עד 30 מ' מקו הרחוב, לכל 100 מ'.",
    basis: 'שאלת השהייה של NiceStreets: האם יש מקום לעצור.', source: 'OpenStreetMap.', limit: 'ממופה חלקית.',
  },
  {
    key: 'lamp100', label: 'פנסי רחוב', unit: "ל-100 מ'", criterion: 'safety', indicators: ['c04', 'b19'],
    read: (m) => m.lamp100 ?? null, present: (m) => (m.lamp100 ?? 0) > 0, score: (v) => lin(v, 3, 0), fmt: (v) => n1(v), higherBetter: true,
    target: "3 פנסים ל-100 מ'", rule: "פנסים עד 20 מ' מקו הרחוב, לכל 100 מ'.",
    basis: 'שכונה 360, התייעלות תאורת רחוב וזיהום אור לילי.', source: 'OpenStreetMap.', limit: 'כמעט לא ממופה. דרושה שכבת התאורה העירונית.',
  },
  {
    key: 'sidewalk', label: 'מדרכה מתועדת', displayOnly: true, unit: '', criterion: 'row_split', indicators: ['b01'],
    read: (m) => (m.sidewalk == null ? null : m.sidewalk ? 1 : 0), present: (m) => m.sidewalk === true, score: (v) => v, fmt: (v) => (v ? 'כן' : 'לא תועדה'), higherBetter: true,
    target: 'מדרכה בשני הצדדים', rule: "מדרכה מתויגת על הדרך, או שביל מדרכה עד 15 מ'.",
    basis: 'הרחובות הטובים: חלוקת זכות הדרך.', source: 'OpenStreetMap.', limit: 'היעדר תיוג אינו היעדר מדרכה.',
  },
];
export const PMAP = Object.fromEntries(PARAMS.map((p) => [p.key, p])) as Record<string, Param>;

export interface ParamStat { key: string; coverage: number; enters: boolean; sorted: number[] }
export interface Scored {
  s: Street;
  values: Record<string, number | null>;
  scores: Record<string, number | null>;
  ind: Record<string, number>;
  total: number | null;
  points: number;
  families: Record<FamilyKey, number | null>;
}
export interface Model { streets: Scored[]; stats: Record<string, ParamStat>; entering: Param[]; measuredInd: string[]; maxPoints: number; byCode: Record<number, Scored> }

const pct = (sorted: number[], v: number) => {
  if (sorted.length < 2) return 0.5;
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; }
  let up = lo; while (up < sorted.length && sorted[up] === v) up++;
  return ((lo + up) / 2) / sorted.length;
};

export function buildModel(raw: Street[]): Model {
  const stats: Record<string, ParamStat> = {};
  for (const p of PARAMS) {
    const vals = raw.map((s) => p.read(s.m)).filter((v): v is number => v != null).sort((a, b) => a - b);
    const coverage = raw.length ? raw.filter((s) => p.present(s.m)).length / raw.length : 0;
    stats[p.key] = { key: p.key, coverage, enters: coverage >= COVERAGE_MIN && !p.displayOnly, sorted: vals };
  }
  const entering = PARAMS.filter((p) => stats[p.key].enters);
  const measuredInd = [...new Set(entering.flatMap((p) => p.indicators))];
  const maxPoints = measuredInd.reduce((a, id) => a + IND[id].maxScore, 0);

  const streets: Scored[] = raw.map((s) => {
    const values: Record<string, number | null> = {};
    const scores: Record<string, number | null> = {};
    for (const p of PARAMS) {
      const v = p.read(s.m);
      values[p.key] = v;
      scores[p.key] = v == null ? null : p.relative ? pct(stats[p.key].sorted, v) : p.score(v);
    }
    const ind: Record<string, number> = {};
    let points = 0, max = 0;
    for (const id of measuredInd) {
      const ss = entering.filter((p) => p.indicators.includes(id)).map((p) => scores[p.key]).filter((x): x is number => x != null);
      if (!ss.length) continue;
      ind[id] = ss.reduce((a, b) => a + b, 0) / ss.length;
      points += IND[id].maxScore * ind[id];
      max += IND[id].maxScore;
    }
    const families = Object.fromEntries(FAMILIES.map((f) => {
      const ss = entering.filter((p) => CRIT[p.criterion].family === f.key).map((p) => scores[p.key]).filter((x): x is number => x != null);
      return [f.key, ss.length ? ss.reduce((a, b) => a + b, 0) / ss.length : null];
    })) as Record<FamilyKey, number | null>;
    const ok = !unranked(s.m);
    return { s, values, scores, ind, points, total: ok && max ? Math.round((points / max) * 100) : null, families };
  });
  return { streets, stats, entering, measuredInd, maxPoints, byCode: Object.fromEntries(streets.map((x) => [x.s.code, x])) };
}

/** כל המדדים שנוגעים ברחוב (לפי ההצלבה), והניקוד שלהם. */
export function crossTotals() {
  const touched = [...new Set(Object.values(CROSS).flat())];
  return { touched, points: touched.reduce((a, id) => a + IND[id].maxScore, 0) };
}

export interface QuarterSummary {
  id: string; streets: Scored[]; avg: number | null;
  best?: Scored; worst?: Scored;
  weakParam?: { p: Param; avg: number; value: number | null };
  gapParam?: { p: Param; best: number; worst: number };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function summarize(model: Model, ids: string[] | null, id = 'city'): QuarterSummary {
  const streets = model.streets.filter((x) => x.total != null && (!ids || (x.s.quarter_id && ids.includes(x.s.quarter_id)))).sort((a, b) => (b.total! - a.total!) || (b.points - a.points));
  const avg = mean(streets.map((x) => x.total!));
  const out: QuarterSummary = { id, streets, avg: avg == null ? null : Math.round(avg), best: streets[0], worst: streets[streets.length - 1] };
  let weak: QuarterSummary['weakParam'];
  for (const p of model.entering) {
    const a = mean(streets.map((x) => x.scores[p.key]).filter((v): v is number => v != null));
    const v = median(streets.map((x) => x.values[p.key]).filter((v): v is number => v != null));
    if (a != null && (!weak || a < weak.avg)) weak = { p, avg: a, value: v };
  }
  out.weakParam = weak;
  if (out.best && out.worst && out.best !== out.worst) {
    let gap: QuarterSummary['gapParam'];
    for (const p of model.entering) {
      const b = out.best.scores[p.key], w = out.worst.scores[p.key];
      if (b == null || w == null) continue;
      if (!gap || b - w > gap.best - gap.worst) gap = { p, best: b, worst: w };
    }
    out.gapParam = gap;
  }
  return out;
}

/** סולם הצבע של NiceStreets (lib/score.ts): לבנה, ענבר, צהוב, ירוק, ירוק־צמרת, ברצף. */
const STOPS: [number, [number, number, number]][] = [[0, [166, 54, 44]], [25, [222, 118, 38]], [50, [232, 199, 62]], [75, [122, 174, 72]], [100, [22, 110, 74]]];
export function scoreColor(score: number | null): string {
  if (score == null) return '#C3C8CF';
  const v = Math.max(0, Math.min(100, score));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [lo, a] = STOPS[i], [hi, b] = STOPS[i + 1];
    if (v <= hi) { const t = (v - lo) / (hi - lo); const c = a.map((x, k) => Math.round(x + (b[k] - x) * t)); return `rgb(${c[0]},${c[1]},${c[2]})`; }
  }
  return 'rgb(22,110,74)';
}
export function textOn(score: number | null) { return score != null && (score < 18 || score > 82) ? '#fff' : '#1A1A18'; }
