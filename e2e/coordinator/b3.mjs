// Notification deep links: a class teacher opens the Coordinator's correction request; a substitute opens the cover notice.
import { launch, session, settle, WEB } from './browser.mjs';
import { check, done, T } from './harness.mjs';
import { sql } from './api.mjs';
const browser = await launch();
for (const [who, code] of [['Omar Sheikh', 'REPORT_CARD_CORRECTION_REQUESTED'], ['Vikram Singh', 'TEACHER_SUBSTITUTION_ASSIGNED']]) {
  await check('Notifications', `${who} opens a ${code} notification and lands on its page`, async () => {
    const route = sql(`SELECT n.action_route FROM user_notifications un JOIN notifications n ON n.id=un.notification_id WHERE un.user_id='${T[who]}' AND n.event_code='${code}' ORDER BY n.id DESC LIMIT 1`);
    if (!route) throw new Error('no notification');
    const { page, log } = await session(browser, T[who]);
    await page.goto(WEB + '/dashboard/notifications'); await settle(page, 1500);
    const item = page.locator('.nc-row').filter({ hasText: /correction|substitut|cover/i }).first();
    await item.click(); await settle(page, 2000);
    const at = page.url().replace(WEB, '');
    const bad = log.api.filter(a => a.page !== '/home');
    if (!at.startsWith(route.split('?')[0])) throw new Error(`clicked -> ${at}, expected ${route}`);
    if (bad.length) throw new Error(bad.map(a => `${a.status} ${a.url}`).join(', '));
    return { route, at };
  });
}
await browser.close(); done();
