import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Street } from '../lib/model';

export interface MapItem { s: Street; color: string; label?: boolean; tip: string; weight?: number }

const K = 111320; // מטרים למעלה רוחב
type VB = [number, number, number, number];

/** מפת רחובות ב-SVG: הטלה שווה־מרחקים מקומית, זום בגלגלת, גרירה, ותוויות בלי חפיפה. */
export default function StreetMap({ items, context = [], selected, onSelect, legend, label = 'מפת הרחובות' }: {
  items: MapItem[]; context?: Street[]; selected?: number | null; onSelect?: (code: number) => void; legend?: ReactNode; label?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<VB | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; t: string } | null>(null);
  const drag = useRef<{ x: number; y: number; vb: VB; moved: boolean } | null>(null);

  const geo = useMemo(() => {
    const pts = items.flatMap((i) => (i.s.line ?? []).flat());
    if (!pts.length) return null;
    // מסגרת לפי אחוזונים 3 עד 97: קטע רחוב בודד שמופה רחוק לא משטיח את המפה
    const xs = pts.map((p) => p[0]).sort((a, b) => a - b), ys = pts.map((p) => p[1]).sort((a, b) => a - b);
    const q = (a: number[], f: number) => a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))];
    const trim = pts.length > 40 ? 0.03 : 0;
    const minX = q(xs, trim), maxX = q(xs, 1 - trim), minY = q(ys, trim), maxY = q(ys, 1 - trim);
    const cos = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
    const P = (lon: number, lat: number): [number, number] => [(lon - minX) * K * cos, (maxY - lat) * K];
    const path = (s: Street) => (s.line ?? []).map((l) => l.map(([lo, la], i) => { const [x, y] = P(lo, la); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('')).join('');
    const mid = (s: Street): [number, number] | null => {
      const l = (s.line ?? []).reduce((a, b) => (b.length > a.length ? b : a), [] as number[][]);
      if (!l.length) return null; const p = l[Math.floor(l.length / 2)]; return P(p[0], p[1]);
    };
    const W = (maxX - minX) * K * cos, H = (maxY - minY) * K;
    return { P, path, mid, W: Math.max(W, 200), H: Math.max(H, 200), minX, maxX, minY, maxY };
  }, [items]);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 800, h: e.contentRect.height || 600 }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const fit = (): VB | null => {
    if (!geo) return null;
    const pad = 0.08, w = geo.W * (1 + pad * 2), h = geo.H * (1 + pad * 2);
    const ar = size.w / size.h;
    const [vw, vh] = w / h > ar ? [w, w / ar] : [h * ar, h];
    return [geo.W / 2 - vw / 2, geo.H / 2 - vh / 2, vw, vh];
  };
  useEffect(() => { setVb(fit()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [geo, size.w, size.h]);

  const ctxPaths = useMemo(() => {
    if (!geo) return [];
    const m = 0.004;
    return context.filter((s) => (s.line ?? []).flat().some(([lo, la]) => lo > geo.minX - m && lo < geo.maxX + m && la > geo.minY - m && la < geo.maxY + m)).map((s) => ({ code: s.code, d: geo.path(s) }));
  }, [context, geo]);

  const paths = useMemo(() => (geo ? items.map((i) => ({ i, d: geo.path(i.s), mid: geo.mid(i.s) })) : []), [items, geo]);

  if (!geo || !vb) return <div className="map-wrap" ref={wrap}><div className="empty">אין לרחובות האלה קו על המפה.</div></div>;

  const scale = vb[2] / size.w; // יחידות מפה לפיקסל
  // תוויות: לפי סדר חשיבות, ומדלגים על מה שחופף לתווית שכבר הונחה
  const placed: { x: number; y: number; w: number }[] = [];
  const labels = paths.filter((p) => p.i.label && p.mid).sort((a, b) => (b.i.weight ?? 0) - (a.i.weight ?? 0)).filter((p) => {
    const [x, y] = p.mid!; const w = p.i.s.name.length * 7 * scale;
    const hit = placed.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 + 6 * scale && Math.abs(q.y - y) < 18 * scale);
    if (!hit) placed.push({ x, y, w }); return !hit;
  });

  const zoom = (f: number, cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2) => {
    const w = Math.min(Math.max(vb[2] * f, 80), geo.W * 6), h = w * (vb[3] / vb[2]);
    setVb([cx - (cx - vb[0]) * (w / vb[2]), cy - (cy - vb[1]) * (h / vb[3]), w, h]);
  };
  const toMap = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect();
    return [vb[0] + ((e.clientX - r.left) / r.width) * vb[2], vb[1] + ((e.clientY - r.top) / r.height) * vb[3]];
  };

  return (
    <div className="map-wrap" ref={wrap}>
      <div className="map-tools">
        <button className="press" aria-label="הגדלה" onClick={() => zoom(0.7)}>+</button>
        <button className="press" aria-label="הקטנה" onClick={() => zoom(1.4)}>−</button>
        <button className="press" aria-label="איפוס המפה" onClick={() => setVb(fit())} style={{ fontSize: 11 }}>⤢</button>
      </div>
      <svg
        viewBox={vb.join(' ')} role="img" aria-label={label}
        onWheel={(e) => { const [x, y] = toMap(e); zoom(e.deltaY > 0 ? 1.15 : 0.87, x, y); }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vb, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current; if (!d) return;
          const dx = (e.clientX - d.x) * scale, dy = (e.clientY - d.y) * scale;
          if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
          if (d.moved) setVb([d.vb[0] - dx, d.vb[1] - dy, d.vb[2], d.vb[3]]);
        }}
        onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
        onPointerLeave={() => { drag.current = null; setTip(null); }}
      >
        <g>{ctxPaths.map((p) => <path key={p.code} className="ctx" d={p.d} strokeWidth={2} vectorEffect="non-scaling-stroke" />)}</g>
        <g>
          {paths.map(({ i, d }) => {
            const on = selected === i.s.code;
            return (
              <path
                key={i.s.code} d={d} className="street draw" pathLength={1}
                stroke={i.color} strokeWidth={on ? 9 : 5} vectorEffect="non-scaling-stroke"
                opacity={selected && !on ? 0.45 : 1}
                data-code={i.s.code}
                onClick={() => { if (!drag.current?.moved) onSelect?.(i.s.code); }}
                onMouseMove={(e) => { const r = wrap.current!.getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, t: i.tip }); }}
                onMouseLeave={() => setTip(null)}
              ><title>{i.tip}</title></path>
            );
          })}
          {selected != null && paths.filter((p) => p.i.s.code === selected).map(({ d }) => (
            <path key="sel" d={d} fill="none" stroke="#1A1A18" strokeWidth={13} vectorEffect="non-scaling-stroke" opacity={0.18} pointerEvents="none" strokeLinecap="round" />
          ))}
        </g>
        <g>
          {labels.map((p) => (
            <text key={p.i.s.code} className="lbl" x={p.mid![0]} y={p.mid![1] - 8 * scale} style={{ fontSize: 13 * scale, strokeWidth: 4 * scale }} textAnchor="middle" direction="rtl">{p.i.s.name}</text>
          ))}
        </g>
      </svg>
      {tip && <div className="map-tip" style={{ left: tip.x, top: tip.y }}>{tip.t}</div>}
      {legend && <div className="legend">{legend}</div>}
    </div>
  );
}
