import { Fragment, useMemo, useState } from 'react';
import type { Model, Scored } from '../lib/model';
import { summarize, scoreColor } from '../lib/model';
import { ACTIONS, BASIS, TIERS } from '../lib/actions';
import { PARTIAL, PHASES, briefText, decisions, missingLayers, pilot, qname, scenario, workMatrix, type Cell, type QRow, type Topic } from '../lib/workplan';
import { go, setParam, type Route } from '../lib/route';
import { Sketch } from '../components/Sketch';
import Rich from '../components/Rich';

// צבעי המפה: סימן אחד למשמעות אחת. אדום נדרש, שנתה לא ידוע (חסרה שכבה), בהיר בסדר.
const C_NEED = '#A6362C', C_UNK = '#A9A8A2', C_OK = '#E4E3DE';

/** מפת מבצע: כל הרחובות, והרחובות שבהם המבצע נדרש באדום. */
function OpMap({ streets, need, unknown, thin, label, h }: { streets: Scored[]; need: Set<number>; unknown?: Set<number>; thin?: boolean; label: string; h: number }) {
  const lines = useMemo(() => streets.map((x) => {
    const n = need.has(x.s.code), u = !n && unknown?.has(x.s.code);
    return { key: x.s.code, line: x.s.line, color: n ? C_NEED : u ? C_UNK : C_OK, w: (thin ? 0.9 : 1.8) + (n ? (thin ? 0.9 : 1.6) : u ? 0.3 : 0), top: n };
  }), [streets, need, unknown, thin]);
  return <div className="wp-map" style={{ height: h }}><Sketch lines={lines} label={label} cased={!thin} /></div>;
}

function MapKey({ unknown }: { unknown?: boolean }) {
  return (
    <div className="wp-mapkey src">
      <span><i style={{ background: C_NEED }} />נדרש טיפול</span>
      {unknown && <span><i style={{ background: C_UNK }} />לא ידוע: חסרה שכבה</span>}
      <span><i style={{ background: C_OK }} />עומד במחצית היעד ומעלה</span>
    </div>
  );
}

/** תרחיש ההשפעה: ממוצע לפני ואחרי כל שלב. */
function Scenario({ steps }: { steps: { label: string; avg: number; below: number }[] }) {
  return (
    <div className="wp-steps" role="img" aria-label={`ממוצע: ${steps.map((s) => `${s.label} ${s.avg}`).join(', ')}`}>
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

const codes = (xs: Scored[]) => new Set(xs.map((x) => x.s.code));
function topicSets(rows: QRow[], key: string) {
  return { need: codes(rows.flatMap((r) => r.cells[key].streets)), unknown: codes(rows.flatMap((r) => r.cells[key].unknown)) };
}

function CellCard({ c }: { c: Cell }) {
  const a = ACTIONS[c.p.key];
  return (
    <article className="wp-op">
      <OpMap streets={c.all} need={codes(c.streets)} unknown={codes(c.unknown)} label={`${c.p.label} ב${qname(c.qid)}: ${c.streets.length} רחובות באדום`} h={170} />
      <div className="wp-op-t">
        <div className="act-top">
          <strong>{c.p.label}</strong>
          <Rich as="span" className="src">{`**${c.streets.length}** רחובות · **${c.stake}** נקודות`}</Rich>
        </div>
        <p><span className="label">מה עושים</span> {a.existing}</p>
        {c.unknown.length > 0 && <Rich as="p" className="src wp-unk">{`ועוד **${c.unknown.length}** רחובות "לא ידוע": אין בהם פריט ממופה. נבדקים מול ${PARTIAL[c.p.key]}.`}</Rich>}
        <p className="src">אחראי: {a.who} · {BASIS[a.basis].he}: {c.p.target}</p>
        <div className="street-chips">
          {c.streets.slice(0, 8).map((x) => <button key={x.s.code} className="chip-s" onClick={() => go(`#/s/${x.s.code}`)}>{x.s.name}</button>)}
          {c.streets.length > 8 && <span className="src">ועוד {c.streets.length - 8}</span>}
        </div>
      </div>
    </article>
  );
}

function TopicItem({ t, rows, city, onPick }: { t: Topic; rows: QRow[]; city: Scored[]; onPick: () => void }) {
  const sets = useMemo(() => topicSets(rows, t.p.key), [rows, t]);
  return (
    <div className="wp-ti">
      <OpMap streets={city} need={sets.need} unknown={sets.unknown} thin label={`${t.p.label}: ${t.streets} רחובות באדום`} h={120} />
      <div>
        <button className="link-btn" onClick={onPick}><strong>{t.p.label}</strong></button>
        <Rich as="p" className="src">{`**${t.streets}** רחובות · **${t.stake}** נקודות · ${t.who}`}</Rich>
        {t.unknown > 0 && <Rich as="p" className="src wp-unk">{`**${t.unknown}** "לא ידוע"`}</Rich>}
      </div>
    </div>
  );
}

export default function WorkPlan({ model, route }: { model: Model; route: Route }) {
  const view = route.q.get('v') === 't' ? 't' : 'q';
  const city = useMemo(() => summarize(model, null), [model]);
  const steps = useMemo(() => scenario(model, city.streets), [model, city]);
  const mx = useMemo(() => workMatrix(model), [model]);
  const pl = useMemo(() => pilot(model), [model]);
  const decs = useMemo(() => decisions(model), [model]);
  const layers = useMemo(() => missingLayers(model), [model]);
  const [copied, setCopied] = useState(false);
  const [allOps, setAllOps] = useState(false);

  const qid = route.q.get('q') ?? pl?.qid ?? mx.rows[0]?.qid;
  const tkey = route.q.get('t') ?? mx.topics[0]?.p.key;
  const row = mx.rows.find((r) => r.qid === qid);
  const topic = mx.topics.find((t) => t.p.key === tkey);
  const qSteps = useMemo(() => (row ? scenario(model, summarize(model, [row.qid]).streets) : null), [model, row]);
  const tSets = useMemo(() => (topic ? topicSets(mx.rows, topic.p.key) : null), [mx, topic]);
  const firstArea = mx.rows.findIndex((r) => r.area);
  const unkTotal = mx.topics.reduce((a, t) => a + t.unknown, 0);

  const pick = (v: 'q' | 't', key: string) => { setParam('v', v === 'q' ? null : 't'); setParam(v, key); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(briefText(model)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* אין הרשאת לוח */ }
  };
  const first = mx.topics[0];

  return (
    <main className="body scroll wp">
      <div className="head">
        <div>
          <p className="crumbs"><a href="#/city">אשדוד</a> / תוכנית עבודה · הצעה למהנדס העיר, לאישור המנכ"ל</p>
          <Rich as="h1" className="insight-line">{`==שלושה שלבים מעלים את ממוצע העיר מ-**${steps[0].avg}** ל-**${steps[3].avg}**.==`}</Rich>
          <Rich as="p" className="explain">{`**${steps[0].below - steps[3].below}** רחובות יוצאים מתחת ל-**50**. מתחילים ב**${first?.p.label ?? 'נושא הראשון'}**. רחוב בלי נתון מסומן "לא ידוע", לא "חסר".`}</Rich>
        </div>
      </div>

      <div className="band-grid two">
        <section className="card" aria-labelledby="wp-sc">
          <h2 id="wp-sc" className="mini-h">תרחיש ההשפעה: ממוצע העיר אחרי כל שלב</h2>
          <Scenario steps={steps} />
          <p className="src">הערכה, תרחיש תקרה: כל רחוב שמתחת למחצית היעד מגיע ליעד. רחובות "לא ידוע" לא נכללים. זה הגבול העליון, לא תחזית.</p>
        </section>
        {pl && (
          <section className="card wp-pilot" aria-labelledby="wp-pl">
            <h2 id="wp-pl" className="mini-h">רובע מומלץ לפיילוט</h2>
            {(() => { const r = mx.rows.find((x) => x.qid === pl.qid); const all = r ? Object.values(r.cells)[0].all : []; const need = codes(r ? r.top.flatMap((c) => (ACTIONS[c.p.key].tier !== 'plan' ? c.streets : [])) : []); return <OpMap streets={all} need={need} label={`${pl.name}: הרחובות שבהם שלבים א' וב' נדרשים`} h={150} />; })()}
            <div className="wp-pilot-n">
              <button className="link-btn" onClick={() => pick('q', pl.qid)}>{pl.name}</button>
              <span><bdi className="num" style={{ color: scoreColor(pl.now) }}>{pl.now}</bdi> ← <bdi className="num" style={{ color: scoreColor(pl.after) }}>{pl.after}</bdi></span>
            </div>
            <Rich as="p" className="explain">{`**${pl.n}** רחובות, **${pl.below}** מהם מתחת ל-**50**. באדום: איפה שלבים א' וב' נדרשים. כאן הם מוסיפים הכי הרבה נקודות בעיר.`}</Rich>
          </section>
        )}
      </div>

      <section className="band" aria-labelledby="wp-ly">
        <h2 id="wp-ly" className="band-h"><span className="label">לפני הכול</span>השכבות שחסרות לי, כדי שהתוכנית תהיה מדויקת</h2>
        <Rich as="p" className="explain">{`==רחוב בלי פריט ממופה הוא "לא ידוע", לא "חסר".== היום **${unkTotal}** רחובות כאלה בנושאים שבתוכנית. עצים, ספסלים, תאורה ומדרכות לא נכנסים לתוכנית בכלל, עד שתגיע השכבה.`}</Rich>
        <div className="wp-layers">
          {layers.map((l) => (
            <div key={l.what} className={`wp-layer${l.affects ? ' on' : ''}`}>
              <div className="wp-layer-h">
                <strong>{l.what}</strong>
                {l.cov != null ? <span className="wp-cov"><span className="wp-cov-bar"><i style={{ width: `${l.cov}%` }} /></span><bdi className="num">{l.cov}%</bdi></span> : <span className="src">{l.covText}</span>}
              </div>
              <p className="src">מקור: {l.from}</p>
              <Rich as="p" className="wp-layer-o">{l.opens}</Rich>
            </div>
          ))}
        </div>
        <p className="src">הפס: כמה מהרחובות המדודים יש בהם לפחות פריט ממופה אחד. מסומן בצבע: שכבה שמשפיעה כבר היום על התוכנית.</p>
      </section>

      <section className="band" aria-labelledby="wp-mx">
        <h2 id="wp-mx" className="band-h"><span className="label">מפת עבודה</span>רובע מול נושא, מהדחוף ביותר</h2>
        <p className="src">כל תא: נקודות שכונה 360 שאפשר להחזיר ברחובות שמתחת למחצית היעד. כהה יותר, דחוף יותר. לחיצה על רובע פותחת את תוכנית מנהל הרובע, לחיצה על נושא את תוכנית האגף.</p>
        <div className="wp-mx-wrap">
          <table className="wp-mx">
            <thead>
              <tr>
                <th className="wp-corner"><span className="src">רובע / נושא</span></th>
                {mx.topics.map((t) => (
                  <th key={t.p.key} className={`wp-th tier-${t.tier}`}>
                    <button onClick={() => pick('t', t.p.key)} aria-pressed={view === 't' && t.p.key === tkey}>{t.p.label}</button>
                  </th>
                ))}
                <th className="wp-th wp-tot">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {mx.rows.map((r, i) => (
                <Fragment key={r.qid}>
                  {i === firstArea && <tr className="wp-sep"><th colSpan={mx.topics.length + 2}>אזורים שאינם מגורים: תעשייה, נמל, מרכזים וצירים</th></tr>}
                  <tr className={view === 'q' && r.qid === qid ? 'hl' : undefined}>
                    <th className="wp-rh"><button onClick={() => pick('q', r.qid)} aria-pressed={view === 'q' && r.qid === qid}>{r.name}</button></th>
                    {mx.topics.map((t) => {
                      const c = r.cells[t.p.key];
                      const a = c.stake / mx.maxCell;
                      return (
                        <td key={t.p.key} style={{ background: c.stake ? `rgba(166,54,44,${0.08 + a * 0.82})` : '#F7F7F4', color: a > 0.5 ? '#fff' : 'var(--ink)' }} title={`${r.name}, ${t.p.label}: ${c.streets.length} רחובות, ${c.stake} נקודות${c.unknown.length ? `, ${c.unknown.length} לא ידוע` : ''}`}>
                          {c.stake || ''}
                        </td>
                      );
                    })}
                    <td className="wp-tot">{r.stake}</td>
                  </tr>
                </Fragment>
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
              <Rich as="p" className="explain">{`**${row.n}** רחובות מדודים, ממוצע **${row.avg}**. סדר העבודה לפי הנקודות על הכף:`}</Rich>
              <ol className="wp-order">
                {row.top.map((c) => <li key={c.p.key}><strong>{c.p.label}</strong> <span className="src">שלב {PHASES.find((ph) => ph.tier === ACTIONS[c.p.key].tier)?.n}' · {c.streets.length} רחובות · {c.stake} נקודות</span></li>)}
              </ol>
              <button className="link-btn" onClick={() => go(`#/q/${row.qid}`)}>למפת הרובע</button>
            </div>
            <div className="card">
              <MapKey unknown={row.top.some((c) => c.unknown.length > 0)} />
              {(allOps ? row.top : row.top.slice(0, 3)).map((c) => <CellCard key={c.p.key} c={c} />)}
              {row.top.length > 3 && <button className="press btn wp-more" onClick={() => setAllOps(!allOps)}>{allOps ? 'רק שלושת הראשונים' : `כל ${row.top.length} המבצעים`}</button>}
              {!row.top.length && <p className="muted">אין כאן נושא מתחת למחצית היעד.</p>}
            </div>
          </div>
        )}
        {view === 't' && topic && tSets && (
          <div className="band-grid two">
            <div className="card">
              <OpMap streets={city.streets} need={tSets.need} unknown={tSets.unknown} thin label={`${topic.p.label}: איפה נדרש`} h={340} />
              <MapKey unknown={tSets.unknown.size > 0} />
            </div>
            <div className="card">
              <Rich as="p" className="explain">{`**${topic.p.label}**: **${topic.streets}** רחובות מתחת למחצית היעד (${topic.p.target}). אחראי: **${topic.who}**. ${TIERS[topic.tier].title}.`}</Rich>
              {topic.unknown > 0 && <Rich as="p" className="src wp-unk">{`**${topic.unknown}** רחובות נוספים "לא ידוע": אין בהם פריט ממופה, ולכן לא נספרו. נבדקים מול ${PARTIAL[topic.p.key]}.`}</Rich>}
              <p><span className="label">ברחוב הקיים</span> {ACTIONS[topic.p.key].existing}</p>
              <p><span className="label">בתוכנית חדשה</span> {ACTIONS[topic.p.key].guideline}</p>
              <p className="mini-h">סדר הרבעים</p>
              <ol className="wp-order">
                {topic.cells.map((c) => (
                  <li key={c.qid}><button className="link-btn" onClick={() => pick('q', c.qid)}>{qname(c.qid)}</button> <span className="src">{c.streets.length} רחובות · {c.stake} נקודות</span></li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </section>

      <section className="band" aria-labelledby="wp-ph">
        <h2 id="wp-ph" className="band-h"><span className="label">לוח זמנים</span>שלושה שלבים, מבצע אחד במפה אחת</h2>
        <MapKey unknown />
        <div className="band-grid three">
          {PHASES.map((ph) => {
            const ts = mx.topics.filter((t) => t.tier === ph.tier);
            return (
              <section key={ph.tier} className={`card tier tier-${ph.tier}`}>
                <h3 className="mini-h">שלב {ph.n}': {ph.title} <span className="src">{ph.when}</span></h3>
                <p className="src">{ph.how}</p>
                {ts.map((t) => <TopicItem key={t.p.key} t={t} rows={mx.rows} city={city.streets} onPick={() => pick('t', t.p.key)} />)}
                {ph.tier === 'now' && <p className="src">עצים, ספסלים, תאורה ומדרכות שייכים לשלב הזה. הם לא בתוכנית כי אין שכבה, לא כי ידוע שהם חסרים.</p>}
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
            <p className="src">מצב היום, השלבים, הפיילוט, ההחלטות והשכבות החסרות. מוכן להדבקה במייל או במסמך.</p>
            <button className="press btn" onClick={copy}>{copied ? 'הועתק' : 'העתקת התקציר'}</button>
            <div className="wp-levels">
              <p><span className="label">עובדה</span> הציונים, מספר הרחובות והנקודות: נמדדו מהנתונים.</p>
              <p><span className="label">לא ידוע</span> רחוב בלי פריט ממופה בשכבה חלקית: לא נספר כחסר.</p>
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
