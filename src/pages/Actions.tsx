import { useMemo, useState } from 'react';
import type { Model } from '../lib/model';
import { PARAMS, summarize } from '../lib/model';
import { QMAP, QUARTERS } from '../data/quarters';
import { ACTIONS, BASIS, TIERS, type Tier } from '../lib/actions';
import { actionPlan, quarterRanks } from '../lib/story';
import { go, setParam, type Route } from '../lib/route';
import Rich from '../components/Rich';
import StreetMap, { type MapMark } from '../components/StreetMap';
import { centerOf } from '../components/Sketch';
import { ReadTabs } from '../components/Read';

const TABS = [['act', 'מעשים'], ['guide', 'הנחיות לתכנון חדש']] as const;
const RED = '#A6362C', GREY = '#D9D8D3';

/** תוכנית פעולה כאטלס: המפה מראה איפה צריך את הפעולה שנבחרה, והטור מסדר את הפעולות לפי דחיפות. */
export default function Actions({ model, route }: { model: Model; route: Route }) {
  const qid = route.q.get('q') && QMAP[route.q.get('q')!] ? route.q.get('q') : null;
  const tab = TABS.find(([k]) => k === route.q.get('t'))?.[0] ?? 'act';
  const sum = useMemo(() => summarize(model, qid ? [qid] : null), [model, qid]);
  const plan = useMemo(() => actionPlan(model, sum.streets), [model, sum]);
  const ranks = useMemo(() => quarterRanks(model), [model]);
  const [copied, setCopied] = useState(false);
  const place = qid ? QMAP[qid]?.name : 'אשדוד';
  const pick = plan.find((r) => r.p.key === route.q.get('p')) ?? plan[0];
  const need = useMemo(() => new Set(pick?.streets.map((x) => x.s.code) ?? []), [pick]);

  const items = useMemo(() => sum.streets.map((x) => ({
    s: x.s, color: need.has(x.s.code) ? RED : GREY, weight: need.has(x.s.code) ? 1 : 0,
    tip: need.has(x.s.code) && pick ? `${x.s.name}: ${pick.p.label} מתחת למחצית היעד` : x.s.name,
  })), [sum, need, pick]);
  // בעיר: כמה רחובות צריכים את הפעולה בכל רובע
  const marks: MapMark[] = useMemo(() => (qid || !pick ? [] : ranks.flatMap((r) => {
    const c = centerOf(r.sum.streets); const n = r.sum.streets.filter((x) => need.has(x.s.code)).length;
    return c ? [{ key: r.id, lon: c[0], lat: c[1], title: r.name.replace('רובע ', ''), value: n, color: n ? RED : '#fff', ink: n ? '#fff' : '#1A1A18', onClick: () => setParam('q', r.id) }] : [];
  })), [qid, pick, ranks, need]);

  const guidelines = PARAMS.map((p) => `- ${p.label}: ${ACTIONS[p.key].guideline}`).join('\n');
  const copy = async () => {
    try { await navigator.clipboard.writeText(`הנחיות רחוב לתכנון חדש (רחוב טוב במספרים)\n${guidelines}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* אין הרשאת לוח */ }
  };
  const top = plan[0];

  return (
    <main className="atlas">
      <header className="a-head">
        <div className="crumbs-row">
          <p className="crumbs"><a href="#/">אשדוד</a> / תוכנית פעולה{qid ? ` / ${place}` : ''}</p>
          <select className="field q-sel" value={qid ?? ''} onChange={(e) => setParam('q', e.target.value || null)} aria-label="בחירת רובע לתוכנית">
            <option value="">כל העיר</option>
            {QUARTERS.filter((q) => q.kind === 'quarter').map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
        </div>
        <Rich as="h1" className="insight-line">{top ? `==ב${place}, הכי הרבה נקודות על הכף ב**${top.p.label}**.==` : `==ב${place} אין פרמטר מתחת למחצית היעד.==`}</Rich>
        <Rich as="p" className="explain">{top ? `**${top.streets.length}** רחובות מתחת למחצית היעד, ו-**${top.stake}** נקודות של שכונה 360 שאפשר להחזיר. הסדר: כמה נקודות אפשר להחזיר.` : ''}</Rich>
      </header>

      <section className="a-map panel" aria-label="איפה צריך את הפעולה">
        <div className="panel-h">
          <h2>{pick ? `איפה צריך ${pick.p.label}: ${pick.streets.length} רחובות` : 'אין פעולה נדרשת'}</h2>
          {pick && <span className="src">{TIERS[pick.tier].title} · {pick.who}</span>}
        </div>
        <StreetMap
          key={qid ?? 'city'} items={items} ground={!!qid} thin={qid ? 1 : 0.55} marks={marks}
          context={qid ? model.streets.filter((x) => x.s.quarter_id !== qid).map((x) => x.s) : []}
          onSelect={(code) => go(`#/s/${code}?t=act`)} label={`איפה צריך ${pick?.p.label ?? ''}`}
          legend={<>
            <span><i className="key-sw" style={{ background: RED }} /> מתחת למחצית היעד</span>
            <span><i className="key-sw" style={{ background: GREY }} /> עומד ביעד או קרוב אליו</span>
            {!qid && <span className="muted">המספר ליד הרובע: כמה רחובות בו צריכים את הפעולה. לחיצה מתמקדת ברובע.</span>}
          </>}
        />
      </section>

      <div className="a-body panel">
        <ReadTabs tabs={TABS} cur={tab} />
        <div className="a-pane">
          {tab === 'act' && <>
            {(['now', 'think', 'plan'] as Tier[]).map((t) => {
              const rows = plan.filter((r) => r.tier === t);
              return (
                <section key={t} className={`tier tier-${t}`} aria-label={TIERS[t].title}>
                  <h2 className="mini-h">{TIERS[t].title}</h2>
                  <p className="src">{TIERS[t].sub}</p>
                  {rows.map((r) => (
                    <article key={r.p.key} className={'act-card' + (pick?.p.key === r.p.key ? ' on' : '')}>
                      <button className="act-top link-btn" aria-pressed={pick?.p.key === r.p.key} onClick={() => setParam('p', r.p.key)}>
                        <strong>{r.p.label}</strong>
                        <Rich as="span" className="src">{`**${r.streets.length}** רחובות · **${r.stake}** נקודות`}</Rich>
                      </button>
                      <p><span className="label">ברחוב הקיים</span> {r.existing}</p>
                      {pick?.p.key === r.p.key && <>
                        <p><span className="label">בתוכנית חדשה</span> {r.guideline}</p>
                        <p className="src">אחראי: {r.who} · {BASIS[ACTIONS[r.p.key].basis].he}: {r.p.target}</p>
                        <div className="street-chips">
                          {r.streets.slice(0, 10).map((x) => (
                            <button key={x.s.code} className="chip-s" onClick={() => go(`#/s/${x.s.code}?t=act`)} title={x.s.quarter_id ? QMAP[x.s.quarter_id]?.name : ''}>{x.s.name}</button>
                          ))}
                          {r.streets.length > 10 && <span className="src">ועוד {r.streets.length - 10}</span>}
                        </div>
                      </>}
                    </article>
                  ))}
                  {t === 'now' && (
                    <div className="tone tone-neutral">
                      <h4>עוד לא נמדד, וזול לתקן</h4>
                      <p>עצים, ספסלים, תאורה ומדרכות שייכים לשלב הזה. הם ייכנסו לרשימה כשיעלו שכבות ה-GIS העירוניות.</p>
                    </div>
                  )}
                  {!rows.length && t !== 'now' && <p className="muted">אין כאן פרמטר מתחת למחצית היעד.</p>}
                </section>
              );
            })}
          </>}

          {tab === 'guide' && <>
            <div className="pick-h">
              <h2 className="mini-h">הנחיות רחוב לתכנון חדש</h2>
              <button className="press btn" onClick={copy}>{copied ? 'הועתק' : 'העתקת ההנחיות'}</button>
            </div>
            <p className="src">מה לדרוש מכל תב"ע, תוכנית בינוי ותוכנית התחדשות. כולל את מה שעוד לא נמדד.</p>
            <ul className="guides">
              {PARAMS.map((p) => (
                <li key={p.key}><strong>{p.label}:</strong> {ACTIONS[p.key].guideline} <span className="src">({BASIS[ACTIONS[p.key].basis].he})</span></li>
              ))}
            </ul>
          </>}
        </div>
      </div>
    </main>
  );
}
