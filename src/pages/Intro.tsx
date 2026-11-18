import { useMemo } from 'react';
import type { Model } from '../lib/model';
import { scoreColor } from '../lib/model';
import { cityStory } from '../lib/story';
import { go } from '../lib/route';
import Icon from '../components/Icon';
import Rich from '../components/Rich';

/** דף הפתיחה: סרטון גדול משמאל, חזון מטרה וכלי מימין, ושלוש תובנות מהנתונים. כל השאר בדפים הבאים. */
export default function Intro({ model }: { model: Model }) {
  const cs = useMemo(() => cityStory(model), [model]);
  const n = cs.city.streets.length, total = model.streets.length;
  const weak = cs.prof[0], top = cs.top, low = cs.low;
  const gap = top && low && top.sum.avg != null && low.sum.avg != null ? top.sum.avg - low.sum.avg : null;

  return (
    <main className="body scroll intro">
      <header className="intro-head">
        <p className="crumbs">פתיחה</p>
        <Rich as="h1" className="insight-line">{'==כל רחוב באשדוד נמדד, ויודעים מה לתקן.=='}</Rich>
      </header>

      <figure className="film intro-film">
        <video controls preload="none" playsInline poster="demo-poster.jpg" src="demo.mp4" aria-label="סרטון: רחוב טוב במספרים, מדידה שהופכת למעשה" />
        <figcaption><b>מדידה שהופכת למעשה.</b> שבעים ושמונה שניות: ציון לכל רחוב, הצלבה של שכבות, ותוכנית פעולה.</figcaption>
      </figure>

      <section className="intro-side" aria-label="חזון, מטרה והכלי">
        <div className="pillar"><span className="label">חזון</span><p>רחוב שנמדד הוא רחוב שאפשר לשפר.</p></div>
        <div className="pillar"><span className="label">מטרה</span><p>ציון לכל רחוב, ומה הכי דחוף לתקן בכל רובע.</p></div>
        <div className="pillar">
          <span className="label">הכלי</span>
          <Rich as="p">{'**15** עקרונות של רחוב טוב, מוצלבים עם **44** מדדי שכונה 360.'}</Rich>
          <p className="src">נתונים מ-OpenStreetMap ומרשימת הרחובות של אשדוד.</p>
        </div>
        <div className="intro-cta">
          <button className="press btn btn-main" onClick={() => go('#/city')}><Icon n="map" />לכניסה למפה</button>
          <button className="press btn" onClick={() => go('#/a')}><Icon n="act" />תוכנית פעולה</button>
          <button className="press btn" onClick={() => go('#/m')}><Icon n="ruler" />איך מודדים</button>
        </div>
      </section>

      <section className="facts" aria-label="שלוש תובנות">
        <div className="fact">
          <span className="fact-n" style={{ color: scoreColor(cs.city.avg) }}>{cs.city.avg}</span>
          <p>הציון הממוצע של רחוב, מתוך 100.</p>
          <span className="src">{`${n} רחובות מדורגים, מתוך ${total} ברשימת העירייה.`}</span>
        </div>
        {weak && (
          <div className="fact">
            <span className="fact-n" style={{ color: scoreColor(weak.meet) }}>{weak.meet}%</span>
            <Rich as="p">{`מהרחובות ביעד ב**${weak.p.label}**.`}</Rich>
            <span className="src">זה החסר הגדול של העיר.</span>
          </div>
        )}
        {top && low && gap != null && (
          <div className="fact">
            <span className="fact-n">{gap}</span>
            <p>נקודות פער בין הרובע המוביל לחלש.</p>
            <span className="src">{`${top.name} (${top.sum.avg}) מול ${low.name} (${low.sum.avg}).`}</span>
          </div>
        )}
      </section>
    </main>
  );
}
