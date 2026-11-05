import { useMemo } from 'react';
import type { Model, Scored } from '../lib/model';
import { PARAMS, crossTotals, scoreColor, summarize, textOn } from '../lib/model';
import { IND } from '../data/indicators';
import { QUARTERS } from '../data/quarters';
import { cityHeadline } from '../lib/insight';
import { go } from '../lib/route';
import Rich from '../components/Rich';

function Mini({ streets }: { streets: Scored[] }) {
  const d = useMemo(() => {
    const pts = streets.flatMap((x) => (x.s.line ?? []).flat());
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]).sort((a, b) => a - b), ys = pts.map((p) => p[1]).sort((a, b) => a - b);
    const q = (a: number[], f: number) => a[Math.round(f * (a.length - 1))];
    const t = pts.length > 40 ? 0.04 : 0;
    const [x0, x1, y0, y1] = [q(xs, t), q(xs, 1 - t), q(ys, t), q(ys, 1 - t)];
    const cos = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
    const W = Math.max((x1 - x0) * cos, 1e-4), H = Math.max(y1 - y0, 1e-4), S = 100 / Math.max(W, H);
    return {
      vb: `-6 -6 ${W * S + 12} ${H * S + 12}`,
      paths: streets.map((x) => ({ c: x.s.code, col: scoreColor(x.total), d: (x.s.line ?? []).map((l) => l.map(([lo, la], i) => `${i ? 'L' : 'M'}${((lo - x0) * cos * S).toFixed(1)} ${((y1 - la) * S).toFixed(1)}`).join('')).join('') })),
    };
  }, [streets]);
  if (!d) return <svg />;
  return (
    <svg viewBox={d.vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {d.paths.map((p) => <path key={p.c} d={p.d} fill="none" stroke={p.col} strokeWidth={2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

export default function Home({ model }: { model: Model }) {
  const head = cityHeadline(model);
  const city = useMemo(() => summarize(model, null), [model]);
  const quarters = useMemo(() => QUARTERS.map((q) => ({ q, sum: summarize(model, [q.id], q.id) })).filter((x) => x.sum.streets.length >= 3)
    .sort((a, b) => (b.sum.avg ?? 0) - (a.sum.avg ?? 0)), [model]);
  const resid = quarters.filter((x) => x.q.kind === 'quarter');
  const top = resid[0], low = resid[resid.length - 1];
  const cross = crossTotals();
  const cityWeak = city.weakParam;
  const out = PARAMS.filter((p) => !model.stats[p.key].enters);
  const outInd = [...new Set(out.flatMap((p) => p.indicators))].filter((id) => !model.measuredInd.includes(id));
  const outPts = outInd.reduce((a, id) => a + IND[id].maxScore, 0);

  return (
    <main className="body" style={{ gridTemplateRows: 'auto auto minmax(0,1fr)' }}>
      <div className="head">
        <div>
          <Rich as="h1" className="insight-line">{head.line}</Rich>
          <Rich as="p" className="explain">{head.explain}</Rich>
        </div>
      </div>

      <section className="answers" aria-label="שלוש התשובות של העיר">
        <button className="answer press" onClick={() => top && go(`#/q/${top.q.id}`)}>
          <span className="q">איזה רובע מוביל?</span>
          <span className="big">{top?.q.name}{top && <span className="score" style={{ background: scoreColor(top.sum.avg), color: textOn(top.sum.avg) }}>{top.sum.avg}</span>}</span>
          <span className="sub">ממוצע הרחובות הגבוה בעיר, מתוך {resid.length} רבעי מגורים.</span>
        </button>
        <button className="answer press" onClick={() => low && go(`#/q/${low.q.id}`)}>
          <span className="q">איזה רובע צריך הכי הרבה עזרה?</span>
          <span className="big">{low?.q.name}{low && <span className="score" style={{ background: scoreColor(low.sum.avg), color: textOn(low.sum.avg) }}>{low.sum.avg}</span>}</span>
          <span className="sub">{low?.sum.weakParam ? `החולשה העיקרית: ${low.sum.weakParam.p.label}.` : ''}</span>
        </button>
        <button className="answer press" onClick={() => go(`#/q/${low?.q.id ?? 'q-a'}?c=${cityWeak?.p.key ?? ''}`)}>
          <span className="q">מה הכי חסר בעיר?</span>
          <span className="big">{cityWeak?.p.label}{cityWeak && <span className="score" style={{ background: scoreColor(cityWeak.avg * 100), color: textOn(cityWeak.avg * 100) }}>{Math.round(cityWeak.avg * 100)}</span>}</span>
          <span className="sub">{cityWeak ? `חציון בעיר: ${cityWeak.value == null ? '—' : cityWeak.p.fmt(cityWeak.value, {})} ${cityWeak.p.unit}. היעד: ${cityWeak.p.target}.` : ''}</span>
        </button>
      </section>

      <div className="home">
        <section className="panel" aria-label="הרבעים">
          <div className="panel-h"><h2>כל רובע, מהחזק לחלש</h2><span className="label">כל קו הוא רחוב, בצבע הציון שלו</span></div>
          <div className="tiles">
            {quarters.map(({ q, sum }) => (
              <button key={q.id} className="tile press" onClick={() => go(`#/q/${q.id}`)} aria-label={`${q.name}, ממוצע ${sum.avg}`}>
                <span className="t-top"><span className="t-name">{q.name}</span><span className="t-score" style={{ color: scoreColor(sum.avg) }}>{sum.avg}</span></span>
                <Mini streets={sum.streets} />
                <span className="t-sub">{sum.streets.length} רחובות · מוביל: {sum.best?.s.name}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel" aria-label="איך נולד הציון">
          <div className="panel-h"><h2>איך נולד הציון</h2></div>
          <div className="flow">
            <div className="pair">
              <a className="src-card press" href="https://nicestreets-vercal.vercel.app/" target="_blank" rel="noopener">
                <span className="label">רחובות טובים באשדוד</span>
                <span className="big">15</span>
                <span className="sub">עקרונות: שלד, חתך, דופן, מרקם ואקלים, וחוויה מקומית</span>
              </a>
              <a className="src-card press" href="https://shchuna-360.vercel.app/" target="_blank" rel="noopener">
                <span className="label">שכונה 360: שער היעדים</span>
                <span className="big">44</span>
                <span className="sub">מדדים, 120 נקודות, בשלושה פרקים</span>
              </a>
            </div>
            <div className="arrow">↓ הצלבה: כל עיקרון נפגש עם המדדים שנוגעים בו</div>
            <div className="src-card">
              <span className="label">נוגעים ברחוב</span>
              <Rich as="span">{`**${cross.touched.length}** מדדים, **${cross.points}** נקודות.`}</Rich>
              <Rich as="span" className="sub">{`השאר שכונתיים: תהליך תכנון, דיור, אנרגיה ופסולת בנייה.`}</Rich>
            </div>
            <div className="arrow">↓ מדידה מנתונים פתוחים</div>
            <div className="src-card" style={{ borderColor: 'var(--measure)' }}>
              <span className="label">נמדדים היום</span>
              <Rich as="span">{`==**${model.measuredInd.length}** מדדים, **${model.maxPoints}** נקודות.==`}</Rich>
              <Rich as="span" className="sub">{`**${model.entering.length}** פרמטרים: בלוקים, בניינים, אופי הדרך, חצייה, אוטובוס, גנים, שירותים וחינוך.`}</Rich>
            </div>
            <div className="arrow">↓ ממוצע משוקלל לפי הנקודות של שכונה 360</div>
            <div className="src-card">
              <span className="label">ציון רחוב</span>
              <span>0 עד 100, ודירוג בתוך הרובע.</span>
            </div>
            <div className="tone tone-problem">
              <h4>מה עוד לא נמדד</h4>
              <Rich as="p">{`${out.map((p) => p.label).join(', ')}: ממופים בפחות מרבע מהרחובות, ושווים עוד **${outPts}** נקודות. הם מוצגים, ולא נכנסים לציון.`}</Rich>
            </div>
            <p className="src">השראה: <strong>Allan B. Jacobs</strong>, Great Streets, 1993: רחובות שנמדדו ושורטטו באותו קנה מידה כדי להשוות ביניהם.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
