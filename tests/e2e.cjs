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
  await p.route((u) => u.hostname === 'server.arcgisonline.com', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#5a6b4a"/></svg>' }));
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

    await p.goto(BASE + '#/city', { waitUntil: 'networkidle' });
    await p.waitForSelector('.atlas .map-wrap path.street');
    ok((await p.locator('h1').innerText()).includes('אשדוד'), 'בית: שורת התובנה של העיר');
    const box = async (sel) => p.locator(sel).first().boundingBox();
    const [mapBox, bodyBox] = [await box('.a-map'), await box('.a-body')];
    ok(mapBox.x < bodyBox.x && mapBox.width > bodyBox.width * 1.3, 'אטלס: המפה גדולה ובצד שמאל, טור הקריאה מימין');
    ok(await p.locator('.map-wrap path.street').count() > 300, 'בית: מפת העיר עם כל הרחובות');
    ok(await p.locator('.sweep').isVisible(), 'בית: תנועה, הרחובות נמתחים מהחזק לחלש עם כיתוב רץ');
    await p.waitForSelector('.sweep.done', { timeout: 8000 });
    ok(await p.getByRole('button', { name: 'הפעלה מחדש' }).isVisible(), 'בית: התנועה נעצרת, ויש הפעלה מחדש');
    ok(await p.locator('.map-wrap .mark').count() >= 10, 'בית: תווית לכל רובע על המפה');
    ok(await p.locator('.answers .answer').count() === 3, 'בית: שלוש תשובות בלשונית תובנות');
    ok(await p.locator('.a-tab.k-ins[aria-selected="true"]').count() === 1, 'תובנות היא הלשונית הראשונה');
    const fs17 = await p.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    ok(fs17 >= 17, `גופן בסיס ${fs17}px`);
    ok(await p.locator('ai-menu .logo').isVisible(), 'כפתור הלוגו A&I בסרגל');
    ok(!(await p.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'אין כפתורי פיתוח חופשיים בסרגל');
    ok(await p.locator('.num').count() > 10, 'מספרים מודגשים אוטומטית');
    ok(await p.locator('mark.insight').count() >= 1, 'מרקר תובנה בדף הבית');
    ok(await p.locator('.a-head .hist rect').count() === 10, 'בית: התפלגות הציונים בכותרת');
    await p.getByRole('tab', { name: 'מעשים' }).click();
    ok(await p.locator('.tier').count() === 3, 'בית: סולם פעולה בשלוש דרגות');
    ok(await p.locator('.tier-item.has-art .art svg').count() >= 3, 'בית: מפת "איפה" לכל פעולה');
    await p.getByRole('tab', { name: 'מספרים' }).click();
    ok(await p.locator('.prof-row').count() >= 6, 'בית, מספרים: פרופיל העיר לפי פרמטר');
    ok(await p.locator('.compare .cmp-row').count() >= 6, 'בית, מספרים: השוואת שני רחובות');
    await p.locator('.prof-row').first().click();
    ok(p.url().includes('c=') && (await p.locator('.a-map h2').innerText()).includes('בכל רחוב'), 'בית: לחיצה על פרמטר צובעת את מפת העיר');
    ok(await p.locator('.sweep:not(.done)').isVisible(), 'בית: בחירת צבע מתחילה את הסרטון מחדש, לפי הפרמטר');
    await p.waitForSelector('.sweep.done', { timeout: 8000 });
    ok((await p.locator('.sweep.done').innerText()).includes('ביעד'), 'בית: בסוף הסרטון של פרמטר, כמה רחובות ביעד');
    await p.getByRole('tab', { name: 'תובנות' }).click();
    ok(await p.locator('.tile').count() >= 10, 'בית: אריח לכל רובע בלשונית תובנות');
    ok(await p.locator('.answer.has-art .art svg path').count() > 50, 'בית: ציור לכל תשובה');

    await p.locator('.tile').first().click();
    await p.waitForURL(/#\/q\//);
    await p.waitForSelector('.gallery .g-cell');
    ok(p.url().includes('#/q/'), 'אריח פותח את הרובע');
    const cells = await p.locator('.gallery .g-cell').count();
    ok(cells > 3 && await p.locator('.answer.has-art').count() === 3, `רובע: ${cells} רחובות בגלריה באותו קנה מידה, וציור לכל תשובה`);
    await p.locator('.gallery .g-cell').nth(2).click();
    ok(p.url().includes('s='), 'רובע: לחיצה על רחוב בגלריה בוחרת אותו');
    await p.getByRole('tab', { name: 'דירוג' }).click();
    await p.waitForSelector('.rank .row');
    const rows = await p.locator('.rank .row').count();
    ok(rows > 3, `רובע: דירוג עם ${rows} רחובות`);
    ok(await p.locator('.map-wrap path.street').count() === rows, 'רובע: כל רחוב מדורג מצויר במפה');
    ok(await p.locator('.scalebar').isVisible() && await p.locator('svg.north').isVisible(), 'מפה: קנה מידה וחץ צפון');
    ok(await p.locator('.map-wrap textPath').count() >= 2, 'מפה: שמות רחובות לאורך הציר');
    ok(await p.locator('.map-wrap .street-case').count() === rows, 'מפה: קו מתאר לכל רחוב');
    const scores = await p.locator('.rank .score-pill').allInnerTexts();
    ok(scores.every((s, i) => i === 0 || +scores[i - 1] >= +s), 'הדירוג ממוין מהגבוה לנמוך');
    await p.getByRole('tab', { name: 'מספרים' }).click();
    ok(p.url().includes('t=num') && await p.locator('.rel-row').count() >= 6, 'רובע: לשונית מספרים, הרובע מול העיר');
    await p.getByRole('tab', { name: 'מעשים' }).click();
    ok(await p.locator('.a-pane .tier').count() >= 1, 'רובע: לשונית מעשים');
    await p.getByRole('tab', { name: 'דירוג' }).click();
    await p.locator('.rank .row').nth(1).click();
    ok(p.url().includes('s='), 'בחירת רחוב נשמרת בכתובת');
    ok(await p.locator('.pick h3').isVisible(), 'כרטיס הרחוב הנבחר מופיע');
    await p.getByLabel('צבע המפה לפי').selectOption({ index: 1 });
    ok(p.url().includes('c='), 'צבע לפי פרמטר נשמר בכתובת');
    ok((await p.locator('.a-map .panel-h h2').innerText()).includes('בכל רחוב'), 'כותרת המפה מתחלפת לפי הפרמטר');
    const url = p.url();
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForSelector('.pick h3');
    ok(p.url() === url && (await p.getByLabel('צבע המפה לפי').inputValue()) !== '', 'קישור מועתק פותח את אותו מצב');
    await p.getByLabel('בחירת רובע').selectOption('q-b');
    ok(p.url().includes('#/q/q-b'), 'בורר הרובע עובר רובע');

    await p.getByRole('tab', { name: 'תובנות' }).click();
    await p.locator('.answers .answer').nth(0).click();
    ok(await p.locator('.answers .answer').nth(0).getAttribute('aria-pressed') === 'true', 'תשובה 1 בוחרת את הרחוב המוביל');
    await p.getByRole('button', { name: 'הגדלה' }).click();
    ok(true, 'זום במפה');

    await p.getByRole('button', { name: 'אבחון מזוקק' }).click();
    await p.waitForSelector('.ai-box .tone-solution');
    ok(distillCalls === 1 && await p.locator('.ai-box .tone').count() === 3, 'אבחון מזוקק: קריאה אחת לשרת ושלוש קופסאות משמעות');
    ok((await p.locator('.ai-box .layer').innerText()).includes('Gemini'), 'האבחון מסומן כנוסח של מודל');

    await p.getByRole('button', { name: 'כל המדידות של הרחוב' }).click();
    await p.waitForSelector('.badge-n');
    ok(p.url().includes('#/s/'), 'מעבר לדף הרחוב');
    const gm = await p.getByRole('link', { name: 'בגוגל מפות' }).getAttribute('href');
    ok(decodeURIComponent(gm).includes('אשדוד') && gm.includes('google.com/maps/search'), 'דף רחוב: קישור לגוגל מפות עם שם הרחוב ואשדוד');
    ok((await p.getByRole('link', { name: 'מבט רחוב' }).getAttribute('href')).includes('map_action=pano&viewpoint=31.'), 'דף רחוב: מבט רחוב באמצע הרחוב');
    await p.locator('.sat-btn').click();
    await p.waitForSelector('.sat-tiles image', { state: 'attached' });
    ok(await p.locator('.sat-tiles image').count() >= 4 && await p.locator('.sat-credit').isVisible(), 'מפה: לוויין מתחת לרחובות, עם קרדיט');
    await p.locator('.sat-btn').click();
    ok(await p.locator('.sat-tiles image').count() === 0, 'מפה: חזרה מהלוויין');
    await p.getByRole('tab', { name: 'שטח' }).click();
    await p.waitForSelector('.fc-row');
    await p.waitForSelector('.sat-tiles image', { state: 'attached' });
    ok(await p.locator('.fc-row').count() >= 4 && await p.locator('.sat-tiles image').count() >= 4, 'מצב שטח: רשימת בדיקה לכל מדידה, והמפה עוברת ללוויין');
    await p.locator('.fc-row').first().getByRole('button', { name: 'לא נכון' }).click();
    await p.locator('.fc-note').first().fill('יש מעבר חצייה בצומת');
    ok(await p.locator('.fc-row.m-no').count() === 1 && await p.getByRole('button', { name: 'העתקת דוח השטח' }).isEnabled(), 'מצב שטח: סימון, הערה ודוח להעתקה');
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForSelector('.fc-row');
    ok(await p.locator('.fc-row.m-no').count() === 1 && (await p.locator('.fc-note').first().inputValue()).includes('מעבר'), 'מצב שטח: הבדיקה נשמרת אחרי רענון');
    await p.getByRole('tab', { name: 'תובנות' }).click();
    ok(await p.locator('.fam').count() === 5, 'דף רחוב: חמש המשפחות בלשונית תובנות');
    ok(await p.locator('svg.ruler').isVisible() && await p.locator('svg.strip circle').count() > 3 && await p.locator('.street-shape svg path').count() >= 1, 'דף רחוב: סרגל, פס דירוג מול הרובע וצורת הרחוב');
    await p.getByRole('tab', { name: 'מדידות' }).click();
    await p.locator('.ptable tbody tr').first().click();
    ok((await p.locator('.detail').innerText()).includes('איך חושב'), 'דף רחוב: לחיצה על פרמטר מסבירה איך חושב');
    await p.getByRole('tab', { name: 'שכונה 360' }).click();
    ok(await p.locator('.ind-row').count() >= 20, 'דף רחוב: מדדי שכונה 360 שנוגעים ברחוב');
    await p.getByRole('tab', { name: 'מעשים' }).click();
    ok(await p.locator('.street-acts .tone').count() >= 1, 'דף רחוב: מה עושים');

    await p.getByLabel('חיפוש רחוב').fill('המעפילים');
    await p.waitForSelector('.results button');
    await p.getByLabel('חיפוש רחוב').press('Enter');
    await p.waitForFunction(() => document.querySelector('h1')?.textContent === 'המעפילים');
    ok(true, 'חיפוש: Enter פותח את הרחוב');
    await p.getByLabel('חיפוש רחוב').fill('שםשלאקיים');
    ok(await p.getByText('לא נמצא רחוב').isVisible(), 'חיפוש: מצב ריק מוסבר');
    await p.getByLabel('ניקוי החיפוש').click();

    await p.locator('.tabs').getByRole('button', { name: 'איך מודדים' }).click();
    await p.getByRole('tab', { name: /ההצלבה/ }).click();
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
    ok(await p.locator('.a-map .map-wrap path.street').count() > 300 && await p.locator('.map-wrap .mark').count() >= 10, 'פעולות: מפת העיר עם מספר הרחובות שצריכים את הפעולה בכל רובע');
    await p.locator('.act-card .act-top').nth(1).click();
    ok(p.url().includes('p=') && await p.locator('.act-card.on').count() === 1, 'פעולות: בחירת פעולה מציירת אותה במפה');
    await p.getByRole('button', { name: 'רבעים' }).click();
    ok(p.url().includes('v=grid') && await p.locator('.q-frame').count() >= 10, 'פעולות: מסגרות הרבעים במקום המפה');
    await p.locator('.q-frame').first().click();
    ok(p.url().includes('q=') && !p.url().includes('v=grid') && await p.locator('.a-map .map-wrap').count() === 1, 'פעולות: לחיצה על מסגרת בוחרת רובע וחוזרת למפה');
    await p.getByLabel('בחירת רובע לתוכנית').selectOption('q-a');
    ok(p.url().includes('q=q-a'), 'פעולות: סינון לפי רובע נשמר בכתובת');
    await p.getByRole('tab', { name: 'הנחיות לתכנון חדש' }).click();
    ok(await p.locator('.guides li').count() === 13, 'פעולות: הנחיות לתכנון חדש לכל פרמטר');
    await p.locator('.tabs').getByRole('button', { name: 'איך מודדים' }).click();
    await p.waitForSelector('.method .card');
    ok(await p.locator('.method .card').count() === 13, 'שיטה: כרטיס לכל פרמטר');
    ok(await p.locator('.tag-in').count() >= 6, 'שיטה: פרמטרים שבציון מסומנים');
    ok(await p.locator('.basis-key .card').count() === 4, 'שיטה: ארבע רמות בסיס ליעדים');
    ok(await p.locator('.gaps-table tbody tr').count() >= 8, 'שיטה: טבלת מה חסר ומאיפה');

    await p.locator('.brand').click();
    await p.waitForFunction(() => ['', '#/'].includes(location.hash)); await p.waitForSelector('main');
    ok(p.url().endsWith('#/') || !p.url().includes('#/'), 'שם האפליקציה מוביל לבית');

    const gray = await p.evaluate(() => [...document.querySelectorAll('.btn:not([aria-pressed="true"])')].every((x) => getComputedStyle(x).backgroundColor !== 'rgb(255, 255, 255)' && getComputedStyle(x).borderTopWidth === '0px'));
    ok(gray, 'כפתורים: רקע אפור בלי קו מסגרת');
    ok(await p.locator('.topbar .tab .ico').count() === await p.locator('.topbar .tab').count(), 'אייקון לכל חדר בסרגל');
    const radius = await p.evaluate(() => [...document.querySelectorAll('main button, .topbar .tab, .field')].every((x) => getComputedStyle(x).borderRadius === '0px'));
    ok(radius, 'כל הכפתורים מרובעים');

    const cdp = await p.context().newCDPSession(p);
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const inst = await cdp.send('Page.getInstallabilityErrors');
    ok(inst.installabilityErrors.length === 0, 'התקנה מ-Chrome: ' + (JSON.stringify(inst.installabilityErrors) || 'אין שגיאות'));

    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
      const m = await b.newPage({ viewport: vp, reducedMotion: 'reduce' });
      await mock(m);
      m.on('pageerror', (e) => errors.push(e.message));
      for (const h of ['', '#/city', '#/city?t=num', '#/city?t=act', '#/city?t=story', '#/q/q-a', '#/q/q-a?t=act', '#/s/161', '#/s/161?t=m', '#/s/161?t=field', '#/a', '#/x', '#/m']) {
        await m.goto(BASE + h, { waitUntil: 'networkidle' });
        await m.waitForTimeout(500);
        const hs = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        ok(!hs, `${vp.width}px ${h || 'בית'}: בלי גלילה אופקית`);
      }
      await m.goto(BASE + '#/q/q-a', { waitUntil: 'networkidle' });
      await m.waitForSelector('.map-wrap .street');
      const anim = await m.evaluate(() => getComputedStyle(document.querySelector('.map-wrap .street')).animationName);
      ok(anim === 'none', `${vp.width}px: הפחתת תנועה מכובדת`);
      const dash = await m.evaluate(() => getComputedStyle(document.querySelector('.map-wrap .street')).strokeDashoffset);
      ok(dash === '0' || dash === '0px', `${vp.width}px: בהפחתת תנועה הקווים גלויים`);
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
