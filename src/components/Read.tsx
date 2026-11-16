// רכיבי טור הקריאה: אותו רכיב בכל רמה (עיר, רובע, רחוב), כדי שסימן אחד יאמר דבר אחד בכל מקום.
import type { ReactNode } from 'react';
import type { Model, Param } from '../lib/model';
import { scoreColor, textOn } from '../lib/model';
import { setParam } from '../lib/route';
import Icon from './Icon';
import Rich from './Rich';
import { CountUp } from './Motion';

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
            <rect className="grow" style={{ animationDelay: `${0.15 + i * 0.07}s` }} x={300 - (i + 1) * 30 + 3} y={100 - h} width={24} height={h} fill={scoreColor(i * 10 + 5)} />
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
export function ScoreBadge({ v, sub, count }: { v: number | null; sub?: string; count?: boolean }) {
  return (
    <div className="badge">
      <span className="badge-n" style={{ background: scoreColor(v), color: textOn(v) }}>{v == null ? '—' : count ? <CountUp to={v} /> : v}</span>
      {sub && <Rich as="span" className="badge-s">{sub}</Rich>}
    </div>
  );
}

/** תשובה: שאלה קטנה, תשובה גדולה עם ציון, ושורת הסבר. כפתור שבוחר במפה. */
export function Answer({ q, name, score, sub, kind, pressed, onClick, art }: {
  q: string; name?: string | null; score?: number | null; sub?: string; kind: 'good' | 'bad' | 'gap'; pressed?: boolean; onClick?: () => void; art?: ReactNode;
}) {
  return (
    <button className={`answer press k-${kind}${art ? ' has-art' : ''}`} aria-pressed={pressed} onClick={onClick} disabled={!name}>
      {art && <span className="art">{art}</span>}
      <span className="q">{q}</span>
      <span className="big">{name ?? '—'}{score != null && <span className="score" style={{ background: scoreColor(score), color: textOn(score) }}>{score}</span>}</span>
      {sub && <Rich as="span" className="sub">{sub}</Rich>}
    </button>
  );
}

/** פס דירוג: כל רחוב נקודה על סרגל 0 עד 100, בצבע הציון. הרחוב הנבחר גדול ועם שם. */
export function Strip({ values, mark, markLabel, onPick }: { values: { code: number; v: number; name: string }[]; mark?: number | null; markLabel?: string; onPick?: (code: number) => void }) {
  const m = values.find((x) => x.code === mark);
  return (
    <svg className="strip" viewBox="0 0 400 74" role="img" aria-label="כל הרחובות על סרגל הציון" style={{ direction: 'ltr' }}>
      <line x1="10" x2="390" y1="44" y2="44" stroke="#1A1A18" strokeWidth="1.2" />
      {[0, 25, 50, 75, 100].map((t) => <g key={t}><line x1={390 - t * 3.8} x2={390 - t * 3.8} y1="44" y2="50" stroke="#1A1A18" /><text x={390 - t * 3.8} y="64" textAnchor="middle" className="hist-x">{t}</text></g>)}
      {values.map((x, i) => (
        <circle key={x.code} cx={390 - x.v * 3.8} cy={36 - (i % 3) * 6} r={x.code === mark ? 0 : 4.2} fill={scoreColor(x.v)} stroke="#1A1A18" strokeOpacity={0.5} strokeWidth={0.8} onClick={() => onPick?.(x.code)} style={{ cursor: onPick ? 'pointer' : undefined }}><title>{`${x.name}: ${x.v}`}</title></circle>
      ))}
      {m && <g>
        <line x1={390 - m.v * 3.8} x2={390 - m.v * 3.8} y1="14" y2="44" stroke="#1A1A18" strokeWidth="1.4" />
        <circle cx={390 - m.v * 3.8} cy={34} r={8} fill={scoreColor(m.v)} stroke="#1A1A18" strokeWidth={1.6} />
        <text x={Math.min(360, Math.max(40, 390 - m.v * 3.8))} y="10" textAnchor="middle" className="strip-l">{markLabel ?? m.name}</text>
      </g>}
    </svg>
  );
}

/** הרחוב כסרגל: קו באורך הרחוב, שנתה כל 100 מ', ומספר בכל 100. אותו קנה מידה לכל רחוב (עד 1.2 ק"מ). */
export function Ruler({ len }: { len: number }) {
  const max = Math.max(1200, Math.ceil(len / 100) * 100), px = (m: number) => 390 - (m / max) * 380;
  return (
    <svg className="ruler" viewBox="0 0 400 46" role="img" aria-label={`אורך הרחוב: ${Math.round(len)} מטר`} style={{ direction: 'ltr' }}>
      <line x1={px(0)} x2={px(max)} y1="20" y2="20" stroke="#E5E4E0" strokeWidth="6" />
      <line x1={px(0)} x2={px(len)} y1="20" y2="20" stroke="#1A1A18" strokeWidth="6" />
      {Array.from({ length: Math.floor(max / 100) + 1 }, (_, i) => i * 100).map((m) => (
        <g key={m}>
          <line x1={px(m)} x2={px(m)} y1={m % 500 ? 25 : 23} y2={m % 500 ? 31 : 35} stroke={m <= len ? '#1A1A18' : '#B9B8B2'} strokeWidth={m % 500 ? 1 : 1.6} />
          {m % 500 === 0 && <text x={px(m)} y="45" textAnchor="middle" className="hist-x">{m}</text>}
        </g>
      ))}
      <text x={px(len)} y="11" textAnchor="middle" className="strip-l">{`${Math.round(len)} מ'`}</text>
    </svg>
  );
}

const TAB_ICON: Record<string, string> = { ins: 'bulb', act: 'tools', rank: 'list', num: 'chart', m: 'ruler', i360: 'target', guide: 'list' };

/** לשוניות טור הקריאה. המצב נשמר בכתובת (t=), הלשונית הראשונה היא ברירת המחדל. */
export function ReadTabs({ tabs, cur }: { tabs: readonly (readonly [string, string])[]; cur: string }) {
  return (
    <div className="a-tabs" role="tablist" aria-label="מה רואים בטור">
      {tabs.map(([k, l], i) => (
        <button key={k} role="tab" className={`a-tab k-${k}`} aria-selected={cur === k} onClick={() => setParam('t', i === 0 ? null : k)}><Icon n={TAB_ICON[k] ?? 'list'} size={17} />{l}</button>
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
      <a role="tab" className="a-tab" aria-selected={cur === 'm'} href="#/m"><Icon n="ruler" size={17} />השיטה והאמינות</a>
      <a role="tab" className="a-tab" aria-selected={cur === 'x'} href="#/x"><Icon n="grid" size={17} />ההצלבה: עקרונות מול מדדים</a>
    </div>
  );
}

/** נקודת אמצע של הקטע הארוך ברחוב: לשם נפתח מבט הרחוב. */
function midOf(line: number[][][] | null): [number, number] | null {
  const l = (line ?? []).reduce((a, b) => (b.length > a.length ? b : a), [] as number[][]);
  if (!l.length) return null; const p = l[Math.floor(l.length / 2)]; return [p[0], p[1]];
}
/** גוגל מפות: חיפוש לפי שם הרחוב ו"אשדוד", ומבט רחוב באמצע הקטע שנמדד. */
export function GoogleLinks({ name, line }: { name: string; line: number[][][] | null }) {
  const m = midOf(line);
  return (
    <div className="g-links">
      <a className="press btn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, אשדוד`)}`} target="_blank" rel="noopener"><Icon n="pin" />בגוגל מפות</a>
      {m && <a className="press btn" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${m[1].toFixed(6)},${m[0].toFixed(6)}`} target="_blank" rel="noopener"><Icon n="eye" />מבט רחוב</a>}
    </div>
  );
}
