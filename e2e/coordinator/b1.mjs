import { execFileSync } from 'node:child_process';
import { API, PASSWORD, SLUG, REDIS_PORT } from './api.mjs';
// Browser scenarios: workspace switching, refresh, tabs, history, token expiry, logout/login,
// revocation while signed in, staff-attendance attribution, partial-scope timetable, phone width.
import { launch, session, settle, WEB } from './browser.mjs';
import { check, done, T, ids, as } from './harness.mjs';
const browser = await launch();
const sunita = T['Sunita Rao'];
const nav = page => page.$$eval('.sidebar-nav .nav-item', as => as.map(a => a.textContent.trim().replace(/\s+/g, ' ')));
const path = page => page.url().replace(WEB, '').split('?')[0];
async function switchTo(page, w) {
  await page.click('.hdr-profile-pill');
  await page.click(`[data-testid="workspace-${w}"]`);
  await settle(page, 800);
}
let ctx;
await check('Workspace', 'first login lands in Coordinator workspace; switch to Teacher and back without reload', async () => {
  ctx = await session(browser, sunita);
  const { page } = ctx;
  if (path(page) !== '/dashboard/coordinator-dashboard') throw new Error(`landed ${path(page)}`);
  const cNav = await nav(page);
  await switchTo(page, 'teacher');
  if (path(page) !== '/dashboard/teacher-dashboard') throw new Error(`teacher switch landed ${path(page)}`);
  const tNav = await nav(page);
  if (tNav.some(x => /Coordinator Dashboard|Staff attendance/i.test(x))) throw new Error('teacher nav shows coordinator items');
  await switchTo(page, 'coordinator');
  if (path(page) !== '/dashboard/coordinator-dashboard') throw new Error(`back to ${path(page)}`);
  const dup = cNav.filter((x, i) => cNav.indexOf(x) !== i);
  if (dup.length) throw new Error(`duplicate nav entries: ${dup}`);
  return { coordinatorNav: cNav.length, teacherNav: tNav.length };
});
await check('Workspace', 'reload keeps the chosen workspace (both modes)', async () => {
  const { page } = ctx;
  await page.reload(); await settle(page);
  if (path(page) !== '/dashboard/coordinator-dashboard') throw new Error(`after reload ${path(page)}`);
  await switchTo(page, 'teacher'); await page.reload(); await settle(page);
  if (path(page) !== '/dashboard/teacher-dashboard') throw new Error(`teacher reload ${path(page)}`);
  if ((await nav(page)).some(x => /Coordinator Dashboard/i.test(x))) throw new Error('coordinator nav after teacher reload');
});
await check('Workspace', 'a coordinator page opened in a new tab shows Coordinator navigation', async () => {
  const p2 = await ctx.context.newPage();
  await p2.goto(WEB + '/dashboard/staff-attendance'); await settle(p2);
  if (path(p2) !== '/dashboard/staff-attendance') throw new Error(`new tab at ${path(p2)}`);
  if (!(await nav(p2)).some(x => /Coordinator Dashboard/i.test(x))) throw new Error('coordinator nav missing in new tab');
  await p2.close();
});
await check('Workspace', 'Back and Forward follow the page\'s workspace', async () => {
  const { page } = ctx;
  await page.goto(WEB + '/dashboard/teacher-dashboard'); await settle(page);
  await page.goto(WEB + '/dashboard/coordinator-dashboard'); await settle(page);
  await page.goBack(); await settle(page);
  if (path(page) !== '/dashboard/teacher-dashboard' || (await nav(page)).some(x => /Coordinator Dashboard/i.test(x))) throw new Error(`back: ${path(page)}`);
  await page.goForward(); await settle(page);
  if (path(page) !== '/dashboard/coordinator-dashboard' || !(await nav(page)).some(x => /Coordinator Dashboard/i.test(x))) throw new Error(`forward: ${path(page)}`);
});
await check('Session', 'expired access token is refreshed silently (no false session-expired)', async () => {
  const { page, context, log } = ctx;
  const cookies = await context.cookies();
  await context.clearCookies(); await context.addCookies(cookies.filter(c => c.name !== 'accessToken'));
  const before = log.api.length;
  await page.goto(WEB + '/dashboard/teacher-list'); await settle(page, 2500);
  if (path(page) !== '/dashboard/teacher-list') throw new Error(`redirected to ${path(page)}`);
  const text = await page.innerText('body');
  if (/session (has )?expired|sign in again/i.test(text)) throw new Error('session-expired message shown');
  return log.api.slice(before).map(a => `${a.status} ${a.url}`);
});
await check('Session', 'a 403 (out-of-scope action) never signs the user out', async () => {
  const { page } = ctx;
  const status = await page.evaluate(async (api) => (await fetch(api + '/coordinators', { credentials: 'include' })).status, API);
  await page.goto(WEB + '/dashboard/coordinator-dashboard'); await settle(page);
  if (status !== 403) throw new Error(`expected 403 got ${status}`);
  if (path(page) !== '/dashboard/coordinator-dashboard') throw new Error(`after 403 at ${path(page)}`);
});
await check('Session', 'logout and login keep the last workspace choice', async () => {
  const { page } = ctx;
  await switchTo(page, 'teacher');
  await page.click('.hdr-profile-pill'); await page.click('.pm-logout'); await settle(page);
  if (!path(page).startsWith('/home')) throw new Error(`after logout ${path(page)}`);
  // Same device (same browser storage): sign in again.
  execFileSync('redis-cli', ['-p', REDIS_PORT, 'FLUSHDB']);
  const st = await page.evaluate(async ([u, p, s, api]) => (await fetch(api + '/auth/login', { method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u, password: p, schoolSlug: s }) })).status, [sunita, PASSWORD, SLUG, API]);
  await page.goto(WEB + '/dashboard'); await settle(page);
  if (st !== 200 || path(page) !== '/dashboard/teacher-dashboard') throw new Error(`relogin ${st} landed ${path(page)}`);
  await switchTo(page, 'coordinator');
});
await check('Revocation', 'appointment ended while signed in: Coordinator UI goes, Teacher work stays, no logout', async () => {
  const { page } = ctx;
  const admin = await as('E2E-ADMIN');
  const a = (await admin.ok('GET', '/coordinators')).find(x => x.teacherId === sunita);
  await page.goto(WEB + '/dashboard/coordinator-dashboard'); await settle(page);
  await admin.ok('POST', `/coordinators/${a.id}/remove`, { reason: 'Synthetic browser revocation' });
  await page.goto(WEB + '/dashboard/staff-attendance'); await settle(page, 2500);
  const where = path(page), navNow = await nav(page), body = await page.innerText('body');
  const result = { where, coordinatorNav: navNow.some(x => /Coordinator Dashboard/i.test(x)), switcher: await page.locator('[data-testid="workspace-switcher"]').count() };
  await page.goto(WEB + '/dashboard/teacher-dashboard'); await settle(page);
  const teacherOk = path(page) === '/dashboard/teacher-dashboard';
  await admin.ok('POST', '/coordinators', { teacherId: sunita, scope: a.scope.map(s => ({ classId: s.classId, sectionId: s.sectionId, streamId: s.streamId })) });
  if (where.startsWith('/home') || /session (has )?expired/i.test(body)) throw new Error('signed out after revocation');
  if (!teacherOk) throw new Error('teacher dashboard unavailable after revocation');
  if (result.coordinatorNav || where === '/dashboard/staff-attendance') throw new Error(`coordinator UI still offered after revocation: ${JSON.stringify(result)}`);
  return result;
});
await check('Staff attendance UI', 'a coordinator correction shows "Corrected by <name> (Coordinator)", never Admin', async () => {
  await ctx.context.close();
  ctx = await session(browser, T['Arjun Das'], { workspace: 'COORDINATOR' });
  const { page } = ctx;
  await page.goto(WEB + '/dashboard/staff-attendance'); await settle(page, 2500);
  const text = await page.innerText('body');
  const m = text.match(/Omar Sheikh[\s\S]{0,160}/);
  if (!/Corrected by Kiran Mehta \(Coordinator\)/.test(text)) throw new Error(`label not found near Omar: ${m?.[0]}`);
  if (/Omar Sheikh[^\n]*\n[^\n]*· Admin/.test(text)) throw new Error('still shows Admin');
  return m?.[0]?.replace(/\s+/g, ' ');
});
await check('Timetable', 'a single-section Coordinator opens class timetables without a 403', async () => {
  const { page, log } = ctx;
  const before = log.api.length;
  await page.goto(WEB + '/dashboard/coordinator-timetable'); await settle(page, 2500);
  const bad = log.api.slice(before).filter(a => a.url.includes('/timetable'));
  if (bad.length) throw new Error(bad.map(a => `${a.status} ${a.url}`).join(', '));
  const options = await page.$$eval('#tt-section-sel option', os => os.map(o => o.textContent.trim()));
  return { options };
});
await check('Responsive', 'coordinator pages have no horizontal overflow at phone width', async () => {
  const { page } = ctx;
  await page.setViewportSize({ width: 390, height: 844 });
  const over = [];
  for (const href of ['/dashboard/coordinator-dashboard', '/dashboard/staff-attendance', '/dashboard/report-card-review', '/dashboard/teacher-substitutions', '/dashboard/coordinator-attendance', '/dashboard/view-leaves']) {
    await page.goto(WEB + href); await settle(page, 1200);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > 392) over.push(`${href}: ${w}px`);
  }
  if (over.length) throw new Error(over.join(', '));
});
await browser.close();
done();
