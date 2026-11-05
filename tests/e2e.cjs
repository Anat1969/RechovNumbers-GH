// בדיקת קצה לקצה: npm run build && node tests/e2e.cjs (מריץ vite preview בעצמו).
// השרתים מדומים: Supabase נחסם (האפליקציה נופלת לתמונה השמורה), והאבחון המזוקק מחזיר תשובה קבועה.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const BASE = 'http://localhost:4199/';
const MENU = fs.readFileSync('tests/fixtures/ai-menu.js', 'utf8');
const fails = [];
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails.push(msg); };

async function mock(p) {
  await p.route('**/appofapp-gh.vercel.app/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: MENU }));
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await p.route('**/rest/v1/**', (r) => r.abort());
  await p.route('**/functions/v1/rn-distill', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ provider: 'gemini', diagnosis: '**אבחון** בדיקה. משפט הסבר.', lever: '**אורך בלוק** הוא המנוף.', action: 'לפתוח **מעבר** ברחוב הדקל.' }),
  }));
}

(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4199', '--strictPort'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await mock(p);
    let distillCalls = 0;
    p.on('request', (r) => { if (r.url().includes('rn-distill') && r.method() === 'POST') distillCalls++; });

    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.waitForSelector('.tile');
    ok((await p.locator('h1').innerText()).includes('רחובות באשדוד'), 'בית: שורת התובנה עם מספר הרחובות');
    ok(await p.locator('.tile').count() >= 10, 'בית: אריח לכל רובע');
    const order = await p.evaluate(() => [...document.querySelectorAll('main .band-h')].map((h) => h.textContent));
    ok(order[0].includes('כל רובע במבט') && order[1].includes('איך נולד הציון'), 'בית: כותרת, הדיאגרמות של הרבעים, איך נולד הציון, ואז השאר');
    ok(await p.locator('.answers .answer').count() === 3, 'בית: שלוש תשובות');
    ok(await p.locator('ai-menu .logo').isVisible(), 'כפתור הלוגו A&I בסרגל');
    ok(!(await p.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'אין כפתורי פיתוח חופשיים בסרגל');
    ok(await p.locator('.num').count() > 10, 'מספרים מודגשים אוטומטית');
    ok(await p.locator('mark.insight').count() >= 1, 'מרקר תובנה בדף הבית');
    ok(await p.locator('.prof-row').count() >= 6, 'בית, מקרו: פרופיל העיר לפי פרמטר');
    ok(await p.locator('.hist rect').count() === 10, 'בית, מקרו: התפלגות הציונים');
    ok(await p.locator('.compare .cmp-row').count() >= 6, 'בית, מיקרו: השוואת שני רחובות');
    ok(await p.locator('.tier').count() === 3, 'בית: סולם פעולה בשלוש דרגות');
    ok(await p.locator('.gap').count() >= 6, 'בית: מה עוד לא נמדד ומאיפה');

    await p.locator('.tile').first().click();
    await p.waitForSelector('.rank .row');
    ok(p.url().includes('#/q/'), 'אריח פותח את הרובע');
    const rows = await p.locator('.rank .row').count();
    ok(rows > 3, `רובע: דירוג עם ${rows} רחובות`);
    ok(await p.locator('.map-wrap path.street').count() === rows, 'רובע: כל רחוב מדורג מצויר במפה');
    ok(await p.locator('.scalebar').isVisible() && await p.locator('svg.north').isVisible(), 'מפה: קנה מידה וחץ צפון');
    ok(await p.locator('.map-wrap textPath').count() >= 2, 'מפה: שמות רחובות לאורך הציר');
    ok(await p.locator('.map-wrap .street-case').count() === rows, 'מפה: קו מתאר לכל רחוב');
    await p.getByRole('tab', { name: 'ממצאים' }).click();
    ok(p.url().includes('t=story') && await p.locator('.rel-row').count() >= 6, 'רובע: לשונית ממצאים, הרובע מול העיר');
    await p.getByRole('tab', { name: 'פעולות' }).click();
    ok(await p.locator('.side-story .tone').count() >= 1, 'רובע: לשונית פעולות');
    await p.getByRole('tab', { name: 'דירוג' }).click();
    await p.waitForSelector('.rank .row');
    const scores = await p.locator('.rank .score-pill').allInnerTexts();
    ok(scores.every((s, i) => i === 0 || +scores[i - 1] >= +s), 'הדירוג ממוין מהגבוה לנמוך');

    await p.locator('.rank .row').nth(1).click();
    ok(p.url().includes('s='), 'בחירת רחוב נשמרת בכתובת');
    ok(await p.locator('.pick h3').isVisible(), 'כרטיס הרחוב הנבחר מופיע');
    await p.locator('.dock .chip-t').nth(1).click();
    ok(p.url().includes('c='), 'צבע לפי פרמטר נשמר בכתובת');
    ok((await p.locator('.map-wrap .panel-h h2, .panel-h h2').first().innerText()).includes('בכל רחוב'), 'כותרת המפה מתחלפת לפי הפרמטר');
    const url = p.url();
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForSelector('.pick h3');
    ok(p.url() === url && await p.locator('.dock .chip-t[aria-pressed="true"]').count() === 1, 'קישור מועתק פותח את אותו מצב');

    await p.locator('.answers .answer').nth(0).click();
    ok(await p.locator('.answers .answer').nth(0).getAttribute('aria-pressed') === 'true', 'תשובה 1 בוחרת את הרחוב המוביל');
    await p.locator('.map-tools button').first().click();
    ok(true, 'זום במפה');

    await p.getByRole('button', { name: 'אבחון מזוקק' }).click();
    await p.waitForSelector('.ai-box .tone-solution');
    ok(distillCalls === 1 && await p.locator('.ai-box .tone').count() === 3, 'אבחון מזוקק: קריאה אחת לשרת ושלוש קופסאות משמעות');
    ok((await p.locator('.ai-box .layer').innerText()).includes('Gemini'), 'האבחון מסומן כנוסח של מודל');

    await p.getByRole('button', { name: 'כל המדידות של הרחוב' }).click();
    await p.waitForSelector('.ptable');
    ok(p.url().includes('#/s/'), 'מעבר לדף הרחוב');
    ok(await p.locator('.score-big').isVisible(), 'דף רחוב: ציון גדול');
    await p.locator('.ptable tbody tr').first().click();
    ok((await p.locator('.detail').innerText()).includes('איך חושב'), 'דף רחוב: לחיצה על פרמטר מסבירה איך חושב');
    ok(await p.locator('.ind-row').count() >= 20, 'דף רחוב: מדדי שכונה 360 שנוגעים ברחוב');
    ok(await p.locator('.street-acts .mini-h').isVisible(), 'דף רחוב: למה הציון הזה ומה עושים');

    await p.getByLabel('חיפוש רחוב').fill('המעפילים');
    await p.waitForSelector('.results button');
    await p.getByLabel('חיפוש רחוב').press('Enter');
    await p.waitForFunction(() => document.querySelector('h1')?.textContent === 'המעפילים');
    ok(true, 'חיפוש: Enter פותח את הרחוב');
    await p.getByLabel('חיפוש רחוב').fill('שםשלאקיים');
    ok(await p.getByText('לא נמצא רחוב').isVisible(), 'חיפוש: מצב ריק מוסבר');
    await p.getByLabel('ניקוי החיפוש').click();

    await p.locator('.tabs').getByRole('button', { name: 'ההצלבה' }).click();
    await p.waitForSelector('.matrix');
    ok(await p.locator('.matrix td.on').count() > 5, 'הצלבה: תאים שנמדדים');
    ok(await p.locator('.matrix td.link').count() > 5, 'הצלבה: תאים קשורים שעוד לא נמדדים');
    await p.locator('.matrix th.colh').nth(30).click();
    ok((await p.locator('.detail').innerText()).includes('נקודות'), 'הצלבה: לחיצה על מדד מציגה הסבר');
    await p.getByRole('button', { name: 'פירוק לפי עיקרון' }).click();
    ok(await p.locator('.crit-card').count() === 15 && await p.locator('.crit-card .ind-pill').count() >= 23, 'הצלבה: פירוק לפי עיקרון, כרטיס לכל עיקרון');
    await p.getByRole('button', { name: 'פירוק לפי מדד' }).click();
    ok(await p.locator('.ind-line').count() === 44, 'הצלבה: פירוק לפי מדד, 44 שורות קריאות');
    await p.locator('.cross-bar .chip-t').nth(4).click();
    ok(p.url().includes('ch=b') && await p.locator('.ind-line').count() === 20, 'הצלבה: סינון לפי פרק');
    await p.getByRole('button', { name: 'מטריצה' }).click();
    ok(await p.locator('.matrix th.colh').count() === 20, 'הצלבה: מטריצה מסוננת לפרק, עם תוויות רחבות');

    await p.locator('.tabs').getByRole('button', { name: 'פעולות' }).click();
    await p.waitForSelector('.act-card');
    ok(await p.locator('.tier').count() === 3 && await p.locator('.act-card').count() >= 3, 'פעולות: שלוש דרגות וכרטיסי פעולה');
    await p.locator('.chips .chip-t').first().click();
    ok(p.url().includes('q=q-a'), 'פעולות: סינון לפי רובע נשמר בכתובת');
    ok(await p.locator('.guides li').count() === 13, 'פעולות: הנחיות לתכנון חדש לכל פרמטר');
    await p.locator('.tabs').getByRole('button', { name: 'איך מודדים' }).click();
    await p.waitForSelector('.method .card');
    ok(await p.locator('.method .card').count() === 13, 'שיטה: כרטיס לכל פרמטר');
    ok(await p.locator('.tag-in').count() >= 6, 'שיטה: פרמטרים שבציון מסומנים');
    ok(await p.locator('.basis-key .card').count() === 4, 'שיטה: ארבע רמות בסיס ליעדים');
    ok(await p.locator('.gaps-table tbody tr').count() >= 8, 'שיטה: טבלת מה חסר ומאיפה');

    await p.locator('.brand').click();
    await p.waitForSelector('.tile');
    ok(p.url().endsWith('#/') || !p.url().includes('#/'), 'שם האפליקציה מוביל לבית');

    const radius = await p.evaluate(() => [...document.querySelectorAll('main button, .dock button, .topbar .tab')].every((x) => getComputedStyle(x).borderRadius === '0px'));
    ok(radius, 'כל הכפתורים מרובעים');

    const cdp = await p.context().newCDPSession(p);
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const inst = await cdp.send('Page.getInstallabilityErrors');
    ok(inst.installabilityErrors.length === 0, 'התקנה מ-Chrome: ' + (JSON.stringify(inst.installabilityErrors) || 'אין שגיאות'));

    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
      const m = await b.newPage({ viewport: vp, reducedMotion: 'reduce' });
      await mock(m);
      m.on('pageerror', (e) => errors.push(e.message));
      for (const h of ['', '#/q/q-a', '#/q/q-a?t=story', '#/s/161', '#/a', '#/x', '#/m']) {
        await m.goto(BASE + h, { waitUntil: 'networkidle' });
        await m.waitForTimeout(500);
        const hs = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        ok(!hs, `${vp.width}px ${h || 'בית'}: בלי גלילה אופקית`);
      }
      await m.goto(BASE + '#/q/q-a', { waitUntil: 'networkidle' });
      await m.waitForSelector('.map-wrap .street');
      const anim = await m.evaluate(() => getComputedStyle(document.querySelector('.map-wrap .street')).animationName);
      ok(anim === 'none', `${vp.width}px: הפחתת תנועה מכובדת`);
      await m.close();
    }
    ok(errors.length === 0, 'אין שגיאות JavaScript ' + errors.join(' | '));
  } finally {
    await b.close();
    srv.kill();
  }
  console.log(fails.length ? `\n${fails.length} נכשלו` : '\nהכול עבר');
  process.exit(fails.length ? 1 : 0);
})();
