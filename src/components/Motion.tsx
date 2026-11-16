// תנועה שמסבירה: נכנסת פעם אחת, מבוססת על הנתון, ונעצרת. עם הפחתת תנועה רואים מיד את המצב הסופי.
import { useEffect, useState } from 'react';

export const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/** התקדמות 0 עד 1 לאורך span שניות, מתחילה מחדש כש-key משתנה. */
export function useSweep(span: number, key: unknown, delay = 0) {
  const [p, setP] = useState(reducedMotion() ? 1 : 0);
  useEffect(() => {
    if (reducedMotion()) { setP(1); return; }
    setP(0);
    let raf = 0; const t0 = performance.now() + delay * 1000;
    const tick = (t: number) => {
      const v = Math.max(0, Math.min(1, (t - t0) / (span * 1000)));
      setP(v); if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [span, key, delay]);
  return p;
}

/** מספר שסופר עד הערך: הממוצע נבנה מול העין. */
export function CountUp({ to, span = 1.4, k }: { to: number; span?: number; k?: unknown }) {
  const p = useSweep(span, `${to}-${String(k)}`);
  const e = 1 - Math.pow(1 - p, 3);
  return <>{Math.round(to * e)}</>;
}
