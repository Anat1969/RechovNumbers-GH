import { useMemo, useState } from 'react';
import type { Model } from '../lib/model';
import { PARAMS, scoreColor, summarize, textOn, unranked } from '../lib/model';
import { CRIT, CROSS, FAMILIES } from '../data/criteria';
import { CHAPTER_HEX, IND } from '../data/indicators';
import { QMAP } from '../data/quarters';
import { fmtVal } from '../lib/insight';
import { go, type Route } from '../lib/route';
import StreetMap from '../components/StreetMap';
import Rich from '../components/Rich';
import { streetStory } from '../lib/story';
import { TIERS } from '../lib/actions';

const STATUS_HE: Record<string, string> = { planning: 'בתכנון', approved: 'מאושרת', permit: 'בהיתר', construction: 'בביצוע', completed: 'הושלמה' };

export default function StreetPage({ model, route }: { model: Model; route: Route }) {
  const x = model.byCode[Number(route.id)];
  const [open, setOpen] = useState<string | null>(null);
  const sum = useMemo(() => (x?.s.quarter_id ? summarize(model, [x.s.quarter_id], x.s.quarter_id) : null), [model, x]);

  if (!x) return <main className="body"><p className="empty">הרחוב לא נמצא. חפשו אותו בשדה החיפוש למעלה.</p></main>;
  const q = x.s.quarter_id ? QMAP[x.s.quarter_id] : null;
  const rank = sum ? sum.streets.findIndex((y) => y.s.code === x.s.code) + 1 : 0;
  const prev = sum && rank > 1 ? sum.streets[rank - 2] : null;
  const next = sum && rank && rank < sum.streets.length ? sum.streets[rank] : null;
  const entering = new Set(model.entering.map((p) => p.key));
  const strongest = model.entering.filter((p) => x.scores[p.key] != null).sort((a, b) => x.scores[b.key]! - x.scores[a.key]!);
  const best = strongest[0], worst = strongest[strongest.length - 1];

  // כל המדדים שנוגעים ברחוב לפי ההצלבה, עם הניקוד שהרחוב צבר בהם
  const touched = [...new Set(Object.values(CROSS).flat())].map((id) => IND[id]).sort((a, b) => a.id.localeCompare(b.id));
  const plan = x.s.m.plan;
  const sel = open ? PARAMS.find((p) => p.key === open) : null;
  const story = streetStory(model, x);

  return (
    <main className="body" style={{ gridTemplateRows: 'auto minmax(0,1fr)' }}>
      <div className="street-head">
        <div>
          <p className="crumbs">
            <a href="#/">אשדוד</a> / {q ? <a href={`#/q/${q.id}?s=${x.s.code}`}>{q.name}</a> : 'בלי רובע'} / {x.s.name}
            {x.s.quarter_source === 'location' && <span className="muted"> · שיוך לרובע לפי מיקום</span>}
          </p>
          <h1 className="insight-line" style={{ fontSize: 'clamp(26px,3vw,38px)' }}>{x.s.name}</h1>
          {unranked(x.s.m) && <p className="tone tone-problem" style={{ margin: '4px 0' }}>{unranked(x.s.m)}</p>}
          {x.s.m.geo === 'trimmed' && <p className="src">לשם הרחוב נמצאו כמה קטעים בעיר. נמדד רק הקטע שבתוך הרובע.</p>}
          <Rich as="p" className="explain">{best && worst && best !== worst ? `==החוזקה: **${best.label}** (${fmtVal(best, x)}).== החולשה: **${worst.label}** (${fmtVal(worst, x)}, היעד ${worst.target}).` : 'אין מספיק מדידות לרחוב הזה.'}</Rich>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="score-big" style={{ background: scoreColor(x.total), color: textOn(x.total) }}>{x.total ?? '—'}</div>
            <Rich as="div" className="src">{`**${Math.round(x.points * 10) / 10}** מתוך **${model.maxPoints}** נקודות`}</Rich>
          </div>
          {sum && <div style={{ display: 'grid', gap: 4 }}>
            <Rich as="span" className="src">{`מקום **${rank}** מתוך **${sum.streets.length}**`}</Rich>
            <button className="press btn" disabled={!prev} onClick={() => prev && go(`#/s/${prev.s.code}`)} title={prev?.s.name}>הקודם בדירוג</button>
            <button className="press btn" disabled={!next} onClick={() => next && go(`#/s/${next.s.code}`)} title={next?.s.name}>הבא בדירוג</button>
          </div>}
        </div>
      </div>

      <div className="cols3">
        <section className="panel" aria-label="המדידות">
          <div className="panel-h"><h2>מה נמדד ברחוב</h2><span className="label">לחיצה על שורה: איך חושב</span></div>
          <div style={{ padding: '0 14px 8px' }}>
            {FAMILIES.map((f) => {
              const v = x.families[f.key];
              return <div key={f.key} className="fam" title={f.question}><span>{f.title}</span><span className="bar">{v != null && <i style={{ width: `${v * 100}%`, background: f.color }} />}</span><span className="v">{v == null ? '—' : Math.round(v * 100)}</span></div>;
            })}
          </div>
          <div className="scroll-in" style={{ flex: 1 }}>
            <table className="ptable">
              <thead><tr><th>פרמטר</th><th>ערך</th><th>יעד</th><th>ציון</th></tr></thead>
              <tbody>
                {PARAMS.map((p) => {
                  const s = x.scores[p.key];
                  const on = entering.has(p.key);
                  return (
                    <tr key={p.key} className={(on ? '' : 'off ') + (open === p.key ? 'sel' : '')} onClick={() => setOpen(open === p.key ? null : p.key)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(open === p.key ? null : p.key)}>
                      <td>{p.label}<div className="src">{CRIT[p.criterion].name}</div></td>
                      <td className="v">{fmtVal(p, x)}</td>
                      <td className="src">{p.target}</td>
                      <td>{on ? <span className="score-pill" style={{ display: 'inline-block', minWidth: 34, background: scoreColor(s == null ? null : s * 100), color: textOn(s == null ? null : s * 100) }}>{s == null ? '—' : Math.round(s * 100)}</span> : <span className="tag-out">לא בציון</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sel && (
            <div className="detail" aria-live="polite">
              <strong>{sel.label}</strong>
              <span><span className="label">איך חושב</span> {sel.rule}</span>
              <span><span className="label">על מה נשען</span> {sel.basis}</span>
              <span><span className="label">מגבלה</span> {sel.limit}</span>
              <span className="src">מקור: {sel.source} · כיסוי בעיר: {Math.round(model.stats[sel.key].coverage * 100)}%{entering.has(sel.key) ? '' : ', מתחת לסף, ולכן לא בציון'}</span>
            </div>
          )}
        </section>

        <section className="panel" aria-label="מדדי שכונה 360 ברחוב">
          <div className="panel-h"><h2>שכונה 360 ברחוב</h2><span className="label">נקודות שנצברו</span></div>
          <div className="scroll-in" style={{ flex: 1 }}>
            {touched.map((ind) => {
              const v = x.ind[ind.id];
              const on = v != null;
              return (
                <div key={ind.id} className={'ind-row' + (on ? '' : ' off')} title={ind.guidanceHe}>
                  <span className="id" style={{ color: CHAPTER_HEX[ind.chapter] }}>{ind.id.toUpperCase()}</span>
                  <span>{ind.titleHe}</span>
                  <span className="bar">{on && <i style={{ width: `${v * 100}%`, background: 'var(--measure)' }} />}</span>
                  <span className="pts">{on ? <><bdi className="num">{(Math.round(v * ind.maxScore * 10) / 10).toLocaleString('he-IL')}</bdi>/{ind.maxScore}</> : <>—/{ind.maxScore}</>}</span>
                </div>
              );
            })}
          </div>
          <p className="under src">פס מלא: נמדד. פס מקווקו: נוגע ברחוב ועוד לא נמדד. ריחוף על שורה: נוסח המדד בחוברת.</p>
        </section>

        <section className="panel" aria-label="הרחוב במפה ובהקשר">
          <div className="panel-h"><h2>הרחוב ברובע</h2></div>
          <div style={{ flex: 1, minHeight: 150, display: 'flex' }}>
            <StreetMap
              items={(sum?.streets ?? [x]).map((y) => ({ s: y.s, color: y.s.code === x.s.code ? scoreColor(x.total) : '#D9D8D3', label: y.s.code === x.s.code, weight: y.s.code === x.s.code ? 9 : 0, tip: `${y.s.name}: ${y.total}` }))}
              selected={x.s.code} onSelect={(c) => go(`#/s/${c}`)} label={`${x.s.name} ברובע`}
            />
          </div>
          <div className="pick street-acts" style={{ borderTop: '1px solid var(--rule)' }}>
            <h3 className="mini-h" style={{ margin: 0 }}>למה הציון הזה, ומה עושים</h3>
            {story.lines.map((l, i) => <Rich key={i} as="p">{l}</Rich>)}
            {story.acts.slice(0, 3).map((a) => (
              <div key={a.p.key} className={`tone ${TIERS[a.tier].tone}`}>
                <h4>{TIERS[a.tier].title} · {a.p.label}</h4>
                <p>{a.text}</p>
                <p className="src">{a.who} · עד {a.gap} נקודות</p>
              </div>
            ))}
          </div>
          <div className="pick" style={{ borderTop: '1px solid var(--rule)', borderBottom: 0 }}>
            {plan ? (
              <div className="tone tone-neutral">
                <h4>תוכנית בסביבה: {plan.title}</h4>
                <Rich as="p">{`${STATUS_HE[plan.status] ?? plan.status}${plan.number ? ` · ${plan.number}` : ''} · ציון שכונה 360: **${plan.points ?? 0}** מתוך **120**.`}</Rich>
                <a href="https://shchuna-360.vercel.app/" target="_blank" rel="noopener">לבדיקה בשער היעדים</a>
              </div>
            ) : <p className="src">אין תוכנית התחדשות במרחק 30 מ' מהרחוב, לפי "מה נבנה סביבי".</p>}
            {x.s.m.votes ? (
              <Rich as="p" className="src">{`קול התושבים: **${x.s.m.votes.n}** דירוגים, ממוצע **${(x.s.m.votes.avg * 2).toFixed(1)}** מתוך **10**. מתחת ל-10 דירוגים אין השוואה למדידה.`}</Rich>
            ) : <p className="src">אין עדיין דירוגי תושבים לרחוב הזה.</p>}
            <a className="press btn" style={{ textDecoration: 'none', textAlign: 'center' }} href="https://nicestreets-vercal.vercel.app/choose" target="_blank" rel="noopener">לדרג את הרחוב ברחובות טובים</a>
          </div>
        </section>
      </div>
    </main>
  );
}
