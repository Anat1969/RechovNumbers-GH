// בדיקת שטח: כל מדידה מול מה שרואים ברחוב. נשמר בדפדפן של הבודק בלבד, ויוצא כדוח להעתקה.
import { useEffect, useState } from 'react';
import type { Model, Scored } from '../lib/model';
import { scoreColor, textOn } from '../lib/model';
import { fmtVal } from '../lib/insight';
import Icon from './Icon';

type Mark = 'ok' | 'no' | 'unsure';
type State = Record<string, { m?: Mark; note?: string }>;
const MARKS: [Mark, string][] = [['ok', 'נכון'], ['no', 'לא נכון'], ['unsure', 'לא ברור']];
const keyOf = (code: number) => `rn-field-${code}`;
const load = (code: number): State => { try { return JSON.parse(localStorage.getItem(keyOf(code)) || '{}'); } catch { return {}; } };

export default function FieldCheck({ model, x, place }: { model: Model; x: Scored; place: string }) {
  const [st, setSt] = useState<State>(() => load(x.s.code));
  const [copied, setCopied] = useState(false);
  useEffect(() => { setSt(load(x.s.code)); }, [x.s.code]);
  const save = (next: State) => { setSt(next); try { localStorage.setItem(keyOf(x.s.code), JSON.stringify(next)); } catch { /* פרטי */ } };
  const set = (k: string, patch: { m?: Mark; note?: string }) => save({ ...st, [k]: { ...st[k], ...patch } });

  const rows = model.entering.filter((p) => x.values[p.key] != null);
  const done = rows.filter((p) => st[p.key]?.m).length;
  const wrong = rows.filter((p) => st[p.key]?.m === 'no');

  const report = [
    `בדיקת שטח: ${x.s.name}, ${place}, אשדוד`,
    `ציון ${x.total ?? '—'} · נבדקו ${done} מתוך ${rows.length} מדידות · ${new Date().toLocaleDateString('he-IL')}`,
    '',
    ...rows.map((p) => {
      const r = st[p.key]; const mark = r?.m ? MARKS.find(([k]) => k === r.m)![1] : 'לא נבדק';
      return `- ${p.label}: נמדד ${fmtVal(p, x)} (יעד ${p.target}). בשטח: ${mark}${r?.note ? `. ${r.note}` : ''}`;
    }),
  ].join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* אין הרשאה */ } };

  return (
    <div className="field-check">
      <p className="src fc-intro">המפה עברה ללוויין. בדקו כל מדידה מול מה שרואים ב"מבט רחוב" (למעלה) או בשטח.</p>
      <div className="fc-progress" aria-label={`נבדקו ${done} מתוך ${rows.length}`}>
        <span className="bar"><i style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%`, background: 'var(--measure)' }} /></span>
        <span className="src"><bdi className="num">{done}</bdi> מתוך <bdi className="num">{rows.length}</bdi> נבדקו{wrong.length ? <> · <strong className="bad-t">{wrong.length} לא תואמות</strong></> : null}</span>
      </div>
      {rows.map((p) => {
        const s = x.scores[p.key]; const v = s == null ? null : Math.round(s * 100); const r = st[p.key];
        return (
          <div key={p.key} className={'fc-row' + (r?.m ? ` m-${r.m}` : '')}>
            <div className="fc-top">
              <strong>{p.label}</strong>
              <span className="score-pill" style={{ background: scoreColor(v), color: textOn(v) }}>{v ?? '—'}</span>
            </div>
            <span className="fc-val">נמדד: <bdi className="val">{fmtVal(p, x)}</bdi> · יעד: {p.target}</span>
            <div className="fc-marks" role="group" aria-label={`בשטח: ${p.label}`}>
              {MARKS.map(([k, l]) => (
                <button key={k} className={`press btn mk-${k}`} aria-pressed={r?.m === k} onClick={() => set(p.key, { m: r?.m === k ? undefined : k })}>{l}</button>
              ))}
            </div>
            {(r?.m === 'no' || r?.m === 'unsure' || r?.note) && (
              <input className="field fc-note" placeholder="מה רואים בשטח?" aria-label={`הערה: ${p.label}`} value={r?.note ?? ''} onChange={(e) => set(p.key, { note: e.target.value })} />
            )}
          </div>
        );
      })}
      <div className="fc-foot">
        <button className="press btn" onClick={copy} disabled={!done}><Icon n="copy" />{copied ? 'הועתק' : 'העתקת דוח השטח'}</button>
        <span className="src">נשמר רק בדפדפן הזה. כדי לשתף, מעתיקים את הדוח.</span>
      </div>
    </div>
  );
}
