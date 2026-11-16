import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Street } from '../lib/model';
import { SUPABASE, ANON } from '../lib/data';

export interface MapItem { s: Street; color: string; label?: boolean; tip: string; weight?: number }
/** תווית שטח (רובע) במרכז הרחובות שלו: שם וציון, ולחיצה נכנסת אליו. */
export interface MapMark { key: string; lon: number; lat: number; title: string; value?: number | null; color?: string; ink?: string; onClick?: () => void }

/** רוחב הקו לפי סוג הדרך, בפיקסלים: עורק רחב, רחוב מגורים צר. */
const WIDTH: Record<string, number> = { trunk: 9, primary: 9, secondary: 8, tertiary: 7, unclassified: 5.5, residential: 5.5, service: 4.5, living_street: 4.5, pedestrian: 4.5, footway: 3.5, path: 3.5 };
const widthOf0 = (s: Street) => WIDTH[s.m.class ?? ''] ?? 5;

/** רקע דמות־קרקע (Nolli): בניינים וגנים לשטח המפה, מ-rn_ground. נטען פעם אחת לכל שטח ונשמר בזיכרון. */
type Ground = { b: number[][][]; p: number[][][] };
const groundCache = new Map<string, Promise<Ground | null>>();
function loadGround(bb: [number, number, number, number]): Promise<Ground | null> {
  const key = bb.map((v) => v.toFixed(3)).join(',');
  if (!groundCache.has(key)) {
    groundCache.set(key, fetch(`${SUPABASE}/rest/v1/rpc/rn_ground`, {
      method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_lon: bb[0], min_lat: bb[1], max_lon: bb[2], max_lat: bb[3] }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return groundCache.get(key)!;
}
const NICE = [20, 50, 100, 200, 250, 500, 1000, 2000];

const K = 111320; // מטרים למעלה רוחב
type VB = [number, number, number, number];

/** מפת רחובות ב-SVG: הטלה שווה־מרחקים מקומית, זום בגלגלת, גרירה, ותוויות בלי חפיפה. */
export default function StreetMap({ items, context = [], selected, onSelect, legend, label = 'מפת הרחובות', marks = [], ground: withGround = true, thin = 1, focus = null, delayOf, drawDur = 1.1, replay = 0, overlay, marksDelay = 0 }: {
  items: MapItem[]; context?: Street[]; selected?: number | null; onSelect?: (code: number) => void; legend?: ReactNode; label?: string;
  marks?: MapMark[]; ground?: boolean; thin?: number; focus?: number | null;
  /** תנועה עם משמעות: עיכוב בשניות לכל רחוב, למשל לפי הציון. replay משתנה = מציירים שוב. */
  delayOf?: (code: number) => number; drawDur?: number; replay?: number; overlay?: ReactNode; marksDelay?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<VB | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; t: string } | null>(null);
  const drag = useRef<{ x: number; y: number; vb: VB; moved: boolean } | null>(null);
  const uid = useId().replace(/:/g, '');
  // בקנה מידה של עיר הקווים דקים יותר, כדי שהרשת תיקרא ולא תיסתם
  const widthOf = (s: Street) => widthOf0(s) * thin;

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
    /** קו לתווית: המקטע הארוך, מכוון משמאל לימין כדי שהשם יעמוד ישר. */
    const labelPath = (s: Street) => {
      const l = (s.line ?? []).reduce((a, b) => (b.length > a.length ? b : a), [] as number[][]);
      if (l.length < 2) return null;
      let pts = l.map(([lo, la]) => P(lo, la));
      if (pts[0][0] > pts[pts.length - 1][0]) pts = pts.reverse();
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return { d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(''), len };
    };
    const ring = (r: number[][]) => r.map(([lo, la], i) => { const [x, y] = P(lo, la); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('') + 'Z';
    const W = (maxX - minX) * K * cos, H = (maxY - minY) * K;
    const inv = (x: number, y: number): [number, number] => [x / (K * cos) + minX, maxY - y / K];
    return { P, inv, cos, path, mid, labelPath, ring, W: Math.max(W, 200), H: Math.max(H, 200), minX, maxX, minY, maxY };
  }, [items]);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 800, h: e.contentRect.height || 600 }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const fit = (): VB | null => {
    if (!geo) return null;
    const ar = size.w / size.h;
    // מיקוד ברחוב אחד: המסגרת סביבו, לפחות 700 מ', כדי שהרחוב ייראה בתוך השכנים שלו
    const f = focus != null ? items.find((i) => i.s.code === focus) : null;
    const fp = f ? (f.s.line ?? []).flat().map(([lo, la]) => geo.P(lo, la)) : [];
    if (fp.length) {
      const xs = fp.map((p) => p[0]), ys = fp.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const w0 = Math.max(Math.max(...xs) - Math.min(...xs), 700) * 1.35, h0 = Math.max(Math.max(...ys) - Math.min(...ys), 700) * 1.35;
      const [vw, vh] = w0 / h0 > ar ? [w0, w0 / ar] : [h0 * ar, h0];
      return [cx - vw / 2, cy - vh / 2, vw, vh];
    }
    const pad = 0.08, w = geo.W * (1 + pad * 2), h = geo.H * (1 + pad * 2);
    const [vw, vh] = w / h > ar ? [w, w / ar] : [h * ar, h];
    return [geo.W / 2 - vw / 2, geo.H / 2 - vh / 2, vw, vh];
  };
  useEffect(() => { setVb(fit()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [geo, size.w, size.h, focus]);

  const ctxPaths = useMemo(() => {
    if (!geo) return [];
    const m = 0.004;
    return context.filter((s) => (s.line ?? []).flat().some(([lo, la]) => lo > geo.minX - m && lo < geo.maxX + m && la > geo.minY - m && la < geo.maxY + m)).map((s) => ({ code: s.code, d: geo.path(s) }));
  }, [context, geo]);

  const paths = useMemo(() => (geo ? items.map((i) => ({ i, d: geo.path(i.s), mid: geo.mid(i.s), lp: i.label ? geo.labelPath(i.s) : null })) : []), [items, geo]);

  const [ground, setGround] = useState<{ b: string; p: string } | null>(null);
  // תצלום אוויר: מה שבאמת יש ברחוב, מתחת לקווי הציון. נזכר בין דפים.
  const [sat, setSat] = useState(() => { try { return localStorage.getItem('rn-sat') === '1'; } catch { return false; } });
  const toggleSat = () => setSat((v) => { try { localStorage.setItem('rn-sat', v ? '0' : '1'); } catch { /* פרטי */ } return !v; });
  useEffect(() => {
    if (!geo || !withGround) return;
    const m = 0.003; let alive = true;
    loadGround([geo.minX - m, geo.minY - m, geo.maxX + m, geo.maxY + m]).then((g) => {
      if (!alive || !g) return;
      setGround({ b: (g.b ?? []).map(geo.ring).join(''), p: (g.p ?? []).map(geo.ring).join('') });
    });
    return () => { alive = false; };
  }, [geo, withGround]);

  if (!geo || !vb) return <div className="map-wrap" ref={wrap}><div className="empty">אין לרחובות האלה קו על המפה.</div></div>;

  const scale = vb[2] / size.w; // יחידות מפה לפיקסל
  // אריחי Web Mercator, כל אריח מוטל כמלבן להטלה המקומית (בקנה מידה של עיר ההפרש זניח)
  const tiles: { k: string; href: string; x: number; y: number; w: number; h: number }[] = [];
  if (sat) {
    const [lo0, la1] = geo.inv(vb[0], vb[1]), [lo1, la0] = geo.inv(vb[0] + vb[2], vb[1] + vb[3]);
    const tx = (lo: number, z: number) => Math.floor(((lo + 180) / 360) * 2 ** z);
    const ty = (la: number, z: number) => { const r = la * Math.PI / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z); };
    const lon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
    const lat = (y: number, z: number) => { const n = Math.PI - (2 * Math.PI * y) / 2 ** z; return (180 / Math.PI) * Math.atan(Math.sinh(n)); };
    let z = Math.min(19, Math.max(11, Math.ceil(Math.log2((156543.03 * geo.cos) / Math.max(scale, 0.01)))));
    while (z > 11 && (tx(lo1, z) - tx(lo0, z) + 1) * (ty(la0, z) - ty(la1, z) + 1) > 90) z--;
    for (let x = tx(lo0, z); x <= tx(lo1, z); x++) for (let y = ty(la1, z); y <= ty(la0, z); y++) {
      const [ax, ay] = geo.P(lon(x, z), lat(y, z)), [bx, by] = geo.P(lon(x + 1, z), lat(y + 1, z));
      tiles.push({ k: `${z}/${y}/${x}`, href: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, x: ax, y: ay, w: bx - ax, h: by - ay });
    }
  }
  // תוויות: לפי סדר חשיבות, ומדלגים על מה שחופף לתווית שכבר הונחה
  const placed: { x: number; y: number; w: number }[] = [];
  const labels = paths.filter((p) => p.i.label && p.mid && p.lp && p.lp.len / scale > p.i.s.name.length * 8 + 16).sort((a, b) => (b.i.weight ?? 0) - (a.i.weight ?? 0)).filter((p) => {
    const [x, y] = p.mid!; const w = p.i.s.name.length * 8 * scale;
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
    <div className={'map-wrap' + (sat ? ' is-sat' : '')} ref={wrap}>
      <div className="map-tools">
        <button className="press sat-btn" aria-pressed={sat} onClick={toggleSat} title="תצלום אוויר מתחת לרחובות">לוויין</button>
        <button className="press" aria-label="הגדלה" onClick={() => zoom(0.7)}>+</button>
        <button className="press" aria-label="הקטנה" onClick={() => zoom(1.4)}>−</button>
        <button className="press" aria-label="איפוס המפה" onClick={() => setVb(fit())} style={{ fontSize: 11 }}>⤢</button>
      </div>
      <svg
        className="map-svg" viewBox={vb.join(' ')} role="img" aria-label={label}
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
        {sat && <g className="sat-tiles">{tiles.map((t) => <image key={t.k} href={t.href} x={t.x} y={t.y} width={t.w + 0.5} height={t.h + 0.5} preserveAspectRatio="none" />)}</g>}
        {ground && !sat && <g className="ground">
          <path d={ground.p} className="g-park" />
          <path d={ground.b} className="g-bld" />
        </g>}
        <g>{ctxPaths.map((p) => <path key={p.code} className="ctx-case" d={p.d} vectorEffect="non-scaling-stroke" />)}</g>
        <g>{ctxPaths.map((p) => <path key={p.code} className="ctx" d={p.d} vectorEffect="non-scaling-stroke" />)}</g>
        <g>
          {paths.map(({ i, d }) => (
            <path key={i.s.code + '-' + replay} d={d} className={'street-case' + (delayOf ? ' draw' : '')} pathLength={delayOf ? 1 : undefined} style={delayOf ? { animationDelay: `${delayOf(i.s.code)}s`, animationDuration: `${drawDur}s` } : undefined} strokeWidth={widthOf(i.s) + (selected === i.s.code ? 6 : 2.4)} vectorEffect="non-scaling-stroke" opacity={selected && selected !== i.s.code ? 0.35 : 1} pointerEvents="none" />
          ))}
        </g>
        <g>
          {paths.map(({ i, d }) => {
            const on = selected === i.s.code;
            return (
              <path
                key={i.s.code + '-' + replay} d={d} className="street draw" pathLength={1}
                style={delayOf ? { animationDelay: `${delayOf(i.s.code)}s`, animationDuration: `${drawDur}s` } : undefined}
                stroke={i.color} strokeWidth={widthOf(i.s) + (on ? 3 : 0)} vectorEffect="non-scaling-stroke"
                opacity={selected && !on ? 0.45 : 1}
                data-code={i.s.code}
                onClick={() => { if (!drag.current?.moved) onSelect?.(i.s.code); }}
                onMouseMove={(e) => { const r = wrap.current!.getBoundingClientRect(); setTip({ x: e.clientX - r.left, y: e.clientY - r.top, t: i.tip }); }}
                onMouseLeave={() => setTip(null)}
              ><title>{i.tip}</title></path>
            );
          })}
        </g>
        <g>
          <defs>{labels.map((p) => <path key={p.i.s.code} id={`lp-${uid}-${p.i.s.code}`} d={p.lp!.d} />)}</defs>
          {labels.map((p) => (
            <text key={p.i.s.code} className="lbl" style={{ fontSize: 13.5 * scale, strokeWidth: 3.8 * scale }} dy={-(widthOf(p.i.s) / 2 + 4) * scale}>
              <textPath href={`#lp-${uid}-${p.i.s.code}`} startOffset="50%" textAnchor="middle">{p.i.s.name}</textPath>
            </text>
          ))}
        </g>
        {marks.length > 0 && <g className="marks fade-in" key={'m' + replay} style={{ animationDelay: `${marksDelay}s` }}>
          {(() => {
            // תוויות שטח בלי חפיפה: מה שמתנגש מוסתר עד שמגדילים
            const box: { x: number; y: number }[] = [];
            return marks.map((m) => ({ m, p: geo.P(m.lon, m.lat) })).filter(({ p: [x, y] }) => {
              const hit = box.some((b) => Math.abs(b.x - x) < 40 * scale && Math.abs(b.y - y) < 46 * scale);
              if (!hit) box.push({ x, y }); return !hit;
            });
          })().map(({ m, p: [x, y] }) => {
            return (
              <g key={m.key} className="mark" onClick={() => { if (!drag.current?.moved) m.onClick?.(); }} role="link" aria-label={`${m.title}${m.value != null ? `, ממוצע ${m.value}` : ''}`}>
                <text x={x} y={y} textAnchor="middle" className="m-t" style={{ fontSize: 15 * scale, strokeWidth: 5 * scale }}>{m.title}</text>
                {m.value != null && <>
                  <rect x={x - 15 * scale} y={y + 5 * scale} width={30 * scale} height={19 * scale} fill={m.color} stroke="#fff" strokeWidth={1.5 * scale} />
                  <text x={x} y={y + 19.5 * scale} textAnchor="middle" className="m-v" style={{ fontSize: 13.5 * scale, fill: m.ink ?? ((m.value ?? 0) > 82 ? '#fff' : '#1A1A18') }}>{m.value}</text>
                </>}
              </g>
            );
          })}
        </g>}
      </svg>
      {tip && <div className="map-tip" style={{ left: tip.x, top: tip.y }}>{tip.t}</div>}
      {(() => {
        const m = NICE.find((n) => n / scale >= 70) ?? NICE[NICE.length - 1];
        const px = m / scale;
        return (
          <div className="scalebar" aria-label={`קנה מידה: ${m} מטרים`}>
            <svg width={px + 2} height="10" style={{ direction: 'ltr' }}><path d={`M1 1V9H${px + 1}V1`} fill="none" stroke="#1A1A18" strokeWidth="1.5" /><path d={`M${px / 2 + 1} 5V9`} stroke="#1A1A18" /></svg>
            <span>{m >= 1000 ? `${m / 1000} ק"מ` : `${m} מ'`}</span>
          </div>
        );
      })()}
      <svg className="north" width="22" height="30" viewBox="0 0 22 30" aria-label="צפון"><path d="M11 2 L18 22 L11 17 L4 22 Z" fill="#1A1A18" /><path d="M11 2 L4 22 L11 17 Z" fill="#fff" stroke="#1A1A18" strokeWidth="1" /><text x="11" y="29.5" textAnchor="middle" fontSize="8" fontWeight="600" fill="#1A1A18">צ</text></svg>
      {legend && <div className="legend">{legend}</div>}
      {sat && <span className="sat-credit">תצלום: Esri, Maxar, Earthstar Geographics</span>}
      {overlay}
    </div>
  );
}
