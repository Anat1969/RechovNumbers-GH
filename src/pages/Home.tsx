import { useMemo } from 'react';
import type { Model, Scored } from '../lib/model';
import { PARAMS, crossTotals, scoreColor, textOn } from '../lib/model';
import { IND } from '../data/indicators';
import { cityHeadline, fmtVal } from '../lib/insight';
import { actionPlan, cityStory, streetStory } from '../lib/story';
import { CAN, GAPS, TIERS, type Tier } from '../lib/actions';
import { go } from '../lib/route';
import Rich from '../components/Rich';
import { MiniMap } from '../components/MiniMap';

function Bar({ v, color }: { v: number; color?: string }) {
  return <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color ?? scoreColor(v) }} /></span>;
}

function Histogram({ hist }: { hist: number[] }) {
  const max = Math.max(...hist, 1);
  return (
    <svg className="hist" viewBox="0 0 300 120" role="img" aria-label="התפלגות ציוני הרחובות" style={{ direction: 'ltr' }}>
      {hist.map((n, i) => {
        const h = (n / max) * 92;
        return (
          <g key={i}>
            <rect x={300 - (i + 1) * 30 + 3} y={100 - h} width={24} height={h} fill={scoreColor(i * 10 + 5)} />
            <text x={300 - i * 30 - 15} y={100 - h - 3} textAnchor="middle" className="hist-n">{n || ''}</text>
            <text x={300 - i * 30 - 15} y={114} textAnchor="middle" className="hist-x">{i * 10}</text>
          </g>
        );
      })}
      <line x1="0" x2="300" y1="100" y2="100" stroke="#1A1A18" strokeWidth="1" />
    </svg>
  );
}

function Compare({ model, a, b }: { model: Model; a: Scored; b: Scored }) {
  return (
    <div className="compare">
      <div className="cmp-h"><span /><button className="link-btn" onClick={() => go(`#/s/${a.s.code}`)}>{a.s.name} <bdi className="num">{a.total}</bdi></button><button className="link-btn" onClick={() => go(`#/s/${b.s.code}`)}>{b.s.name} <bdi className="num">{b.total}</bdi></button></div>
      {model.entering.map((p) => (
        <div key={p.key} className="cmp-row">
          <span>{p.label}</span>
          <span className="cmp-cell"><Bar v={(a.scores[p.key] ?? 0) * 100} /><small>{fmtVal(p, a)}</small></span>
          <span className="cmp-cell"><Bar v={(b.scores[p.key] ?? 0) * 100} /><small>{fmtVal(p, b)}</small></span>
        </div>
      ))}
    </div>
  );
}

export default function Home({ model }: { model: Model }) {
  const head = cityHeadline(model);
  const cs = useMemo(() => cityStory(model), [model]);
  const plan = useMemo(() => actionPlan(model, cs.city.streets), [model, cs]);
  const cross = crossTotals();
  // המיקרו: הרובע החלש, הרחוב החזק והחלש שלו
  const low = cs.low;
  const microA = low?.sum.best, microB = low?.sum.worst;
  const micro = microB ? streetStory(model, microB) : null;
  const out = PARAMS.filter((p) => !model.stats[p.key].enters);
  const outPts = [...new Set(out.flatMap((p) => p.indicators))].filter((id) => !model.measuredInd.includes(id)).reduce((a, id) => a + IND[id].maxScore, 0);
  const tiles = useMemo(() => cs.ranks.concat(), [cs]);

  return (
    <main className="body scroll home-page">
      <section className="hero">
        <div>
          <Rich as="h1" className="insight-line">{head.line}</Rich>
          <Rich as="p" className="explain">{head.explain}</Rich>
        </div>
      </section>

      <section className="band" aria-labelledby="q-h">
        <h2 id="q-h" className="band-h"><span className="label">רבעים</span>כל רובע במבט, מהחזק לחלש</h2>
        <div className="tiles">
          {tiles.map(({ id, name, sum }) => (
            <button key={id} className="tile press" onClick={() => go(`#/q/${id}`)} aria-label={`${name}, ממוצע ${sum.avg}`}>
              <span className="t-top"><span className="t-name">{name}</span><span className="t-score" style={{ color: scoreColor(sum.avg) }}>{sum.avg}</span></span>
              <MiniMap streets={sum.streets} />
              <span className="t-sub">{sum.streets.length} רחובות · מוביל: {sum.best?.s.name}</span>
            </button>
          ))}
        </div>
        <p className="src">כל קו הוא רחוב, בצבע הציון שלו: ירוק חזק, אדום חלש. לחיצה על רובע פותחת את המפה והדירוג שלו.</p>
      </section>

      <section className="band" aria-labelledby="how-h">
        <h2 id="how-h" className="band-h"><span className="label">שיטה</span>איך נולד הציון</h2>
        <div className="flow-row">
          <a className="src-card press" href="https://nicestreets-vercal.vercel.app/" target="_blank" rel="noopener"><span className="label">רחובות טובים באשדוד</span><span className="big">15</span><span className="sub">עקרונות</span></a>
          <span className="arrow">+</span>
          <a className="src-card press" href="https://shchuna-360.vercel.app/" target="_blank" rel="noopener"><span className="label">שכונה 360</span><span className="big">44</span><span className="sub">מדדים, 120 נקודות</span></a>
          <span className="arrow">→</span>
          <div className="src-card"><span className="label">נוגעים ברחוב</span><span className="big">{cross.touched.length}</span><span className="sub">{cross.points} נקודות</span></div>
          <span className="arrow">→</span>
          <div className="src-card" style={{ borderColor: 'var(--measure)' }}><span className="label">נמדדים היום</span><span className="big" style={{ color: 'var(--measure)' }}>{model.measuredInd.length}</span><span className="sub">{model.maxPoints} נקודות, {model.entering.length} פרמטרים</span></div>
          <span className="arrow">→</span>
          <div className="src-card"><span className="label">ציון רחוב</span><span className="big">0–100</span><span className="sub">משוקלל לפי שכונה 360</span></div>
        </div>
        <p className="src">השראה: <strong>Allan B. Jacobs</strong>, Great Streets, 1993: רחובות שנמדדו ושורטטו באותו קנה מידה, כדי להשוות ביניהם.</p>
      </section>
      <section className="band" aria-labelledby="ans-h">
        <h2 id="ans-h" className="band-h"><span className="label">תשובות</span>שלוש התשובות של העיר</h2>
        <div className="answers" aria-label="שלוש התשובות של העיר">
          <button className="answer press" onClick={() => cs.top && go(`#/q/${cs.top.id}`)}>
            <span className="q">איזה רובע מוביל?</span>
            <span className="big">{cs.top?.name}{cs.top && <span className="score" style={{ background: scoreColor(cs.top.sum.avg), color: textOn(cs.top.sum.avg) }}>{cs.top.sum.avg}</span>}</span>
            <span className="sub">ממוצע הרחובות הגבוה מתוך {cs.ranks.length} רבעי מגורים.</span>
          </button>
          <button className="answer press" onClick={() => low && go(`#/q/${low.id}`)}>
            <span className="q">איזה רובע צריך הכי הרבה עזרה?</span>
            <span className="big">{low?.name}{low && <span className="score" style={{ background: scoreColor(low.sum.avg), color: textOn(low.sum.avg) }}>{low.sum.avg}</span>}</span>
            <span className="sub">{low?.sum.weakParam ? `החולשה העיקרית: ${low.sum.weakParam.p.label}.` : ''}</span>
          </button>
          <button className="answer press" onClick={() => go('#/a')}>
            <span className="q">מה הכי חסר בעיר?</span>
            <span className="big">{cs.prof[0]?.p.label}<span className="score" style={{ background: scoreColor(cs.prof[0]?.score ?? 0), color: textOn(cs.prof[0]?.score ?? 0) }}>{cs.prof[0]?.score}</span></span>
            <span className="sub">רק {cs.prof[0]?.meet}% מהרחובות ביעד. לחיצה: תוכנית הפעולה.</span>
          </button>
        </div>
      </section>

      <section className="band" aria-labelledby="macro-h">
        <h2 id="macro-h" className="band-h"><span className="label">מקרו</span>איפה העיר חזקה, ואיפה היא נתקעת</h2>
        <div className="band-grid">
          <div className="card">
            <div className="prof-h"><span>פרמטר</span><span>ממוצע הציון</span><span>ביעד</span><span>רחוקים</span></div>
            {cs.prof.map((r) => (
              <button key={r.p.key} className="prof-row" onClick={() => go(`#/q/${low?.id ?? 'q-a'}?c=${r.p.key}`)} title={`היעד: ${r.p.target}`}>
                <span>{r.p.label}<small>{r.p.target}</small></span>
                <span className="prof-bar"><Bar v={r.score} /><bdi className="num">{r.score}</bdi></span>
                <bdi className="num ok">{r.meet}%</bdi>
                <bdi className="num bad">{r.far}%</bdi>
              </button>
            ))}
            <p className="src">ממוצע הציון של כל פרמטר ב-{cs.city.streets.length} רחובות. "ביעד": ציון מלא. "רחוקים": פחות מרבע מהיעד.</p>
          </div>
          <div className="card story">
            <h3 className="mini-h">התפלגות הציונים</h3>
            <Histogram hist={cs.hist} />
            <p className="src">כמה רחובות בכל טווח ציון, מ-0 (ימין) עד 100 (שמאל).</p>
            {cs.lines.map((l, i) => <Rich key={i} as="p">{l}</Rich>)}
          </div>
          <div className="card">
            <h3 className="mini-h">הרבעים, מהחזק לחלש</h3>
            <div className="qrank">
              {cs.ranks.map((r) => (
                <button key={r.id} className="qrank-row" onClick={() => go(`#/q/${r.id}`)}>
                  <span>{r.name}</span><Bar v={r.sum.avg ?? 0} /><bdi className="num">{r.sum.avg}</bdi>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {low && microA && microB && micro && (
        <section className="band" aria-labelledby="micro-h">
          <h2 id="micro-h" className="band-h"><span className="label">מיקרו</span>דוגמה אחת: שני רחובות ב{low.name}</h2>
          <div className="band-grid two">
            <div className="card">
              <Compare model={model} a={microA} b={microB} />
              <Rich as="p" className="lead" >{`==**${microA.s.name}** ו**${microB.s.name}** באותו רובע, ו-**${microA.total! - microB.total!}** נקודות ביניהם.== כך נראה הפער פרמטר אחר פרמטר.`}</Rich>
            </div>
            <div className="card">
              <h3 className="mini-h">מה עושים ב{microB.s.name}</h3>
              {micro.lines.map((l, i) => <Rich key={i} as="p">{l}</Rich>)}
              <div className="acts">
                {micro.acts.slice(0, 4).map((a) => (
                  <div key={a.p.key} className={`tone ${TIERS[a.tier].tone}`}>
                    <h4>{TIERS[a.tier].title} · {a.p.label}</h4>
                    <p>{a.text}</p>
                    <p className="src">{a.who}</p>
                  </div>
                ))}
              </div>
              <button className="press btn" onClick={() => go(`#/s/${microB.s.code}`)}>כל המדידות של {microB.s.name}</button>
            </div>
          </div>
        </section>
      )}

      <section className="band" aria-labelledby="act-h">
        <h2 id="act-h" className="band-h"><span className="label">פעולה</span>מה עושים בעיר, לפי סדר</h2>
        <div className="band-grid three">
          {(['now', 'think', 'plan'] as Tier[]).map((t) => (
            <div key={t} className={`card tier tier-${t}`}>
              <h3 className="mini-h">{TIERS[t].title}</h3>
              <p className="src">{TIERS[t].sub}</p>
              {plan.filter((r) => r.tier === t).map((r) => (
                <div key={r.p.key} className="tier-item">
                  <Rich as="strong">{`${r.p.label}: **${r.streets.length}** רחובות`}</Rich>
                  <span>{t === 'plan' ? r.guideline : r.existing}</span>
                </div>
              ))}
              {!plan.some((r) => r.tier === t) && <p className="muted">הפרמטרים שבשלב הזה ({t === 'now' ? 'עצים, ספסלים, תאורה' : '—'}) עוד לא נמדדים מספיק.</p>}
            </div>
          ))}
        </div>
        <button className="press btn" style={{ marginTop: 10 }} onClick={() => go('#/a')}>תוכנית הפעולה המלאה, לפי רובע</button>
      </section>

      <section className="band" aria-labelledby="gap-h">
        <h2 id="gap-h" className="band-h"><span className="label">אמינות</span>מה עוד לא נמדד, ואיך משלימים</h2>
        <div className="gaps">
          {GAPS.slice(0, 6).map((g) => (
            <div key={g.what} className="gap card">
              <span className={`can can-${g.can}`}>{CAN[g.can]}</span>
              <strong>{g.what}</strong>
              <span className="src">היום: {g.now}</span>
              <span>{g.source}</span>
            </div>
          ))}
        </div>
        <Rich as="p" className="lead">{`==**${outPts}** נקודות של שכונה 360 נוגעות ברחוב ועוד לא בציון.== ${out.map((p) => p.label).join(', ')} ממופים בפחות מרבע מהרחובות.`}</Rich>
        <button className="press btn" style={{ marginTop: 10 }} onClick={() => go('#/m')}>כל הפערים והבסיס של כל מדידה</button>
      </section>

    </main>
  );
}

