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
import { actionPlan, quarterStory } from '../lib/story';
import { TIERS } from '../lib/actions';

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
  const tab = (route.q.get('t') ?? 'rank') as 'rank' | 'story' | 'act';
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
    <>
      <main className="body" style={{ gridTemplateRows: 'auto auto minmax(0,1fr)' }}>
        <div className="head">
          <div>
            <p className="crumbs"><a href="#/">אשדוד</a> / {q.name}</p>
            <Rich as="h1" className="insight-line">{sum.best ? `==**${q.name}**: ${sum.streets.length} רחובות, ממוצע **${sum.avg}**.==` : `**${q.name}**`}</Rich>
          </div>
          <div className="chips" role="group" aria-label="בחירת רובע">
            {shown.filter((x) => x.kind === 'quarter').map((x) => (
              <button key={x.id} className="chip-t" aria-pressed={x.id === qid} title={`${x.name}: ${counts[x.id]} רחובות`} onClick={() => go(`#/q/${x.id}`)}>{x.short}</button>
            ))}
            {shown.filter((x) => x.kind === 'area').map((x) => (
              <button key={x.id} className="chip-t" aria-pressed={x.id === qid} title={`${x.name}: ${counts[x.id]} רחובות`} onClick={() => go(`#/q/${x.id}`)}>{x.short}</button>
            ))}
            <button className="chip-t all" onClick={() => go('#/')}>כל העיר</button>
          </div>
        </div>

        <section className="answers" aria-label="שלוש התשובות">
          <button className="answer press" aria-pressed={!!a.best && sel === sum.best?.s.code} onClick={() => sum.best && select(sum.best.s.code)} disabled={!a.best}>
            <span className="q">איזה רחוב הכי טוב בשכונה?</span>
            <span className="big">{a.best?.name ?? '—'}{a.best && <span className="score" style={{ background: scoreColor(a.best.score), color: textOn(a.best.score) }}>{a.best.score}</span>}</span>
            <span className="sub">{a.best?.sub}</span>
          </button>
          <button className="answer press" aria-pressed={!!a.worst && sel === sum.worst?.s.code} onClick={() => sum.worst && select(sum.worst.s.code)} disabled={!a.worst}>
            <span className="q">איזה רחוב צריך הכי הרבה עזרה?</span>
            <span className="big">{a.worst?.name ?? '—'}{a.worst && <span className="score" style={{ background: scoreColor(a.worst.score), color: textOn(a.worst.score) }}>{a.worst.score}</span>}</span>
            <span className="sub"><Rich>{a.worst?.sub ?? ''}</Rich></span>
          </button>
          <button className="answer press" aria-pressed={!!sum.weakParam && colorBy?.key === sum.weakParam.p.key} onClick={() => sum.weakParam && setParam('c', colorBy?.key === sum.weakParam.p.key ? null : sum.weakParam.p.key)} disabled={!a.weak}>
            <span className="q">מה הכי חסר בשכונה?</span>
            <span className="big">{a.weak?.name ?? '—'}{a.weak && <span className="score" style={{ background: scoreColor(a.weak.score), color: textOn(a.weak.score) }}>{a.weak.score}</span>}</span>
            <span className="sub"><Rich>{a.weak?.sub ?? ''}</Rich></span>
          </button>
        </section>

        <div className="stage">
          <section className="panel" aria-label="מפה">
            <div className="panel-h">
              <h2>{colorBy ? `${colorBy.label} בכל רחוב` : 'הציון של כל רחוב'}</h2>
              <span className="label">לחיצה על רחוב בוחרת אותו · גלגלת לזום</span>
            </div>
            <StreetMap
              items={items} context={model.streets.filter((x) => x.s.quarter_id !== qid).map((x) => x.s)} selected={sel} onSelect={select}
              label={`מפת הרחובות של ${q.name}`}
              legend={<>
                <span>{colorBy ? `${colorBy.label}: ציון מול היעד` : 'ציון רחוב, 0 עד 100'}</span>
                <span className="ramp" />
                <span className="ticks"><span>0 חלש</span><span>25</span><span>50</span><span>75</span><span>100 חזק</span></span>
                <span className="muted">קו לבן: רחוב ברובע שכן · אפור: בניין · ירוק: גן · עובי הקו: סוג הדרך</span>
              </>}
            />
            <Rich as="p" className="under">{underMap(sum, q.name, colorBy)}</Rich>
          </section>

          <aside className="panel" aria-label="דירוג">
            {ai.state !== 'idle' && (
              <div className="ai-box" aria-live="polite">
                <div className="panel-h" style={{ padding: 0 }}>
                  <h2>אבחון מזוקק</h2>
                  <button className="x-btn" aria-label="סגירת האבחון" onClick={() => setAi({ state: 'idle' })}>×</button>
                </div>
                {ai.state === 'busy' && <p className="muted">המודל קורא את המספרים של {q.name}...</p>}
                {ai.state === 'error' && <p className="tone tone-problem" style={{ margin: 0 }}>המודל לא זמין כרגע ({ai.err}). התובנות המחושבות שמתחת למפה ובשלוש התשובות נשארות תקפות.</p>}
                {ai.out && <>
                  <div className="tone tone-insight"><h4>מה המספרים אומרים</h4><Rich as="p">{ai.out.diagnosis}</Rich></div>
                  <div className="tone tone-problem"><h4>הפרמטר שיזיז הכי הרבה</h4><Rich as="p">{ai.out.lever}</Rich></div>
                  <div className="tone tone-solution"><h4>פעולה אחת לעירייה</h4><Rich as="p">{ai.out.action}</Rich></div>
                  <span className="layer">נוסח: מודל ({ai.out.provider === 'gemini' ? 'Gemini' : 'Claude'}) · המספרים: מחושבים בקוד · ההחלטה: איש המקצוע</span>
                </>}
              </div>
            )}
            {picked && (
              <div className="pick">
                <div className="panel-h" style={{ padding: 0 }}>
                  <h3>{picked.s.name}</h3>
                  <button className="x-btn" aria-label="ביטול הבחירה" onClick={() => select(null)}>×</button>
                </div>
                <Rich as="span" className="src">{`מקום **${rankOf(picked.s.code) || '—'}** מתוך **${sum.streets.length}** · ציון **${picked.total ?? '—'}** · **${Math.round(picked.points * 10) / 10}** מתוך **${model.maxPoints}** נקודות`}</Rich>
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
            <div className="side-tabs" role="tablist" aria-label="תצוגת הטור">
              {([['rank', 'דירוג'], ['story', 'ממצאים'], ['act', 'פעולות']] as const).map(([k, l]) => (
                <button key={k} role="tab" className="chip-t" aria-pressed={tab === k} aria-selected={tab === k} onClick={() => setParam('t', k === 'rank' ? null : k)}>{l}</button>
              ))}
            </div>
            {tab === 'rank' && <div className="rank" role="list">
              {sum.streets.length ? sum.streets.map((x, i) => (
                <button key={x.s.code} className="row" role="listitem" aria-pressed={sel === x.s.code} onClick={() => select(x.s.code)} onDoubleClick={() => go(`#/s/${x.s.code}`)}>
                  <span className="i">{i + 1}</span>
                  <span className="n">{x.s.name}</span>
                  <span className="bar"><i style={{ width: `${x.total}%`, background: scoreColor(x.total) }} /></span>
                  <span className="score-pill" style={{ background: scoreColor(x.total), color: textOn(x.total) }}>{x.total}</span>
                </button>
              )) : <p className="empty">ברובע הזה אין עדיין רחובות מדודים.<br />בחרו רובע אחר בשורה למעלה.</p>}
            </div>}
            {tab === 'story' && (
              <div className="rank side-story">
                {story.lines.map((l, i) => <Rich key={i} as="p">{l}</Rich>)}
                <h3 className="mini-h">הרובע מול העיר</h3>
                {story.rel.map((r) => (
                  <button key={r.p.key} className="rel-row" onClick={() => setParam('c', r.p.key)} title="לחיצה צובעת את המפה לפי הפרמטר">
                    <span>{r.p.label}</span>
                    <span className="rel-bars"><span className="bar"><i style={{ width: `${r.q}%`, background: scoreColor(r.q) }} /></span><span className="bar city"><i style={{ width: `${r.c}%` }} /></span></span>
                    <bdi className={'num ' + (r.d >= 0 ? 'ok' : 'bad')}>{r.d >= 0 ? '+' : ''}{r.d}</bdi>
                  </button>
                ))}
                <p className="src">פס צבעוני: הרובע. פס אפור: העיר. המספר: ההפרש.</p>
              </div>
            )}
            {tab === 'act' && (
              <div className="rank side-story">
                {plan.length ? plan.map((r) => (
                  <div key={r.p.key} className={`tone ${TIERS[r.tier].tone}`}>
                    <h4>{TIERS[r.tier].title} · {r.p.label}</h4>
                    <Rich as="p">{`**${r.streets.length}** רחובות, **${r.stake}** נקודות. ${r.existing}`}</Rich>
                    <p className="src">{r.streets.slice(0, 5).map((x) => x.s.name).join(' · ')}</p>
                  </div>
                )) : <p className="muted">אין ברובע פרמטר מתחת למחצית היעד.</p>}
                <button className="press btn" onClick={() => go(`#/a?q=${qid}`)}>תוכנית הפעולה של {q.name}</button>
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="dock" aria-label="סרגל פעולות">
        <div className="dock-in">
          <span className="label">צבע המפה לפי</span>
          <div className="chips" role="group" aria-label="צבע המפה לפי">
            <button className="chip-t" aria-pressed={!colorBy} onClick={() => setParam('c', null)}>ציון כולל</button>
            {model.entering.map((p) => (
              <button key={p.key} className="chip-t" aria-pressed={colorBy?.key === p.key} onClick={() => setParam('c', colorBy?.key === p.key ? null : p.key)}>{p.label}</button>
            ))}
          </div>
          <button className="press btn" onClick={runAi} disabled={ai.state === 'busy' || !sum.streets.length}>{ai.state === 'busy' ? 'מזקק...' : 'אבחון מזוקק'}</button>
        </div>
      </footer>
    </>
  );
}
