import { useMemo, useState } from 'react';
import type { Model } from '../lib/model';
import { PARAMS, summarize } from '../lib/model';
import { QMAP, QUARTERS } from '../data/quarters';
import { ACTIONS, BASIS, TIERS, type Tier } from '../lib/actions';
import { actionPlan } from '../lib/story';
import { go, setParam, type Route } from '../lib/route';
import Rich from '../components/Rich';

export default function Actions({ model, route }: { model: Model; route: Route }) {
  const qid = route.q.get('q');
  const sum = useMemo(() => summarize(model, qid ? [qid] : null), [model, qid]);
  const plan = useMemo(() => actionPlan(model, sum.streets), [model, sum]);
  const [copied, setCopied] = useState(false);
  const place = qid ? QMAP[qid]?.name : 'אשדוד';
  const top = plan[0];

  const guidelines = PARAMS.map((p) => `- ${p.label}: ${ACTIONS[p.key].guideline}`).join('\n');
  const copy = async () => {
    try { await navigator.clipboard.writeText(`הנחיות רחוב לתכנון חדש (רחוב טוב במספרים)\n${guidelines}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* אין הרשאת לוח */ }
  };

  return (
    <main className="body scroll">
      <div className="head">
        <div>
          <p className="crumbs"><a href="#/">אשדוד</a> / תוכנית פעולה{qid ? ` / ${place}` : ''}</p>
          <Rich as="h1" className="insight-line">{top ? `==ב${place}, הכי הרבה נקודות על הכף ב**${top.p.label}**.==` : `==ב${place} אין פרמטר מתחת למחצית היעד.==`}</Rich>
          <Rich as="p" className="explain">{top ? `**${top.streets.length}** רחובות מתחת למחצית היעד, ו-**${top.stake}** נקודות של שכונה 360 שאפשר להחזיר. הסדר: כמה נקודות אפשר להחזיר, לא כמה רחובות.` : ''}</Rich>
        </div>
        <div className="chips" role="group" aria-label="בחירת רובע">
          {QUARTERS.filter((q) => q.kind === 'quarter').map((q) => (
            <button key={q.id} className="chip-t" aria-pressed={qid === q.id} onClick={() => setParam('q', qid === q.id ? null : q.id)} title={q.name}>{q.short}</button>
          ))}
          <button className="chip-t all" aria-pressed={!qid} onClick={() => setParam('q', null)}>כל העיר</button>
        </div>
      </div>

      <div className="band-grid three">
        {(['now', 'think', 'plan'] as Tier[]).map((t) => {
          const rows = plan.filter((r) => r.tier === t);
          return (
            <section key={t} className={`card tier tier-${t}`} aria-label={TIERS[t].title}>
              <h2 className="mini-h">{TIERS[t].title}</h2>
              <p className="src">{TIERS[t].sub}</p>
              {rows.map((r) => (
                <article key={r.p.key} className="act-card">
                  <div className="act-top">
                    <strong>{r.p.label}</strong>
                    <Rich as="span" className="src">{`**${r.streets.length}** רחובות · **${r.stake}** נקודות`}</Rich>
                  </div>
                  <p><span className="label">ברחוב הקיים</span> {r.existing}</p>
                  <p><span className="label">בתוכנית חדשה</span> {r.guideline}</p>
                  <p className="src">אחראי: {r.who} · {BASIS[ACTIONS[r.p.key].basis].he}: {r.p.target}</p>
                  <div className="street-chips">
                    {r.streets.slice(0, 8).map((x) => (
                      <button key={x.s.code} className="chip-s" onClick={() => go(`#/s/${x.s.code}`)} title={x.s.quarter_id ? QMAP[x.s.quarter_id]?.name : ''}>{x.s.name}</button>
                    ))}
                    {r.streets.length > 8 && <span className="src">ועוד {r.streets.length - 8}</span>}
                  </div>
                </article>
              ))}
              {t === 'now' && (
                <div className="tone tone-neutral" style={{ marginTop: 8 }}>
                  <h4>עוד לא נמדד, וזול לתקן</h4>
                  <p>עצים, ספסלים, תאורה ומדרכות שייכים לשלב הזה. הם ייכנסו לרשימה כשיהיו נתונים: סקר עצים, שכבת התאורה ושכבת המדרכות.</p>
                </div>
              )}
              {!rows.length && t !== 'now' && <p className="muted">אין כאן פרמטר מתחת למחצית היעד.</p>}
            </section>
          );
        })}
      </div>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="panel-h" style={{ padding: 0 }}>
          <h2 className="mini-h" style={{ margin: 0 }}>הנחיות רחוב לתכנון חדש, להעתקה</h2>
          <button className="press btn" onClick={copy}>{copied ? 'הועתק' : 'העתקת ההנחיות'}</button>
        </div>
        <p className="src">מה לדרוש מכל תב"ע, תוכנית בינוי ותוכנית התחדשות. כולל את מה שעוד לא נמדד.</p>
        <ul className="guides">
          {PARAMS.map((p) => (
            <li key={p.key}><strong>{p.label}:</strong> {ACTIONS[p.key].guideline} <span className="src">({BASIS[ACTIONS[p.key].basis].he})</span></li>
          ))}
        </ul>
      </section>
    </main>
  );
}
