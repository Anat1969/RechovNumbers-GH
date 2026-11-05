import { useMemo } from 'react';
import type { Scored } from '../lib/model';
import { scoreColor } from '../lib/model';

/** מפה זעירה של רובע: כל רחוב קו בצבע הציון, עם קו מתאר כהה דק, כמו במפה מודפסת. */
export function MiniMap({ streets }: { streets: Scored[] }) {
  const d = useMemo(() => {
    const pts = streets.flatMap((x) => (x.s.line ?? []).flat());
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]).sort((a, b) => a - b), ys = pts.map((p) => p[1]).sort((a, b) => a - b);
    const q = (a: number[], f: number) => a[Math.round(f * (a.length - 1))];
    const t = pts.length > 40 ? 0.04 : 0;
    const [x0, x1, y0, y1] = [q(xs, t), q(xs, 1 - t), q(ys, t), q(ys, 1 - t)];
    const cos = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
    const W = Math.max((x1 - x0) * cos, 1e-4), H = Math.max(y1 - y0, 1e-4), S = 100 / Math.max(W, H);
    return {
      vb: `-6 -6 ${W * S + 12} ${H * S + 12}`,
      paths: streets.map((x) => ({ c: x.s.code, col: scoreColor(x.total), d: (x.s.line ?? []).map((l) => l.map(([lo, la], i) => `${i ? 'L' : 'M'}${((lo - x0) * cos * S).toFixed(1)} ${((y1 - la) * S).toFixed(1)}`).join('')).join('') })),
    };
  }, [streets]);
  if (!d) return <svg />;
  return (
    <svg viewBox={d.vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g>{d.paths.map((p) => <path key={p.c} d={p.d} fill="none" stroke="#1A1A18" strokeOpacity={0.55} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}</g>
      <g>{d.paths.map((p) => <path key={p.c} d={p.d} fill="none" stroke={p.col} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}</g>
    </svg>
  );
}
