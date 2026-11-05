import type { Model } from '../lib/model';
import { COVERAGE_MIN, PARAMS } from '../lib/model';
import { CRIT } from '../data/criteria';
import { IND } from '../data/indicators';
import Rich from '../components/Rich';
import { ACTIONS, BASIS, CAN, GAPS } from '../lib/actions';

export default function Method({ model, takenAt, source }: { model: Model; takenAt: string; source: string }) {
  const votes = model.streets.filter((x) => x.s.m.votes).length;
  const date = takenAt ? new Date(takenAt).toLocaleDateString('he-IL') : '—';
  return (
    <main className="body scroll">
      <div className="head">
        <div>
          <Rich as="h1" className="insight-line">{'==כל ציון מסביר את עצמו.=='}</Rich>
          <Rich as="p" className="explain">{`לכל פרמטר: מה נמדד, איך חושב, על מה נשען, ומה המגבלה. נתונים מ-**${date}**, ${source === 'live' ? 'חיים מהשרת' : 'מהתמונה השמורה'}.`}</Rich>
        </div>
      </div>

      <section className="prose card">
        <h2 className="section-title" style={{ marginTop: 0 }}>על מה הכלי נשען</h2>
        <Rich as="p">{'**שכונה 360°**: 44 מדדים לתכנון שכונה בת־קיימא, 120 נקודות, כפי שהם באפליקציה "שכונה 360: שער היעדים". המשקל של כל מדד בציון הרחוב הוא הניקוד שלו בחוברת.'}</Rich>
        <Rich as="p">{'**הרחובות הטובים: זיקוק הקריטריונים** (מינהל התכנון, 2026): 12 קריטריונים בארבע משפחות, ועוד 3 שאלות מקומיות של אשדוד, כפי שהם באפליקציה "רחובות טובים באשדוד". מהם נלקחו היעדים המספריים: בלוק עד 125 מ\' ו-3 עד 5 בניינים ל-100 מ\'.'}</Rich>
        <Rich as="p">{'**הנתונים**: OpenStreetMap (רישיון ODbL) לבניינים, לדרכים, לתחנות, לגנים ולשירותים. רשימת הרחובות הארצית וקווי הרחוב מ-ASHDODMAP. מוסדות החינוך מהשכבה העירונית. החישוב רץ ב-PostGIS, בהטלה הישראלית (EPSG:2039), בפונקציה rn_compute.'}</Rich>
        <h2 className="section-title">איך הכלי מודד את האמינות של עצמו</h2>
        <Rich as="p">{`==**כיסוי**: פרמטר נכנס לציון רק כשיש לו ערך ביותר מ-**${Math.round(COVERAGE_MIN * 100)}%** מרחובות העיר.== מתחת לסף, אפס הוא כנראה "לא מופה", ולא "אין". כשהמיפוי ישתפר, הפרמטר ייכנס לבד.`}</Rich>
        <Rich as="p">{`**הסכמה עם התושבים**: נמדדת כשיש לפחות 10 רחובות עם דירוג תושבים. היום יש **${votes}**, ולכן ההסכמה **לא נמדדה** עדיין.`}</Rich>
        <Rich as="p">{'**שכבות שקופות**: הציון והתובנות מחושבים בקוד. האבחון המזוקק נכתב במודל (Gemini, ו-Claude כגיבוי) ומסומן ככזה. ההחלטה נשארת אצל איש המקצוע.'}</Rich>
        <Rich as="p">{'**מה הכלי לא עושה**: לא מודד רוחב זכות דרך, יחס גובה לרוחב, מפגש מגרש־רחוב ושפה משותפת. אלה דורשים שכבות GIS עירוניות או סקר שטח.'}</Rich>
      </section>

      <h2 className="section-title">האם המדידה מבוססת? רמת הבסיס של כל יעד</h2>
      <div className="basis-key">
        {(['source', 'partial', 'proposed', 'relative'] as const).map((k) => (
          <div key={k} className="card"><span className={`basis basis-${k}`}>{BASIS[k].he}</span> <span>{BASIS[k].explain}</span>
            <div className="src">{PARAMS.filter((p) => ACTIONS[p.key].basis === k).map((p) => p.label).join(' · ')}</div></div>
        ))}
      </div>
      <Rich as="p" className="src">{'**מסקנה:** אורך בלוק ומקצב בניינים נשענים על מספרים מהמקור. אופי הדרך, מעברי החצייה והמרחק לתחנה הם יעדים מוצעים, וכדאי שהאגף יאשר או יתקן אותם. השינוי עובר אוטומטית לכל הציונים.'}</Rich>

      <h2 className="section-title">מה עוד לא נמדד: אפשר למדוד? מאיפה?</h2>
      <table className="ptable gaps-table">
        <thead><tr><th>מה חסר</th><th>היום</th><th>אפשר?</th><th>מאיפה</th><th>מה זה מוסיף</th></tr></thead>
        <tbody>
          {GAPS.map((g) => (
            <tr key={g.what}><td><strong>{g.what}</strong></td><td className="src">{g.now}</td><td><span className={`can can-${g.can}`}>{CAN[g.can]}</span></td><td>{g.source}</td><td className="src">{g.gain}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 className="section-title">הפרמטרים</h2>
      <div className="method">
        {PARAMS.map((p) => {
          const st = model.stats[p.key];
          return (
            <article key={p.key} className="card">
              <h3>{p.label}<span className={st.enters ? 'tag-in' : 'tag-out'}>{st.enters ? 'בציון' : 'לא בציון'} · כיסוי {Math.round(st.coverage * 100)}%</span></h3>
              <dl>
                <dt>עיקרון</dt><dd>{CRIT[p.criterion].name}</dd>
                <dt>מדדים</dt><dd>{p.indicators.map((i) => `${IND[i].titleHe} (${IND[i].maxScore})`).join(' · ')}</dd>
                <dt>יעד</dt><dd><strong>{p.target}</strong> <span className={`basis basis-${ACTIONS[p.key].basis}`} title={BASIS[ACTIONS[p.key].basis].explain}>{BASIS[ACTIONS[p.key].basis].he}</span></dd>
                <dt>איך חושב</dt><dd>{p.rule}</dd>
                <dt>נשען על</dt><dd>{p.basis}</dd>
                <dt>מקור</dt><dd className="src">{p.source}</dd>
                <dt>מגבלה</dt><dd>{p.limit}</dd>
              </dl>
            </article>
          );
        })}
      </div>
      <p className="src" style={{ padding: '16px 0' }}>
        האפליקציות שמהן נבנה הכלי: <a href="https://nicestreets-vercal.vercel.app/" target="_blank" rel="noopener">רחובות טובים באשדוד</a> (<a href="https://github.com/Anat1969/NiceStreets-GH" target="_blank" rel="noopener">קוד</a>)
        · <a href="https://shchuna-360.vercel.app/" target="_blank" rel="noopener">שכונה 360: שער היעדים</a> (<a href="https://github.com/Anat1969/pro-metrics-vue-GH" target="_blank" rel="noopener">קוד</a>)
        · הקוד של הכלי הזה: <a href="https://github.com/Anat1969/RechovNumbers-GH" target="_blank" rel="noopener">RechovNumbers-GH</a>
      </p>
    </main>
  );
}
