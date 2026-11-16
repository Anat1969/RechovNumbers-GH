import { useMemo } from 'react';
import type { Model, Scored } from '../lib/model';
import { PARAMS, PMAP, crossTotals, scoreColor } from '../lib/model';
import { IND } from '../data/indicators';
import { fmtVal } from '../lib/insight';
import { actionPlan, cityStory, streetStory } from '../lib/story';
import { CAN, GAPS, TIERS, type Tier } from '../lib/actions';
import { go, setParam, type Route } from '../lib/route';
import Rich from '../components/Rich';
import { MiniMap } from '../components/MiniMap';
import StreetMap, { type MapMark } from '../components/StreetMap';
import { Answer, Bar, ColorSelect, Histogram, Legend, Lines, ReadTabs, ScoreBadge } from '../components/Read';

const TABS = [['ins', 'תובנות'], ['act', 'מעשים'], ['qs', 'רבעים'], ['num', 'מספרים']] as const;

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

/** מרכז רובע: חציון הנקודות של הרחובות שלו, כדי שקטע רחוק לא יזיז את התווית. */
function center(streets: Scored[]): [number, number] | null {
  const pts = streets.flatMap((x) => (x.s.line ?? []).flat());
  if (!pts.length) return null;
  const m = (a: number[]) => a.sort((u, v) => u - v)[a.length >> 1];
  return [m(pts.map((p) => p[0])), m(pts.map((p) => p[1]))];
}

export default function Home({ model, route }: { model: Model; route: Route }) {
  const cs = useMemo(() => cityStory(model), [model]);
  const plan = useMemo(() => actionPlan(model, cs.city.streets), [model, cs]);
  const tab = route.q.get('t') ?? 'ins';
  const colorKey = route.q.get('c');
  const colorBy = colorKey && PMAP[colorKey] && model.entering.includes(PMAP[colorKey]) ? PMAP[colorKey] : null;
  const cross = crossTotals();
  const low = cs.low, top = cs.top;
  const microA = low?.sum.best, microB = low?.sum.worst;
  const micro = microB ? streetStory(model, microB) : null;
  const out = PARAMS.filter((p) => !model.stats[p.key].enters);
  const outPts = [...new Set(out.flatMap((p) => p.indicators))].filter((id) => !model.measuredInd.includes(id)).reduce((a, id) => a + IND[id].maxScore, 0);
  const weak = cs.prof[0];

  const items = useMemo(() => cs.city.streets.map((x) => {
    const v = colorBy ? x.scores[colorBy.key] : null;
    return {
      s: x.s, color: colorBy ? scoreColor(v == null ? null : v * 100) : scoreColor(x.total),
      tip: colorBy ? `${x.s.name}: ${fmtVal(colorBy, x)}` : `${x.s.name}: ${x.total}`,
    };
  }), [cs, colorBy]);
  const marks: MapMark[] = useMemo(() => cs.ranks.flatMap((r) => {
    const c = center(r.sum.streets);
    return c ? [{ key: r.id, lon: c[0], lat: c[1], title: r.name.replace('רובע ', ''), value: r.sum.avg, color: scoreColor(r.sum.avg), onClick: () => go(`#/q/${r.id}`) }] : [];
  }), [cs]);

  return (
    <main className="atlas">
      <header className="a-head">
        <p className="crumbs">אשדוד</p>
        <Rich as="h1" className="insight-line">{`==החסר הגדול של אשדוד: **${weak.p.label}**.==`}</Rich>
        <div className="a-kpi">
          <ScoreBadge v={cs.city.avg} sub={`ממוצע **${cs.city.streets.length}** רחובות`} />
          <div className="a-hist"><Histogram hist={cs.hist} small /><span className="src">כמה רחובות בכל ציון</span></div>
        </div>
      </header>

      <section className="a-map panel" aria-label="מפת העיר">
        <div className="panel-h">
          <h2>{colorBy ? `${colorBy.label} בכל רחוב בעיר` : 'הציון של כל רחוב בעיר'}</h2>
          <ColorSelect model={model} colorBy={colorBy} />
        </div>
        <StreetMap
          items={items} ground={false} thin={0.55} marks={marks} label="מפת הרחובות של אשדוד"
          onSelect={(code) => { const x = model.byCode[code]; if (x?.s.quarter_id) go(`#/q/${x.s.quarter_id}?s=${code}`); }}
          legend={<Legend title={colorBy ? `${colorBy.label}: ציון מול היעד` : 'ציון רחוב, 0 עד 100'} note="המספר ליד שם הרובע: הממוצע שלו. לחיצה נכנסת לרובע." />}
        />
      </section>

      <div className="a-body panel">
        <ReadTabs tabs={TABS} cur={tab} />
        <div className="a-pane">
          {tab === 'ins' && <>
            <div className="answers">
              <Answer kind="good" q="איזה רובע מוביל?" name={top?.name} score={top?.sum.avg} sub={`הממוצע הגבוה מתוך **${cs.ranks.length}** רבעי המגורים.`} onClick={() => top && go(`#/q/${top.id}`)} />
              <Answer kind="bad" q="איזה רובע צריך הכי הרבה עזרה?" name={low?.name} score={low?.sum.avg} sub={low?.sum.weakParam ? `החולשה העיקרית: **${low.sum.weakParam.p.label}**.` : ''} onClick={() => low && go(`#/q/${low.id}`)} />
              <Answer kind="gap" q="מה הכי חסר בעיר?" name={weak?.p.label} score={weak?.score} sub={`רק **${weak?.meet}%** מהרחובות ביעד. לחיצה צובעת את המפה.`} pressed={colorBy?.key === weak?.p.key} onClick={() => setParam('c', colorBy?.key === weak?.p.key ? null : weak.p.key)} />
            </div>
            <h3 className="mini-h">מה המספרים אומרים</h3>
            <Lines lines={cs.lines} />
            {low && microA && microB && micro && (
              <div className="tone tone-insight">
                <h4>דוגמה אחת: שני רחובות ב{low.name}</h4>
                <Rich as="p">{`**${microA.s.name}** (**${microA.total}**) ו**${microB.s.name}** (**${microB.total}**): **${microA.total! - microB.total!}** נקודות באותו רובע.`}</Rich>
                <button className="press btn" onClick={() => go(`#/s/${microB.s.code}`)}>מה עושים ב{microB.s.name}</button>
              </div>
            )}
          </>}

          {tab === 'act' && <>
            <Rich as="p" className="lead">{`==שלוש דרגות, לפי מה שאפשר לעשות מחר בבוקר.== הסדר בתוך כל דרגה: כמה נקודות אפשר להחזיר.`}</Rich>
            {(['now', 'think', 'plan'] as Tier[]).map((t) => {
              const rows = plan.filter((r) => r.tier === t);
              return (
                <div key={t} className={`tier tier-${t}`}>
                  <h3 className="mini-h">{TIERS[t].title}</h3>
                  <p className="src">{TIERS[t].sub}</p>
                  {rows.map((r) => (
                    <div key={r.p.key} className="tier-item">
                      <Rich as="strong">{`${r.p.label}: **${r.streets.length}** רחובות, **${r.stake}** נקודות`}</Rich>
                      <span>{t === 'plan' ? r.guideline : r.existing}</span>
                      <span className="src">אחראי: {r.who}</span>
                    </div>
                  ))}
                  {!rows.length && <p className="muted">הפרמטרים שבדרגה הזו ({t === 'now' ? 'עצים, ספסלים, תאורה' : '—'}) עוד לא נמדדים מספיק.</p>}
                </div>
              );
            })}
            <button className="press btn" onClick={() => go('#/a')}>תוכנית הפעולה המלאה, לפי רובע</button>
          </>}

          {tab === 'qs' && <>
            <p className="src">כל קו הוא רחוב, בצבע הציון שלו. מהחזק לחלש. לחיצה נכנסת לרובע.</p>
            <div className="tiles">
              {cs.ranks.map(({ id, name, sum }) => (
                <button key={id} className="tile press" onClick={() => go(`#/q/${id}`)} aria-label={`${name}, ממוצע ${sum.avg}`}>
                  <span className="t-top"><span className="t-name">{name}</span><span className="t-score" style={{ color: scoreColor(sum.avg) }}>{sum.avg}</span></span>
                  <MiniMap streets={sum.streets} />
                  <span className="t-sub">{sum.streets.length} רחובות · מוביל: {sum.best?.s.name}</span>
                </button>
              ))}
            </div>
          </>}

          {tab === 'num' && <>
            <h3 className="mini-h">איפה העיר חזקה, ואיפה היא נתקעת</h3>
            <div className="prof-h"><span>פרמטר</span><span>ממוצע הציון</span><span>ביעד</span><span>רחוקים</span></div>
            {cs.prof.map((r) => (
              <button key={r.p.key} className="prof-row" aria-pressed={colorBy?.key === r.p.key} onClick={() => setParam('c', colorBy?.key === r.p.key ? null : r.p.key)} title={`היעד: ${r.p.target}. לחיצה צובעת את המפה.`}>
                <span>{r.p.label}<small>{r.p.target}</small></span>
                <span className="prof-bar"><Bar v={r.score} /><bdi className="num">{r.score}</bdi></span>
                <bdi className="num ok">{r.meet}%</bdi>
                <bdi className="num bad">{r.far}%</bdi>
              </button>
            ))}
            <p className="src">"ביעד": ציון מלא. "רחוקים": פחות מרבע מהיעד. לחיצה על שורה צובעת את המפה.</p>

            <h3 className="mini-h">התפלגות הציונים</h3>
            <Histogram hist={cs.hist} />
            <p className="src">כמה רחובות בכל טווח ציון, מ-0 (ימין) עד 100 (שמאל).</p>

            {low && microA && microB && <>
              <h3 className="mini-h">מיקרו: שני רחובות ב{low.name}</h3>
              <Compare model={model} a={microA} b={microB} />
            </>}

            <h3 className="mini-h">איך נולד הציון</h3>
            <div className="flow-row">
              <a className="src-card press" href="https://nicestreets-vercal.vercel.app/" target="_blank" rel="noopener"><span className="label">רחובות טובים</span><span className="big">15</span><span className="sub">עקרונות</span></a>
              <a className="src-card press" href="https://shchuna-360.vercel.app/" target="_blank" rel="noopener"><span className="label">שכונה 360</span><span className="big">44</span><span className="sub">מדדים, 120 נקודות</span></a>
              <div className="src-card"><span className="label">נוגעים ברחוב</span><span className="big">{cross.touched.length}</span><span className="sub">{cross.points} נקודות</span></div>
              <div className="src-card measured"><span className="label">נמדדים היום</span><span className="big">{model.measuredInd.length}</span><span className="sub">{model.maxPoints} נקודות, {model.entering.length} פרמטרים</span></div>
            </div>

            <h3 className="mini-h">מה עוד לא נמדד</h3>
            <Rich as="p" className="lead">{`==**${outPts}** נקודות נוגעות ברחוב ועוד לא בציון.== ${out.map((p) => p.label).join(', ')} ממופים בפחות מרבע מהרחובות.`}</Rich>
            <div className="gaps">
              {GAPS.slice(0, 4).map((g) => (
                <div key={g.what} className="gap">
                  <span className={`can can-${g.can}`}>{CAN[g.can]}</span>
                  <strong>{g.what}</strong>
                  <span className="src">{g.source}</span>
                </div>
              ))}
            </div>
            <button className="press btn" onClick={() => go('#/m')}>כל הפערים והבסיס של כל מדידה</button>
            <p className="src">השראה: <strong>Allan B. Jacobs</strong>, Great Streets, 1993: רחובות שנמדדו ושורטטו באותו קנה מידה, כדי להשוות ביניהם.</p>
          </>}
        </div>
      </div>
    </main>
  );
}
