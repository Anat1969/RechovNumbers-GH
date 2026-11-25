// שרטוט רחובות קטן: קו דיו עם מתאר, בצבע עם משמעות. הבסיס לכל הגרפיקה הקטנה באפליקציה:
// תשובות, גלריית רחובות באותו קנה מידה, ומפת "איפה צריך את הפעולה".
import { useMemo } from 'react';
import type { Scored } from '../lib/model';
import { scoreColor } from '../lib/model';

export interface SLine { key: number | string; line: number[][][] | null; color: string; w?: number; top?: boolean }
type Box = [number, number, number, number]; // lon0 lat0 lon1 lat1

const K = 111320;
/** מסגרת לפי אחוזונים, כדי שקטע בודד רחוק לא ישטיח את הציור. */
export function boxOf(lines: (number[][][] | null)[], trim = 0.03): Box | null {
  const pts = lines.flatMap((l) => (l ?? []).flat());
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]).sort((a, b) => a - b), ys = pts.map((p) => p[1]).sort((a, b) => a - b);
  const t = pts.length > 40 ? trim : 0;
  const q = (a: number[], f: number) => a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))];
  return [q(xs, t), q(ys, t), q(xs, 1 - t), q(ys, 1 - t)];
}
/** מסגרת בגודל קבוע במטרים סביב מרכז הרחוב: כך כל הרחובות נמדדים באותו סרגל. */
export function boxAround(line: number[][][] | null, spanM: number): Box | null {
  const b = boxOf([line], 0); if (!b) return null;
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, cos = Math.cos(cy * Math.PI / 180);
  const dx = spanM / 2 / (K * cos), dy = spanM / 2 / K;
  return [cx - dx, cy - dy, cx + dx, cy + dy];
}
export function extentM(line: number[][][] | null) {
  const b = boxOf([line], 0); if (!b) return 0;
  const cos = Math.cos(((b[1] + b[3]) / 2) * Math.PI / 180);
  return Math.max((b[2] - b[0]) * K * cos, (b[3] - b[1]) * K);
}

export function Sketch({ lines, box, className = 'sketch', label, scale = 1, cased = true, draw }: { lines: SLine[]; box?: Box | null; className?: string; label?: string; scale?: number; cased?: boolean; draw?: number }) {
  // draw: עיכוב בשניות. הקווים נמתחים, והבולטים (top) אחרונים, כדי שהעין תגיע אליהם
  const d = useMemo(() => {
    const b = box ?? boxOf(lines.map((l) => l.line));
    if (!b) return null;
    const cos = Math.cos(((b[1] + b[3]) / 2) * Math.PI / 180);
    const W = Math.max((b[2] - b[0]) * cos, 1e-5), H = Math.max(b[3] - b[1], 1e-5), S = 100 / Math.max(W, H);
    const path = (l: number[][][] | null) => (l ?? []).map((seg) => seg.map(([lo, la], i) => `${i ? 'L' : 'M'}${((lo - b[0]) * cos * S).toFixed(1)} ${((b[3] - la) * S).toFixed(1)}`).join('')).join('');
    const order = [...lines].sort((a, c) => Number(!!a.top) - Number(!!c.top));
    return { vb: `-4 -4 ${W * S + 8} ${H * S + 8}`, paths: order.map((l) => ({ ...l, d: path(l.line) })) };
  }, [lines, box]);
  if (!d) return <svg className={className} />;
  return (
    <svg className={className} viewBox={d.vb} preserveAspectRatio="xMidYMid meet" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {cased && d.paths.map((p) => <path key={'c' + p.key} d={p.d} className={draw != null ? 'draw' : undefined} pathLength={draw != null ? 1 : undefined} style={draw != null ? { animationDelay: `${draw + (p.top ? 0.6 : 0)}s` } : undefined} fill="none" stroke="#1A1A18" strokeOpacity={p.top ? 0.85 : 0.4} strokeWidth={((p.w ?? 2.2) + 1.6) * scale} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
      {d.paths.map((p) => <path key={p.key} d={p.d} className={draw != null ? 'draw' : undefined} pathLength={draw != null ? 1 : undefined} style={draw != null ? { animationDelay: `${draw + (p.top ? 0.6 : 0)}s` } : undefined} fill="none" stroke={p.color} strokeWidth={(p.w ?? 2.2) * scale} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

const GREY = '#D9D8D3';
/** שרטוט קבוצת רחובות: צבע לפי ציון, או לפי פרמטר, או הדגשה של חלק מהם. */
export function GroupSketch({ streets, by, hl, hlColor = '#A6362C', thin, label, draw }: {
  streets: Scored[]; by?: string | null; hl?: Set<number>; hlColor?: string; thin?: boolean; label?: string; draw?: number;
}) {
  // בקנה מידה של עיר: קו דק בלי מתאר, כדי שהרשת תיקרא ולא תהפוך לכתם
  const lines = useMemo(() => streets.map((x) => {
    const on = hl?.has(x.s.code);
    const v = by ? x.scores[by] : null;
    const color = hl ? (on ? hlColor : GREY) : by ? scoreColor(v == null ? null : v * 100) : scoreColor(x.total);
    return { key: x.s.code, line: x.s.line, color, w: (thin ? 0.9 : 2.2) + (on ? (thin ? 0.5 : 1.4) : 0), top: on };
  }), [streets, by, hl, hlColor, thin]);
  return <Sketch lines={lines} label={label} cased={!thin} draw={draw} />;
}

/** רחוב אחד בתוך הרובע שלו: הרחוב בצבע הציון, השאר אפור. */
export function StreetInQuarter({ x, quarter }: { x: Scored; quarter: Scored[] }) {
  const lines = useMemo(() => quarter.map((y) => ({ key: y.s.code, line: y.s.line, color: y.s.code === x.s.code ? scoreColor(x.total) : GREY, w: y.s.code === x.s.code ? 3.6 : 1.6, top: y.s.code === x.s.code })), [x, quarter]);
  return <Sketch lines={lines} label={`${x.s.name} ברובע`} />;
}

/** כל הרחובות של רובע באותו קנה מידה (Jacobs, Great Streets): אורך וצורה נקראים בעין, מהחזק לחלש. */
export function StreetGallery({ streets, sel, onSelect }: { streets: Scored[]; sel?: number | null; onSelect: (code: number) => void }) {
  const span = useMemo(() => Math.max(300, ...streets.map((x) => extentM(x.s.line))) * 1.06, [streets]);
  return (
    <div className="gallery" role="list" aria-label="הרחובות באותו קנה מידה">
      {streets.map((x, i) => (
        <button key={x.s.code} role="listitem" className="g-cell press" aria-pressed={sel === x.s.code} onClick={() => onSelect(x.s.code)} title={`${x.s.name}: ${x.total}`}>
          <Sketch lines={[{ key: x.s.code, line: x.s.line, color: scoreColor(x.total), w: 3.4, top: true }]} box={boxAround(x.s.line, span)} />
          <span className="g-name"><bdi className="num g-i">{i + 1}</bdi> {x.s.name}</span>
          <span className="g-score" style={{ background: scoreColor(x.total) }} />
          <bdi className="num g-v">{x.total}</bdi>
        </button>
      ))}
      <p className="src g-note">{`כל המשבצות באותו קנה מידה: רוחב משבצת ${Math.round(span)} מ'. הצבע: הציון.`}</p>
    </div>
  );
}

/** מרכז קבוצת רחובות: חציון הנקודות, כדי שקטע רחוק לא יזיז את התווית. */
export function centerOf(streets: Scored[]): [number, number] | null {
  const pts = streets.flatMap((x) => (x.s.line ?? []).flat());
  if (!pts.length) return null;
  const m = (a: number[]) => a.sort((u, v) => u - v)[a.length >> 1];
  return [m(pts.map((p) => p[0])), m(pts.map((p) => p[1]))];
}
