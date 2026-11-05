# רחוב טוב במספרים

**[https://rechov-numbers.vercel.app](https://rechov-numbers.vercel.app)**

קישור למיזוג האחרון, בלי Vercel: https://raw.githack.com/Anat1969/RechovNumbers-GH/main/app/index.html
(ב-raw.githack מופיע לפעמים דף ביניים "One more step": לוחצים "Open the page" פעם אחת.)

ציון לכל רחוב באשדוד (Ashdod), ודירוג רחובות בכל שכונה.
הכלי מצליב את **עקרונות הרחוב הטוב** (15) עם **44 מדדי שכונה 360**, ומודד מנתונים פתוחים.

## נבנה מתוך
- **רחובות טובים באשדוד:** https://nicestreets-vercal.vercel.app · קוד: https://github.com/Anat1969/NiceStreets-GH (העקרונות, השיוך העירוני של רחובות לרבעים, סולם הצבע)
- **שכונה 360: שער היעדים:** https://shchuna-360.vercel.app · קוד: https://github.com/Anat1969/pro-metrics-vue-GH (44 המדדים והניקוד שלהם, ציוני התוכניות)

## איך זה עובד
1. `rn_fetch_osm` (Supabase ASHDODMAP) טוען שכבות OpenStreetMap דרך Overpass: דרכים, בניינים, תחנות, מעברים, גנים ושירותים.
2. `rn_compute` מחשב ב-PostGIS (EPSG:2039) 19 פרמטרים לכל רחוב לטבלה `rn_street_metrics`. קוד: `supabase/migrations/`.
3. האפליקציה קוראת את הטבלה בזמן אמת, ונופלת לתמונה השמורה `public/data/snapshot.json` כשאין שרת.
4. מנוע הציון (`src/lib/model.ts`) רץ בדפדפן: כל פרמטר מול יעד, משוקלל לפי הנקודות של שכונה 360.
5. אמינות: פרמטר נכנס לציון רק כשיש לו ערך ביותר מ-25% מרחובות העיר.
6. אבחון מזוקק: פונקציית Edge `rn-distill` (Gemini חינמי, Claude כגיבוי), לפי תקן הזיקוק של Claude-GH.

## הרצה
```bash
npm install
npm run dev
```

## בדיקות
```bash
npm run build && node tests/e2e.cjs
```

## רענון הנתונים
```sql
select rn_fetch_osm('road', '...'); -- ראו supabase/migrations
select rn_compute();
```
ה-Action `refresh-data` מעדכן את התמונה השמורה בכל שבוע.
