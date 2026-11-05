import { useState } from 'react';
import type { Model } from '../lib/model';
import { COVERAGE_MIN, PARAMS, crossTotals } from '../lib/model';
import { CRITERIA, CROSS, FAMILIES } from '../data/criteria';
import { CHAPTERS, CHAPTER_HEX, INDICATORS, TOTAL_MAX } from '../data/indicators';
import Rich from '../components/Rich';

export default function Cross({ model }: { model: Model }) {
  const [col, setCol] = useState<string | null>(null);
  const cross = crossTotals();
  const measuredBy = (crit: string, ind: string) => model.entering.some((p) => p.criterion === crit && p.indicators.includes(ind));
  const colInfo = col ? INDICATORS.find((i) => i.id === col) : null;
  const colCrit = col ? CRITERIA.filter((c) => CROSS[c.key]?.includes(col)) : [];

  return (
    <main className="body" style={{ gridTemplateRows: 'auto minmax(0,1fr)' }}>
      <div className="head">
        <div>
          <Rich as="h1" className="insight-line">{`==חצי מהניקוד של שכונה 360 נקבע ברחוב.==`}</Rich>
          <Rich as="p" className="explain">{`**${cross.touched.length}** מתוך **44** מדדים נוגעים בעקרונות הרחוב הטוב, ושווים **${cross.points}** מתוך **${TOTAL_MAX}** נקודות. היום נמדדים **${model.measuredInd.length}** מהם.`}</Rich>
        </div>
      </div>
      <div className="stage" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(300px,28%)' }}>
        <section className="panel" aria-label="מטריצת ההצלבה">
          <div className="panel-h"><h2>15 עקרונות × 44 מדדים</h2><span className="label">לחיצה על מדד: הסבר</span></div>
          <div className="key">
            <span><i style={{ background: 'var(--measure)' }} />נמדד ברחוב</span>
            <span><i style={{ background: 'repeating-linear-gradient(-45deg,#C9D6E8 0 3px,#fff 3px 6px)', outline: '1px solid #C9D6E8' }} />קשור, עוד לא נמדד</span>
            <span><i style={{ background: '#F4F4F1' }} />אין קשר</span>
            {CHAPTERS.map((c) => <span key={c}><i style={{ background: CHAPTER_HEX[c], height: 4 }} />{c}</span>)}
          </div>
          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr><th />{INDICATORS.map((i) => <th key={i.id} className={'colh' + (col === i.id ? ' hl' : '')} onClick={() => setCol(col === i.id ? null : i.id)} title={i.titleHe}>{i.titleHe.length > 22 ? i.titleHe.slice(0, 21) + '…' : i.titleHe}</th>)}</tr>
                <tr><th />{INDICATORS.map((i) => <td key={i.id} className="chap" style={{ background: CHAPTER_HEX[i.chapter] }} />)}</tr>
              </thead>
              <tbody>
                {FAMILIES.map((f) => [
                  <tr key={f.key} className="fam-h"><th colSpan={45} style={{ color: f.color }}>{f.title}: {f.question}</th></tr>,
                  ...CRITERIA.filter((c) => c.family === f.key).map((c) => (
                    <tr key={c.key}>
                      <th className="rowh" title={c.text}>{c.name}</th>
                      {INDICATORS.map((i) => {
                        const link = CROSS[c.key]?.includes(i.id);
                        const cls = link ? (measuredBy(c.key, i.id) ? 'on' : 'link') : 'none';
                        return <td key={i.id} className={cls + (col === i.id ? ' hl' : '')} title={`${c.name} × ${i.titleHe}`} onClick={() => setCol(i.id)} />;
                      })}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
          {colInfo ? (
            <div className="detail">
              <strong>{colInfo.id.toUpperCase()} {colInfo.titleHe} · {colInfo.maxScore} נקודות · עמ' {colInfo.page} בחוברת</strong>
              <span>{colInfo.guidanceHe}</span>
              <span className="src">{colCrit.length ? `נפגש עם: ${colCrit.map((c) => c.name).join(', ')}.` : 'שכונתי: לא נמדד ברמת רחוב.'}</span>
            </div>
          ) : <p className="under src">ההצלבה היא הצעה מקצועית של האפליקציה, לא טבלה מאחת החוברות. השורות מ"רחובות טובים באשדוד", הטורים מ"שכונה 360".</p>}
        </section>

        <aside className="panel" aria-label="אמינות">
          <div className="kpis">
            <div className="kpi"><div className="big">{cross.touched.length}/44</div><div className="sub">מדדים נוגעים ברחוב</div></div>
            <div className="kpi"><div className="big" style={{ color: 'var(--measure)' }}>{model.measuredInd.length}</div><div className="sub">נמדדים היום</div></div>
            <div className="kpi"><div className="big">{model.maxPoints}</div><div className="sub">נקודות מדודות מתוך 120</div></div>
          </div>
          <div className="panel-h"><h2>כמה מהעיר מכוסה בכל נתון</h2></div>
          <Rich as="p" className="src" >{`  פרמטר נכנס לציון רק כשיש לו ערך ביותר מ-**${Math.round(COVERAGE_MIN * 100)}%** מרחובות העיר. הקו המקווקו הוא הסף.`}</Rich>
          <div className="scroll-in" style={{ flex: 1, paddingTop: 6 }}>
            {[...PARAMS].sort((a, b) => model.stats[b.key].coverage - model.stats[a.key].coverage).map((p) => {
              const c = model.stats[p.key].coverage;
              return (
                <div key={p.key} className="cov" title={p.limit}>
                  <span>{p.label}</span>
                  <span className="bar"><i style={{ width: `${c * 100}%`, background: model.stats[p.key].enters ? 'var(--measure)' : 'var(--tick)' }} /><span className="thr" style={{ right: `${COVERAGE_MIN * 100}%` }} /></span>
                  <span className="v">{Math.round(c * 100)}%</span>
                </div>
              );
            })}
          </div>
          <div className="tone tone-insight" style={{ margin: 12 }}>
            <h4>הפער הגדול: העצים</h4>
            <p>רשת עצים וצל שווים 9 נקודות בשכונה 360, ורק מעט מהעצים באשדוד ממופים. סקר עצים עירוני יכניס אותם לציון אוטומטית.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
