import { useEffect, useMemo, useState } from 'react';
import type { Model } from '../lib/model';
import { PMAP, scoreColor, summarize, textOn } from '../lib/model';
import { QUARTERS, QMAP } from '../data/quarters';
import { FAMILIES } from '../data/criteria';
import { answers, distillPayload, fmtVal, underMap } from '../lib/insight';
import { distill, type Distilled } from '../lib/data';
import { go, setParam, type Route } from '../lib/route';
import StreetMap from '../components/StreetMap';
import Rich from '../components/Rich';
import { actionPlan, quarterRanks, quarterStory } from '../lib/story';
import { TIERS, type Tier } from '../lib/actions';
import { GroupSketch, StreetGallery, StreetInQuarter } from '../components/Sketch';
import { Answer, ColorSelect, Histogram, Legend, Lines, ReadTabs, ScoreBadge, histOf } from '../components/Read';

const TABS = [['ins', 'תובנות'], ['act', 'מעשים'], ['rank', 'דירוג'], ['num', 'מספרים']] as const;

export default function Quarter({ model, route }: { model: Model; route: Route }) {
  const qid = route.id && QMAP[route.id] ? route.id : 'q-a';
  const q = QMAP[qid];
  const sel = route.q.get('s') ? Number(route.q.get('s')) : null;
  const colorKey = route.q.get('c');
  const colorBy = colorKey && PMAP[colorKey] && model.entering.includes(PMAP[colorKey]) ? PMAP[colorKey] : null;
  const [ai, setAi] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; out?: Distilled; err?: string }>({ state: 'idle' });

  useEffect(() => { try { localStorage.setItem('rn-last-q', qid); } catch { /* פרטי */ } setAi({ state: 'idle' }); }, [qid]);

  const sum = useMemo(() => summarize(model, [qid], qid), [model, qid]);
  const story = useMemo(() => quarterStory(model, qid), [model, qid]);
  const plan = useMemo(() => actionPlan(model, sum.streets), [model, sum]);
  const ranks = useMemo(() => quarterRanks(model), [model]);
  const place = ranks.findIndex((r) => r.id === qid) + 1;
  const tab = TABS.find(([k]) => k === route.q.get('t'))?.[0] ?? 'ins';
  const counts = useMemo(() => Object.fromEntries(QUARTERS.map((x) => [x.id, model.streets.filter((s) => s.s.quarter_id === x.id && s.total != null).length])), [model]);
  const a = answers(sum, q.name);
  const picked = sel != null ? model.byCode[sel] : null;
  const rankOf = (code: number) => sum.streets.findIndex((x) => x.s.code === code) + 1;

  const colorOf = (x: (typeof sum.streets)[number]) => {
    if (!colorBy) return scoreColor(x.total);
    const s = x.scores[colorBy.key];
    return scoreColor(s == null ? null : s * 100);
  };
  const labelSet = new Set([...sum.streets.slice(0, 4), ...sum.streets.slice(-4)].map((x) => x.s.code).concat(sel != null ? [sel] : []));
  const items = sum.streets.map((x, i) => ({
    s: x.s, color: colorOf(x), label: labelSet.has(x.s.code), weight: x.s.code === sel ? 99 : sum.streets.length - Math.min(i, sum.streets.length - 1 - i),
    tip: colorBy ? `${x.s.name}: ${fmtVal(colorBy, x)}` : `${x.s.name}: ${x.total}`,
  }));
  const select = (code: number | null) => setParam('s', code == null || code === sel ? null : String(code));

  const runAi = async () => {
    setAi({ state: 'busy' });
    try { setAi({ state: 'done', out: await distill(distillPayload(sum, q.name, model)) }); }
    catch (e) { setAi({ state: 'error', err: String((e as Error).message) }); }
  };

  const shown = QUARTERS.filter((x) => counts[x.id] > 0);
  return (
    <main className="atlas">
      <header className="a-head">
        <div className="crumbs-row">
          <p className="crumbs"><a href="#/">אשדוד</a> / {q.name}</p>
          <select className="field q-sel" value={qid} onChange={(e) => go(`#/q/${e.target.value}`)} aria-label="בחירת רובע">
            <optgroup label="רבעים">{shown.filter((x) => x.kind === 'quarter').map((x) => <option key={x.id} value={x.id}>{x.name} ({counts[x.id]})</option>)}</optgroup>
            <optgroup label="אזורים">{shown.filter((x) => x.kind === 'area').map((x) => <option key={x.id} value={x.id}>{x.name} ({counts[x.id]})</option>)}</optgroup>
          </select>
        </div>
        <Rich as="h1" className="insight-line">{sum.best ? (sum.weakParam ? `==${q.name}: החסר הגדול הוא **${sum.weakParam.p.label}**.==` : `==**${q.name}**==`) : `**${q.name}**`}</Rich>
        {sum.streets.length > 0 && (
          <div className="a-kpi">
            <ScoreBadge v={sum.avg} sub={`ממוצע **${sum.streets.length}** רחובות${place ? ` · מקום **${place}** מתוך **${ranks.length}** רבעים` : ''}`} />
            <div className="a-hist"><Histogram hist={histOf(sum.streets.map((x) => x.total!))} small /><span className="src">כמה רחובות בכל ציון</span></div>
          </div>
        )}
      </header>

      <section className="a-map panel" aria-label="מפה">
        <div className="panel-h">
          <h2>{colorBy ? `${colorBy.label} בכל רחוב` : 'הציון של כל רחוב'}</h2>
          <ColorSelect model={model} colorBy={colorBy} />
        </div>
        <StreetMap
          items={items} context={model.streets.filter((x) => x.s.quarter_id !== qid).map((x) => x.s)} selected={sel} onSelect={select}
          label={`מפת הרחובות של ${q.name}`}
          legend={<Legend title={colorBy ? `${colorBy.label}: ציון מול היעד` : 'ציון רחוב, 0 עד 100'} note="קו לבן: רובע שכן · אפור: בניין · ירוק: גן · עובי: סוג הדרך" />}
        />
        <Rich as="p" className="under">{underMap(sum, q.name, colorBy)}</Rich>
      </section>

      <div className="a-body panel">
        {picked && (
          <div className="pick">
            <div className="pick-h">
              <h3>{picked.s.name} <span className="score-pill" style={{ background: scoreColor(picked.total), color: textOn(picked.total) }}>{picked.total ?? '—'}</span></h3>
              <button className="x-btn" aria-label="ביטול הבחירה" onClick={() => select(null)}>×</button>
            </div>
            <Rich as="span" className="src">{`מקום **${rankOf(picked.s.code) || '—'}** מתוך **${sum.streets.length}** · **${Math.round(picked.points * 10) / 10}** מתוך **${model.maxPoints}** נקודות`}</Rich>
            {FAMILIES.map((f) => {
              const v = picked.families[f.key];
              return (
                <div key={f.key} className="fam" title={f.question}>
                  <span>{f.title}</span>
                  <span className="bar">{v != null && <i style={{ width: `${v * 100}%`, background: f.color }} />}</span>
                  <span className="v">{v == null ? 'לא נמדד' : Math.round(v * 100)}</span>
                </div>
              );
            })}
            <button className="press btn" onClick={() => go(`#/s/${picked.s.code}`)}>כל המדידות של הרחוב</button>
          </div>
        )}
        <ReadTabs tabs={TABS} cur={tab} />
        <div className="a-pane">
          {tab === 'ins' && <>
            {sum.streets.length ? <div className="answers">
              <Answer kind="good" q="איזה רחוב הכי טוב בשכונה?" name={a.best?.name} score={a.best?.score} sub={a.best?.sub} pressed={!!a.best && sel === sum.best?.s.code} onClick={() => sum.best && select(sum.best.s.code)} art={sum.best && <StreetInQuarter x={sum.best} quarter={sum.streets} />} />
              <Answer kind="bad" q="איזה רחוב צריך הכי הרבה עזרה?" name={a.worst?.name} score={a.worst?.score} sub={a.worst?.sub} pressed={!!a.worst && sel === sum.worst?.s.code} onClick={() => sum.worst && select(sum.worst.s.code)} art={sum.worst && <StreetInQuarter x={sum.worst} quarter={sum.streets} />} />
              <Answer kind="gap" q="מה הכי חסר בשכונה?" name={a.weak?.name} score={a.weak?.score} sub={a.weak?.sub} pressed={!!sum.weakParam && colorBy?.key === sum.weakParam.p.key} onClick={() => sum.weakParam && setParam('c', colorBy?.key === sum.weakParam.p.key ? null : sum.weakParam.p.key)} art={sum.weakParam && <GroupSketch streets={sum.streets} by={sum.weakParam.p.key} />} />
            </div> : <p className="empty">ברובע הזה אין עדיין רחובות מדודים. בחרו רובע אחר.</p>}
            {sum.streets.length > 0 && <>
              <h3 className="mini-h">{`${sum.streets.length} הרחובות, באותו קנה מידה`}</h3>
              <StreetGallery streets={sum.streets} sel={sel} onSelect={select} />
            </>}
            <h3 className="mini-h">מה המספרים אומרים</h3>
            <Lines lines={story.lines} />
            {ai.state === 'idle' && sum.streets.length > 0 && <button className="press btn" onClick={runAi}>אבחון מזוקק</button>}
            {ai.state !== 'idle' && (
              <div className="ai-box" aria-live="polite">
                <div className="pick-h">
                  <h3 className="mini-h">אבחון מזוקק</h3>
                  <button className="x-btn" aria-label="סגירת האבחון" onClick={() => setAi({ state: 'idle' })}>×</button>
                </div>
                {ai.state === 'busy' && <p className="muted">המודל קורא את המספרים של {q.name}...</p>}
                {ai.state === 'error' && <p className="tone tone-problem" style={{ margin: 0 }}>המודל לא זמין כרגע ({ai.err}). התובנות המחושבות שלמעלה נשארות תקפות.</p>}
                {ai.out && <>
                  <div className="tone tone-insight"><h4>מה המספרים אומרים</h4><Rich as="p">{ai.out.diagnosis}</Rich></div>
                  <div className="tone tone-problem"><h4>הפרמטר שיזיז הכי הרבה</h4><Rich as="p">{ai.out.lever}</Rich></div>
                  <div className="tone tone-solution"><h4>פעולה אחת לעירייה</h4><Rich as="p">{ai.out.action}</Rich></div>
                  <span className="layer">נוסח: מודל ({ai.out.provider === 'gemini' ? 'Gemini' : 'Claude'}) · המספרים: מחושבים בקוד · ההחלטה: איש המקצוע</span>
                </>}
              </div>
            )}
          </>}

          {tab === 'act' && <>
            {plan.length ? (['now', 'think', 'plan'] as Tier[]).map((t) => {
              const rows = plan.filter((r) => r.tier === t);
              if (!rows.length) return null;
              return (
                <div key={t} className={`tier tier-${t}`}>
                  <h3 className="mini-h">{TIERS[t].title}</h3>
                  {rows.map((r) => (
                    <div key={r.p.key} className="tier-item has-art">
                      <span className="art"><GroupSketch streets={sum.streets} hl={new Set(r.streets.map((x) => x.s.code))} label={`איפה: ${r.p.label}`} /></span>
                      <Rich as="strong">{`${r.p.label}: **${r.streets.length}** רחובות, **${r.stake}** נקודות`}</Rich>
                      <span>{t === 'plan' ? r.guideline : r.existing}</span>
                      <div className="street-chips">
                        {r.streets.slice(0, 6).map((x) => <button key={x.s.code} className="chip-s" onClick={() => select(x.s.code)}>{x.s.name}</button>)}
                        {r.streets.length > 6 && <span className="src">ועוד {r.streets.length - 6}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }) : <p className="muted">אין ברובע פרמטר מתחת למחצית היעד.</p>}
            <button className="press btn" onClick={() => go(`#/a?q=${qid}`)}>תוכנית הפעולה של {q.name}</button>
          </>}

          {tab === 'rank' && <div className="rank" role="list">
            {sum.streets.length ? sum.streets.map((x, i) => (
              <button key={x.s.code} className="row" role="listitem" aria-pressed={sel === x.s.code} onClick={() => select(x.s.code)} onDoubleClick={() => go(`#/s/${x.s.code}`)}>
                <span className="i">{i + 1}</span>
                <span className="n">{x.s.name}</span>
                <span className="bar"><i style={{ width: `${x.total}%`, background: scoreColor(x.total) }} /></span>
                <span className="score-pill" style={{ background: scoreColor(x.total), color: textOn(x.total) }}>{x.total}</span>
              </button>
            )) : <p className="empty">ברובע הזה אין עדיין רחובות מדודים.</p>}
          </div>}

          {tab === 'num' && <>
            <h3 className="mini-h">הרובע מול העיר</h3>
            {story.rel.map((r) => (
              <button key={r.p.key} className="rel-row" aria-pressed={colorBy?.key === r.p.key} onClick={() => setParam('c', colorBy?.key === r.p.key ? null : r.p.key)} title="לחיצה צובעת את המפה לפי הפרמטר">
                <span>{r.p.label}</span>
                <span className="rel-bars"><span className="bar"><i style={{ width: `${r.q}%`, background: scoreColor(r.q) }} /></span><span className="bar city"><i style={{ width: `${r.c}%` }} /></span></span>
                <bdi className={'num ' + (r.d >= 0 ? 'ok' : 'bad')}>{r.d >= 0 ? '+' : ''}{r.d}</bdi>
              </button>
            ))}
            <p className="src">פס צבעוני: הרובע. פס אפור: העיר. המספר: ההפרש. לחיצה צובעת את המפה.</p>
          </>}
        </div>
      </div>
    </main>
  );
}
