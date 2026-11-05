import type { Model } from '../lib/model';
import { COVERAGE_MIN, PARAMS, crossTotals } from '../lib/model';
import { CRITERIA, CROSS, FAMILIES, type Criterion } from '../data/criteria';
import { CHAPTERS, CHAPTER_HEX, CHAPTER_META, INDICATORS, TOPICS, TOTAL_MAX, type Indicator } from '../data/indicators';
import { setParam, type Route } from '../lib/route';
import Rich from '../components/Rich';

type View = 'matrix' | 'crit' | 'ind';
const VIEWS: [View, string][] = [['matrix', 'מטריצה'], ['crit', 'פירוק לפי עיקרון'], ['ind', 'פירוק לפי מדד']];
const CH_KEY: Record<string, string> = { a: CHAPTERS[0], b: CHAPTERS[1], c: CHAPTERS[2] };

export default function Cross({ model, route }: { model: Model; route: Route }) {
  const view = (route.q.get('v') as View) || 'matrix';
  const chKey = route.q.get('ch');
  const chapter = chKey ? CH_KEY[chKey] : null;
  const col = route.q.get('i');
  const row = route.q.get('r');
  const cross = crossTotals();
  const inds = INDICATORS.filter((i) => !chapter || i.chapter === chapter);
  /** איזה פרמטר מודד את המפגש הזה, אם בכלל. */
  const measuredBy = (crit: string, ind: string) => model.entering.filter((p) => p.criterion === crit && p.indicators.includes(ind));
  const partialBy = (crit: string, ind: string) => PARAMS.filter((p) => !model.stats[p.key].enters && p.criterion === crit && p.indicators.includes(ind));
  const critsOf = (ind: string) => CRITERIA.filter((c) => CROSS[c.key]?.includes(ind));
  const state = (crit: string, ind: string) => (!CROSS[crit]?.includes(ind) ? 'none' : measuredBy(crit, ind).length ? 'on' : 'link');

  const Key = () => (
    <div className="key">
      <span><i style={{ background: 'var(--measure)' }} />נמדד ברחוב</span>
      <span><i className="hatch" />קשור, עוד לא נמדד</span>
      <span><i style={{ background: '#F4F4F1' }} />אין קשר</span>
    </div>
  );

  const IndPill = ({ i, crit }: { i: Indicator; crit?: Criterion }) => {
    const st = crit ? state(crit.key, i.id) : critsOf(i.id).some((c) => measuredBy(c.key, i.id).length) ? 'on' : critsOf(i.id).length ? 'link' : 'none';
    const by = crit ? measuredBy(crit.key, i.id) : critsOf(i.id).flatMap((c) => measuredBy(c.key, i.id));
    const part = crit ? partialBy(crit.key, i.id) : [];
    return (
      <div className={`ind-pill st-${st}`}>
        <span className="ip-mark" style={{ background: st === 'on' ? 'var(--measure)' : undefined }} />
        <span className="ip-id" style={{ color: CHAPTER_HEX[i.chapter] }}>{i.id.toUpperCase()}</span>
        <span className="ip-title">{i.titleHe}</span>
        <bdi className="num ip-pts">{i.maxScore}</bdi>
        <span className="ip-by src">{by.length ? `נמדד: ${[...new Set(by.map((p) => p.label))].join(', ')}` : part.length ? `ממופה חלקית: ${part.map((p) => p.label).join(', ')}` : st === 'none' ? 'שכונתי' : 'לא נמדד'}</span>
      </div>
    );
  };

  return (
    <main className="body" style={{ gridTemplateRows: 'auto auto minmax(0,1fr)' }}>
      <div className="head">
        <div>
          <Rich as="h1" className="insight-line">{`==חצי מהניקוד של שכונה 360 נקבע ברחוב.==`}</Rich>
          <Rich as="p" className="explain">{`**${cross.touched.length}** מתוך **44** מדדים נוגעים בעקרונות הרחוב הטוב, ושווים **${cross.points}** מתוך **${TOTAL_MAX}** נקודות. היום נמדדים **${model.measuredInd.length}** מהם.`}</Rich>
        </div>
      </div>
      <div className="cross-bar">
        <div className="chips" role="group" aria-label="תצוגה">
          {VIEWS.map(([k, l]) => <button key={k} className="chip-t" aria-pressed={view === k} onClick={() => setParam('v', k === 'matrix' ? null : k)}>{l}</button>)}
        </div>
        <div className="chips" role="group" aria-label="פרק">
          {(['a', 'b', 'c'] as const).map((k) => (
            <button key={k} className="chip-t" aria-pressed={chKey === k} onClick={() => setParam('ch', chKey === k ? null : k)}>
              <span className="sw" style={{ background: CHAPTER_HEX[CH_KEY[k]] }} />{CHAPTER_META[CH_KEY[k]].letter}: {CH_KEY[k]}
            </button>
          ))}
          <button className="chip-t all" aria-pressed={!chKey} onClick={() => setParam('ch', null)}>כל 44</button>
        </div>
      </div>

      <div className="stage" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(300px,26%)' }}>
        <section className="panel" aria-label="ההצלבה">
          {view === 'matrix' && <>
            <div className="panel-h"><h2>{CRITERIA.length} עקרונות × {inds.length} מדדים</h2><span className="label">לחיצה על מדד או על עיקרון: פירוק</span></div>
            <Key />
            <div className="matrix-wrap">
              <table className={'matrix' + (inds.length <= 20 ? ' wide' : '')}>
                <thead>
                  <tr><th />{inds.map((i) => <th key={i.id} className={'colh' + (col === i.id ? ' hl' : '')} onClick={() => setParam('i', col === i.id ? null : i.id)} title={i.titleHe}>{i.titleHe}</th>)}</tr>
                  <tr><th />{inds.map((i) => <td key={i.id} className="chap" style={{ background: CHAPTER_HEX[i.chapter] }} />)}</tr>
                </thead>
                <tbody>
                  {FAMILIES.map((f) => [
                    <tr key={f.key} className="fam-h"><th colSpan={inds.length + 1} style={{ color: f.color }}>{f.title}: {f.question}</th></tr>,
                    ...CRITERIA.filter((c) => c.family === f.key).map((c) => (
                      <tr key={c.key} className={row === c.key ? 'hl-row' : ''}>
                        <th className="rowh" title={c.text} onClick={() => setParam('r', row === c.key ? null : c.key)}>{c.name}</th>
                        {inds.map((i) => <td key={i.id} className={state(c.key, i.id) + (col === i.id ? ' hl' : '')} title={`${c.name} × ${i.titleHe}`} onClick={() => setParam('i', i.id)} />)}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          </>}

          {view === 'crit' && <>
            <div className="panel-h"><h2>כל עיקרון והמדדים שהוא פוגש</h2><span className="label">מספר: נקודות בחוברת</span></div>
            <Key />
            <div className="scroll-in" style={{ flex: 1, padding: '0 14px 14px' }}>
              {FAMILIES.map((f) => (
                <div key={f.key} className="fam-block">
                  <h3 className="fam-title" style={{ borderColor: f.color }}><span style={{ color: f.color }}>{f.title}</span> {f.question}</h3>
                  <div className="crit-grid">
                    {CRITERIA.filter((c) => c.family === f.key).map((c) => {
                      const list = (CROSS[c.key] ?? []).map((id) => INDICATORS.find((i) => i.id === id)!).filter((i) => !chapter || i.chapter === chapter);
                      const pts = list.reduce((a, i) => a + i.maxScore, 0);
                      const on = list.filter((i) => measuredBy(c.key, i.id).length).reduce((a, i) => a + i.maxScore, 0);
                      return (
                        <article key={c.key} className={'crit-card' + (row === c.key ? ' sel' : '')}>
                          <div className="crit-top"><strong>{c.name}</strong><span className="crit-pts"><span className="bar"><i style={{ width: pts ? `${(on / pts) * 100}%` : 0, background: 'var(--measure)' }} /></span><bdi className="num">{on}/{pts}</bdi></span></div>
                          {list.length ? list.map((i) => <IndPill key={i.id} i={i} crit={c} />) : <p className="src">{chapter ? 'אין מדד מהפרק הזה.' : 'אין מדד מקביל בשכונה 360.'}</p>}
                          <p className="src">{c.text}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>}

          {view === 'ind' && <>
            <div className="panel-h"><h2>{inds.length} המדדים, לפי פרק ונושא</h2><span className="label">מספר: נקודות בחוברת</span></div>
            <Key />
            <div className="scroll-in" style={{ flex: 1, padding: '0 14px 14px' }}>
              {CHAPTERS.filter((c) => !chapter || c === chapter).map((ch) => (
                <div key={ch} className="fam-block">
                  <h3 className="fam-title" style={{ borderColor: CHAPTER_HEX[ch] }}><span style={{ color: CHAPTER_HEX[ch] }}>{CHAPTER_META[ch].letter}: {ch}</span> {CHAPTER_META[ch].question}</h3>
                  {TOPICS.filter((t) => INDICATORS.some((i) => i.topic === t && i.chapter === ch)).map((t) => (
                    <div key={t} className="topic-block">
                      <span className="label">{t}</span>
                      {INDICATORS.filter((i) => i.topic === t && i.chapter === ch).map((i) => (
                        <div key={i.id} className="ind-line">
                          <IndPill i={i} />
                          <div className="crit-tags">{critsOf(i.id).map((c) => <span key={c.key} className="ctag" style={{ borderColor: FAMILIES.find((f) => f.key === c.family)!.color }}>{c.name}</span>)}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>}
        </section>

        <aside className="panel" aria-label="פירוט ואמינות">
          {(() => {
            const i = col ? INDICATORS.find((x) => x.id === col) : null;
            const c = row ? CRITERIA.find((x) => x.key === row) : null;
            if (i) return (
              <div className="detail" style={{ borderTop: 0 }}>
                <span className="label" style={{ color: CHAPTER_HEX[i.chapter] }}>{i.id.toUpperCase()} · {i.chapter} · {i.topic}</span>
                <strong style={{ fontSize: 16 }}>{i.titleHe}</strong>
                <Rich as="span">{`**${i.maxScore}** נקודות · עמ' **${i.page}** בחוברת`}</Rich>
                <div className="crit-tags">{critsOf(i.id).map((x) => <span key={x.key} className="ctag">{x.name}</span>)}</div>
                <span>{i.guidanceHe}</span>
                <span className="src">{critsOf(i.id).length ? `נפגש עם ${critsOf(i.id).length} עקרונות.` : 'שכונתי: לא נמדד ברמת רחוב.'}</span>
                <button className="x-btn" style={{ justifySelf: 'start' }} onClick={() => setParam('i', null)} aria-label="סגירת הפירוט">×</button>
              </div>
            );
            if (c) return (
              <div className="detail" style={{ borderTop: 0 }}>
                <span className="label">{FAMILIES.find((f) => f.key === c.family)!.title}</span>
                <strong style={{ fontSize: 16 }}>{c.name}</strong>
                <span>{c.text}</span>
                {(CROSS[c.key] ?? []).map((id) => <IndPill key={id} i={INDICATORS.find((x) => x.id === id)!} crit={c} />)}
                <button className="x-btn" style={{ justifySelf: 'start' }} onClick={() => setParam('r', null)} aria-label="סגירת הפירוט">×</button>
              </div>
            );
            return null;
          })()}
          <div className="kpis">
            <div className="kpi"><div className="big">{cross.touched.length}/44</div><div className="sub">מדדים נוגעים ברחוב</div></div>
            <div className="kpi"><div className="big" style={{ color: 'var(--measure)' }}>{model.measuredInd.length}</div><div className="sub">נמדדים היום</div></div>
            <div className="kpi"><div className="big">{model.maxPoints}</div><div className="sub">נקודות מדודות מתוך 120</div></div>
          </div>
          <div className="panel-h"><h2>כמה מהעיר מכוסה בכל נתון</h2></div>
          <div className="scroll-in" style={{ flex: 1 }}>
            {[...PARAMS].sort((a, b) => model.stats[b.key].coverage - model.stats[a.key].coverage).map((p) => {
              const cv = model.stats[p.key].coverage;
              return (
                <div key={p.key} className="cov" title={p.limit}>
                  <span>{p.label}</span>
                  <span className="bar"><i style={{ width: `${cv * 100}%`, background: model.stats[p.key].enters ? 'var(--measure)' : 'var(--tick)' }} /><span className="thr" style={{ right: `${COVERAGE_MIN * 100}%` }} /></span>
                  <span className="v">{Math.round(cv * 100)}%</span>
                </div>
              );
            })}
          </div>
          <Rich as="p" className="src" >{`  הקו המקווקו: סף של **${Math.round(COVERAGE_MIN * 100)}%**. מתחתיו הנתון מוצג ולא נכנס לציון.`}</Rich>
        </aside>
      </div>
    </main>
  );
}
