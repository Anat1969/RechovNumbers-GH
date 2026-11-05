// מושך את rn_street_metrics מ-ASHDODMAP לקובץ public/data/snapshot.json.
// רץ בכל בנייה ב-Vercel וב-Action. כשאין רשת (סביבת פיתוח סגורה) הקובץ הקיים נשאר כמו שהוא, והבנייה לא נכשלת.
// גרסת נתונים: 05.11.2026, אחרי תיקון איכות הגאומטריה (אשכול הקטעים שבתוך הרובע).
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';

const URL = 'https://cbhexpybdggwzyakgagd.supabase.co/rest/v1/rn_street_metrics?select=code,name,quarter_id,quarter_source,line,m,computed_at&order=code';
const KEY = 'sb_publishable_1KSwG6rqTzBSHmI2RxX6Fw_EEcuKzk3';
const OUT = 'public/data/snapshot.json';

try {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  const r = await fetch(URL, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: ctrl.signal });
  clearTimeout(t);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const streets = await r.json();
  if (!Array.isArray(streets) || streets.length < 50) throw new Error('too few rows: ' + streets.length);
  mkdirSync('public/data', { recursive: true });
  const taken_at = streets.reduce((a, s) => (s.computed_at > a ? s.computed_at : a), '');
  writeFileSync(OUT, JSON.stringify({ taken_at, streets: streets.map(({ computed_at, ...s }) => s) }));
  console.log(`snapshot: ${streets.length} streets, computed ${taken_at}`);
} catch (e) {
  console.warn('snapshot: kept existing file (' + (e?.message ?? e) + ')' + (existsSync(OUT) ? '' : ', and there is none yet'));
}
