// Opens every sidebar page of one workspace and records failures (API >= 400, JS errors, redirects).
import { launch, session, settle, WEB } from './browser.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const ids = JSON.parse(readFileSync(new URL('./ids.json', import.meta.url)));
const [who, workspace] = process.argv.slice(2);
const userId = ids.teachers[who] ?? who;
const browser = await launch();
const { page, log } = await session(browser, userId, { workspace });
await settle(page);
const landed = page.url().replace(WEB, '');
const links = await page.$$eval('.sidebar-nav a.nav-item[href]', as => [...new Set(as.map(a => a.getAttribute('href')))]);
const results = [];
for (const href of links) {
  const before = { api: log.api.length, console: log.console.length, pageErrors: log.pageErrors.length };
  await page.goto(WEB + href);
  await settle(page);
  const url = page.url().replace(WEB, '');
  const text = (await page.locator('main, .main-content, body').first().innerText().catch(() => '')).slice(0, 4000);
  results.push({ href, url, redirected: url.split('?')[0] !== href.split('?')[0],
    api: log.api.slice(before.api), console: log.console.slice(before.console), pageErrors: log.pageErrors.slice(before.pageErrors),
    spinner: await page.locator('.spinner, mat-spinner, mat-progress-spinner, .loading-spinner').count(),
    errorText: (text.match(/(could not|unable to|failed|not allowed|forbidden|went wrong|session expired|sign in again)[^\n]{0,120}/ig) ?? [])
      .filter(t => !/goes straight to Edunexify support/i.test(t)).slice(0, 4) });   // help text on Report a problem
}
writeFileSync(new URL(`./crawl-${who.replace(/\W+/g, '_')}-${workspace ?? 'default'}.json`, import.meta.url), JSON.stringify({ landed, results }, null, 2));
console.log('landed', landed, 'links', links.length);
for (const r of results) {
  const bad = r.api.length || r.pageErrors.length || r.redirected || r.errorText.length;
  if (bad) console.log(`FAIL ${r.href}${r.redirected ? ' -> ' + r.url : ''}`, r.api.map(a => `${a.status} ${a.method} ${a.url}`).join(' | '), r.pageErrors.map(e => e.text).join(' | '), r.errorText.join(' / '));
}
await browser.close();
