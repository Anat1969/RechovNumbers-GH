import { useMemo, useState } from 'react';
import type { Model } from '../lib/model';
import { summarize, scoreColor } from '../lib/model';
import { ACTIONS, BASIS, TIERS } from '../lib/actions';
import { PHASES, briefText, decisions, pilot, qname, scenario, workMatrix, type Cell } from '../lib/workplan';
import { go, setParam, type Route } from '../lib/route';
import Rich from '../components/Rich';

/** תרחיש ההשפעה: ממוצע העיר לפני ואחרי כל שלב. */
function Scenario({ steps }: { steps: { label: string; avg: number; below: number }[] }) {
  return (
    <div className="wp-steps" role="img" aria-label={`ממוצע העיר: ${steps.map((s) => `${s.label} ${s.avg}`).join(', ')}`}>
      {steps.map((s, i) => (
        <div key={s.label} className="wp-step">
          <span className="wp-step-l">{s.label}</span>
          <span className="wp-step-bar"><i style={{ width: `${s.avg}%`, background: scoreColor(s.avg) }} /></span>
          <bdi className="num wp-step-v">{s.avg}</bdi>
          <span className="src wp-step-b">{i === 0 ? `${s.below} רחובות מתחת ל-50` : `${s.below} מתחת ל-50`}</span>
        </div>
      ))}
    </div>
  );
}

function CellCard({ c }: { c: Cell }) {
  const a = ACTIONS[c.p.key];
  return (
    <article className="act-card">
      <div className="act-top">
        <strong>{c.p.label}</strong>
        <Rich as="span" className="src">{`**${c.streets.length}** רחובות · **${c.stake}** נקודות`}</Rich>
      </div>
      <p><span className="label">מה עושים</span> {a.existing}</p>
      <p className="src">אחראי: {a.who} · {BASIS[a.basis].he}: {c.p.target}</p>
      <div className="street-chips">
        {c.streets.slice(0, 10).map((x) => (
          <button key={x.s.code} className="chip-s" onClick={() => go(`#/s/${x.s.code}`)}>{x.s.name}</button>
        ))}
        {c.streets.length > 10 && <span className="src">ועוד {c.streets.length - 10}</span>}
      </div>
    </article>
  );
}

export default function WorkPlan({ model, route }: { model: Model; route: Route }) {
  const view = route.q.get('v') === 't' ? 't' : 'q';
  const city = useMemo(() => summarize(model, null), [model]);
  const steps = useMemo(() => scenario(model, city.streets), [model, city]);
  const mx = useMemo(() => workMatrix(model), [model]);
  const pl = useMemo(() => pilot(model), [model]);
  const decs = useMemo(() => decisions(model), [model]);
  const [copied, setCopied] = useState(false);

  const qid = route.q.get('q') ?? pl?.qid ?? mx.rows[0]?.qid;
  const tkey = route.q.get('t') ?? mx.topics[0]?.p.key;
  const row = mx.rows.find((r) => r.qid === qid);
  const topic = mx.topics.find((t) => t.p.key === tkey);
  const qSteps = useMemo(() => (row ? scenario(model, summarize(model, [row.qid]).streets) : null), [model, row]);

  const pick = (v: 'q' | 't', key: string) => { setParam('v', v); setParam(v, key); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(briefText(model)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* אין הרשאת לוח */ }
  };
  const first = mx.topics[0];
  const gain = steps[3].avg - steps[0].avg;

  return (
    <main className="body scroll wp">
      <div className="head">
        <div>
          <p className="crumbs"><a href="#/city">אשדוד</a> / תוכנית עבודה · הצעה למהנדס העיר, לאישור המנכ"ל</p>
          <Rich as="h1" className="insight-line">{`==שלושה שלבים מעלים את ממוצע העיר מ-**${steps[0].avg}** ל-**${steps[3].avg}**.==`}</Rich>
          <Rich as="p" className="explain">{`**${steps[0].below - steps[3].below}** רחובות יוצאים מתחת ל-**50**. מתחילים ב**${first?.p.label ?? 'נושא הראשון'}**, זול ומהיר, וממשיכים לפי הנקודות על הכף.`}</Rich>
        </div>
      </div>

      <div className="band-grid two">
        <section className="card" aria-labelledby="wp-sc">
          <h2 id="wp-sc" className="mini-h">תרחיש ההשפעה: ממוצע העיר אחרי כל שלב</h2>
          <Scenario steps={steps} />
          <p className="src">הערכה, תרחיש תקרה: כל רחוב שמתחת למחצית היעד בנושא השלב מגיע ליעד. תוספת של <bdi className="num">{gain}</bdi> נקודות היא הגבול העליון, לא תחזית.</p>
        </section>
        {pl && (
          <section className="card wp-pilot" aria-labelledby="wp-pl">
            <h2 id="wp-pl" className="mini-h">רובע מומלץ לפיילוט</h2>
            <div className="wp-pilot-n">
              <button className="link-btn" onClick={() => pick('q', pl.qid)}>{pl.name}</button>
              <span><bdi className="num" style={{ color: scoreColor(pl.now) }}>{pl.now}</bdi> ← <bdi className="num" style={{ color: scoreColor(pl.after) }}>{pl.after}</bdi></span>
            </div>
            <Rich as="p" className="explain">{`**${pl.n}** רחובות, **${pl.below}** מהם מתחת ל-**50**. שלבים א' וב' מוסיפים כאן הכי הרבה נקודות בעיר: הממוצע עולה ב-**${pl.gain}**. רובע אחד מוכיח את השיטה לפני שמרחיבים.`}</Rich>
          </section>
        )}
      </div>

      <section className="band" aria-labelledby="wp-mx">
        <h2 id="wp-mx" className="band-h"><span className="label">מפת עבודה</span>רובע מול נושא, מהדחוף ביותר</h2>
        <p className="src">כל תא: נקודות שכונה 360 שאפשר להחזיר ברחובות שמתחת למחצית היעד. כהה יותר, דחוף יותר. לחיצה על רובע פותחת את תוכנית מנהל הרובע, לחיצה על נושא את תוכנית האגף.</p>
        <div className="wp-mx-wrap">
          <table className="wp-mx">
            <thead>
              <tr>
                <th className="wp-corner"><span className="src">רובע / נושא</span></th>
                {mx.topics.map((t) => (
                  <th key={t.p.key} className={`wp-th tier-${t.tier}${view === 't' && t.p.key === tkey ? ' hl' : ''}`}>
                    <button onClick={() => pick('t', t.p.key)} aria-pressed={view === 't' && t.p.key === tkey}>{t.p.label}</button>
                  </th>
                ))}
                <th className="wp-th wp-tot">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {mx.rows.map((r) => (
                <tr key={r.qid} className={view === 'q' && r.qid === qid ? 'hl' : undefined}>
                  <th className="wp-rh"><button onClick={() => pick('q', r.qid)} aria-pressed={view === 'q' && r.qid === qid}>{r.name}</button></th>
                  {mx.topics.map((t) => {
                    const c = r.cells[t.p.key];
                    const a = c.stake / mx.maxCell;
                    return (
                      <td key={t.p.key} style={{ background: c.stake ? `rgba(166,54,44,${0.08 + a * 0.82})` : '#F7F7F4', color: a > 0.5 ? '#fff' : 'var(--ink)' }} title={`${r.name}, ${t.p.label}: ${c.streets.length} רחובות, ${c.stake} נקודות`}>
                        {c.stake || ''}
                      </td>
                    );
                  })}
                  <td className="wp-tot">{r.stake}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="wp-key src">
          {PHASES.map((ph) => <span key={ph.tier}><i className={`tier-${ph.tier}`} />שלב {ph.n}': {ph.title}</span>)}
        </div>
      </section>

      <section className="band" aria-labelledby="wp-dt">
        <h2 id="wp-dt" className="band-h">
          <span className="label">{view === 'q' ? 'לפי רובע' : 'לפי נושא'}</span>
          {view === 'q' ? `תוכנית מנהל הרובע: ${row ? row.name : ''}` : `תוכנית האגף: ${topic ? topic.p.label : ''}`}
        </h2>
        <div className="chips wp-chips" role="group" aria-label="סוג התוכנית">
          <button className="chip-t" aria-pressed={view === 'q'} onClick={() => setParam('v', null)}>לפי רובע</button>
          <button className="chip-t" aria-pressed={view === 't'} onClick={() => setParam('v', 't')}>לפי נושא</button>
        </div>
        {view === 'q' && row && (
          <div className="band-grid two">
            <div className="card">
              {qSteps && <Scenario steps={qSteps} />}
              <Rich as="p" className="explain">{`**${row.n}** רחובות מדודים, ממוצע **${row.avg}**. סדר העבודה ברובע לפי הנקודות על הכף:`}</Rich>
              <ol className="wp-order">
                {row.top.map((c) => <li key={c.p.key}><strong>{c.p.label}</strong> <span className="src">שלב {PHASES.find((ph) => ph.tier === ACTIONS[c.p.key].tier)?.n}' · {c.streets.length} רחובות · {c.stake} נקודות</span></li>)}
              </ol>
              <button className="link-btn" onClick={() => go(`#/q/${row.qid}`)}>למפת הרובע</button>
            </div>
            <div className="card">
              {row.top.slice(0, 3).map((c) => <CellCard key={c.p.key} c={c} />)}
              {!row.top.length && <p className="muted">אין ברובע נושא מתחת למחצית היעד.</p>}
            </div>
          </div>
        )}
        {view === 't' && topic && (
          <div className="band-grid two">
            <div className="card">
              <Rich as="p" className="explain">{`**${topic.p.label}**: **${topic.streets}** רחובות בעיר מתחת למחצית היעד (${topic.p.target}). אחראי: **${topic.who}**. ${TIERS[topic.tier].title}.`}</Rich>
              <p><span className="label">ברחוב הקיים</span> {ACTIONS[topic.p.key].existing}</p>
              <p><span className="label">בתוכנית חדשה</span> {ACTIONS[topic.p.key].guideline}</p>
              <p className="mini-h">סדר הרבעים</p>
              <ol className="wp-order">
                {topic.cells.map((c) => (
                  <li key={c.qid}><button className="link-btn" onClick={() => pick('q', c.qid)}>{qname(c.qid)}</button> <span className="src">{c.streets.length} רחובות · {c.stake} נקודות</span></li>
                ))}
              </ol>
            </div>
            <div className="card">
              {topic.cells.slice(0, 3).map((c) => (
                <div key={c.qid}>
                  <p className="mini-h">{qname(c.qid)}</p>
                  <div className="street-chips">
                    {c.streets.slice(0, 10).map((x) => <button key={x.s.code} className="chip-s" onClick={() => go(`#/s/${x.s.code}`)}>{x.s.name}</button>)}
                    {c.streets.length > 10 && <span className="src">ועוד {c.streets.length - 10}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="band" aria-labelledby="wp-ph">
        <h2 id="wp-ph" className="band-h"><span className="label">לוח זמנים</span>שלושה שלבים, מהזול למבני</h2>
        <div className="band-grid three">
          {PHASES.map((ph) => {
            const ts = mx.topics.filter((t) => t.tier === ph.tier);
            return (
              <section key={ph.tier} className={`card tier tier-${ph.tier}`}>
                <h3 className="mini-h">שלב {ph.n}': {ph.title} <span className="src">{ph.when}</span></h3>
                <p className="src">{ph.how}</p>
                {ts.map((t) => (
                  <div key={t.p.key} className="tier-item">
                    <button className="link-btn" onClick={() => pick('t', t.p.key)}><strong>{t.p.label}</strong></button>
                    <span className="src">{t.streets} רחובות · {t.stake} נקודות · {t.who}</span>
                  </div>
                ))}
                {ph.tier === 'now' && <p className="src">עצים, ספסלים, תאורה ומדרכות שייכים לשלב הזה. הם ייכנסו כשיגיעו שכבות הנתונים העירוניות.</p>}
                {!ts.length && ph.tier !== 'now' && <p className="muted">אין נושא מדוד מתחת למחצית היעד.</p>}
              </section>
            );
          })}
        </div>
      </section>

      <section className="band" aria-labelledby="wp-dc">
        <h2 id="wp-dc" className="band-h"><span className="label">לאישור</span>ההחלטות המבוקשות מהמנכ"ל</h2>
        <div className="band-grid two">
          <ol className="wp-dec">
            {decs.map((d) => <li key={d.t}><strong>{d.t}.</strong> <Rich>{d.d}</Rich></li>)}
          </ol>
          <div className="card">
            <h3 className="mini-h">תקציר למנכ"ל, להעתקה</h3>
            <p className="src">עמוד אחד: מצב היום, השלבים, הפיילוט וההחלטות. מוכן להדבקה במייל או במסמך.</p>
            <button className="press btn" onClick={copy}>{copied ? 'הועתק' : 'העתקת התקציר'}</button>
            <div className="wp-levels">
              <p><span className="label">עובדה</span> הציונים, מספר הרחובות והנקודות: נמדדו מהנתונים.</p>
              <p><span className="label">הערכה</span> תרחיש ההשפעה: תקרה, בהנחה שכל רחוב מגיע ליעד.</p>
              <p><span className="label">הנחה</span> לוחות הזמנים והשיוך לגופים: הצעה לדיון באגף.</p>
              <p><span className="label">חסר</span> אומדן עלות: לא הוערך, נדרש מאגף ההנדסה.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
