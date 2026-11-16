// רכיבי טור הקריאה: אותו רכיב בכל רמה (עיר, רובע, רחוב), כדי שסימן אחד יאמר דבר אחד בכל מקום.
import type { ReactNode } from 'react';
import type { Model, Param } from '../lib/model';
import { scoreColor, textOn } from '../lib/model';
import { setParam } from '../lib/route';
import Rich from './Rich';

export function Bar({ v, color }: { v: number; color?: string }) {
  return <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color ?? scoreColor(v) }} /></span>;
}

/** התפלגות ציונים: עמודה לכל עשירון, בצבע הסולם. 0 מימין, 100 משמאל, כמו כיוון הקריאה. */
export function Histogram({ hist, small }: { hist: number[]; small?: boolean }) {
  const max = Math.max(...hist, 1);
  return (
    <svg className={'hist' + (small ? ' small' : '')} viewBox="0 0 300 120" role="img" aria-label="התפלגות ציוני הרחובות" style={{ direction: 'ltr' }}>
      {hist.map((n, i) => {
        const h = (n / max) * 92;
        return (
          <g key={i}>
            <rect x={300 - (i + 1) * 30 + 3} y={100 - h} width={24} height={h} fill={scoreColor(i * 10 + 5)} />
            {!small && <text x={300 - i * 30 - 15} y={100 - h - 3} textAnchor="middle" className="hist-n">{n || ''}</text>}
            {(!small || i % 5 === 0) && <text x={300 - i * 30 - 15} y={116} textAnchor="middle" className="hist-x">{i * 10}</text>}
          </g>
        );
      })}
      <line x1="0" x2="300" y1="100" y2="100" stroke="#1A1A18" strokeWidth="1.2" />
    </svg>
  );
}

export const histOf = (totals: number[]) => Array.from({ length: 10 }, (_, i) => totals.filter((t) => Math.min(9, Math.floor(t / 10)) === i).length);

/** ציון גדול: המספר הוא המוקד של הכותרת. */
export function ScoreBadge({ v, sub }: { v: number | null; sub?: string }) {
  return (
    <div className="badge">
      <span className="badge-n" style={{ background: scoreColor(v), color: textOn(v) }}>{v ?? '—'}</span>
      {sub && <Rich as="span" className="badge-s">{sub}</Rich>}
    </div>
  );
}

/** תשובה: שאלה קטנה, תשובה גדולה עם ציון, ושורת הסבר. כפתור שבוחר במפה. */
export function Answer({ q, name, score, sub, kind, pressed, onClick }: {
  q: string; name?: string | null; score?: number | null; sub?: string; kind: 'good' | 'bad' | 'gap'; pressed?: boolean; onClick?: () => void;
}) {
  return (
    <button className={`answer press k-${kind}`} aria-pressed={pressed} onClick={onClick} disabled={!name}>
      <span className="q">{q}</span>
      <span className="big">{name ?? '—'}{score != null && <span className="score" style={{ background: scoreColor(score), color: textOn(score) }}>{score}</span>}</span>
      {sub && <Rich as="span" className="sub">{sub}</Rich>}
    </button>
  );
}

/** לשוניות טור הקריאה. המצב נשמר בכתובת (t=), הלשונית הראשונה היא ברירת המחדל. */
export function ReadTabs({ tabs, cur }: { tabs: readonly (readonly [string, string])[]; cur: string }) {
  return (
    <div className="a-tabs" role="tablist" aria-label="מה רואים בטור">
      {tabs.map(([k, l], i) => (
        <button key={k} role="tab" className={`a-tab k-${k}`} aria-selected={cur === k} onClick={() => setParam('t', i === 0 ? null : k)}>{l}</button>
      ))}
    </div>
  );
}

/** בורר צבע המפה: ציון כולל או פרמטר אחד. נשמר בכתובת (c=). */
export function ColorSelect({ model, colorBy }: { model: Model; colorBy: Param | null }) {
  return (
    <label className="color-sel">
      <span className="label">צבע לפי</span>
      <select className="field" value={colorBy?.key ?? ''} onChange={(e) => setParam('c', e.target.value || null)} aria-label="צבע המפה לפי">
        <option value="">ציון כולל</option>
        {model.entering.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
    </label>
  );
}

export function Legend({ title, note }: { title: string; note?: ReactNode }) {
  return <>
    <span>{title}</span>
    <span className="ramp" />
    <span className="ticks"><span>0 חלש</span><span>50</span><span>100 חזק</span></span>
    {note && <span className="muted">{note}</span>}
  </>;
}

/** פסקת ממצאים: כל משפט בשורה, עם מרקר ובולד מהנוסח. */
export function Lines({ lines }: { lines: string[] }) {
  return <div className="lines">{lines.map((l, i) => <Rich key={i} as="p">{l}</Rich>)}</div>;
}

/** שני החדרים של "איך מודדים": השיטה וההצלבה. */
export function MethodNav({ cur }: { cur: 'm' | 'x' }) {
  return (
    <div className="a-tabs sub-nav" role="tablist" aria-label="איך מודדים">
      <a role="tab" className="a-tab" aria-selected={cur === 'm'} href="#/m">השיטה והאמינות</a>
      <a role="tab" className="a-tab" aria-selected={cur === 'x'} href="#/x">ההצלבה: עקרונות מול מדדים</a>
    </div>
  );
}
