import { useEffect, useMemo, useRef, useState } from 'react';
import type { Model } from '../lib/model';
import { QMAP } from '../data/quarters';
import { go, type Route } from '../lib/route';
import AIMenu, { type MenuItem } from './AIMenu';

const PREFIX = /^[הובכלמש]/;
/** התאמה בתחילת מילה, גם אחרי אותיות שימוש. מילה עד 3 אותיות חייבת להיות שלמה. */
function matches(name: string, q: string) {
  const words = name.split(/[\s\-"'׳״]+/).filter(Boolean);
  return words.some((w) => {
    const cands = [w, PREFIX.test(w) ? w.slice(1) : w];
    return cands.some((c) => (q.length <= 3 ? c === q : c.startsWith(q)));
  }) || (q.length > 3 && name.includes(q));
}

export function AppIcon({ size = 26 }: { size?: number }) {
  // הרחוב כסרגל: קו דיו עם שנתות, ובסופו נקודת ציון.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill="#fff" />
      <path d="M8 46 L56 18" stroke="#1A1A18" strokeWidth="5" strokeLinecap="square" />
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 14 + i * 9.6, y = 42.5 - i * 5.6;
        return <path key={i} d={`M${x} ${y} l${-2.6} ${-4.5}`} stroke="#1A1A18" strokeWidth="2.5" />;
      })}
      <circle cx="52" cy="20.5" r="7" fill="#166E4A" />
    </svg>
  );
}

export default function TopBar({ route, model, menu, status }: { route: Route; model: Model | null; menu: MenuItem[]; status: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const lastQ = (() => { try { return localStorage.getItem('rn-last-q') || 'q-a'; } catch { return 'q-a'; } })();

  const hits = useMemo(() => {
    const t = q.trim();
    if (!model || t.length < 2) return [];
    return model.streets.filter((x) => matches(x.s.name, t)).slice(0, 12);
  }, [q, model]);

  useEffect(() => {
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []);

  const tabs: [string, string, Route['page'][]][] = [
    ['העיר', '#/', ['home']],
    ['השכונה', `#/q/${lastQ}`, ['quarter', 'street']],
    ['ההצלבה', '#/x', ['cross']],
    ['איך מודדים', '#/m', ['method']],
  ];

  return (
    <header className="topbar">
      <div className="topbar-in">
        <a className="brand" href="#/" aria-label="רחוב טוב במספרים, לדף הבית">
          <AppIcon />
          <span>רחוב טוב <b>במספרים</b></span>
        </a>
        <nav className="tabs" aria-label="ניווט">
          {tabs.map(([label, href, pages]) => (
            <button key={label} className="tab" aria-current={pages.includes(route.page) ? 'page' : undefined} onClick={() => go(href)}>{label}</button>
          ))}
        </nav>
        <div className="top-right">
          <div className="search" ref={box}>
            <input
              className="field" aria-label="חיפוש רחוב" placeholder="חיפוש רחוב" value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={(e) => { e.currentTarget.select(); setOpen(true); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); setOpen(false); } if (e.key === 'Enter' && hits[0]) { go(`#/s/${hits[0].s.code}`); setOpen(false); } }}
            />
            <button className="x" aria-label="ניקוי החיפוש" onClick={() => { setQ(''); setOpen(false); }}>×</button>
            {open && q.trim().length >= 2 && (
              <div className="results" role="listbox">
                {hits.length ? hits.map((x) => (
                  <button key={x.s.code} role="option" onClick={() => { go(`#/s/${x.s.code}`); setOpen(false); }}>
                    <span>{x.s.name} <small>{x.s.quarter_id ? QMAP[x.s.quarter_id]?.name : 'בלי רובע'}</small></span>
                    <bdi className="num">{x.total ?? '—'}</bdi>
                  </button>
                )) : <div className="empty">לא נמצא רחוב בשם הזה. נסו חלק מהשם.</div>}
              </div>
            )}
          </div>
          <AIMenu items={menu} status={status} />
        </div>
      </div>
    </header>
  );
}
