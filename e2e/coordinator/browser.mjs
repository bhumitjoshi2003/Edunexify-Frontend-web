// Real-browser helpers (system Google Chrome via playwright-core) against the local dev stack only.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { API, PASSWORD, SLUG, REDIS_PORT } from './api.mjs';
export const WEB = process.env.COORD_E2E_WEB ?? 'http://localhost:4200';
if (!/^http:\/\/localhost:\d+$/.test(WEB)) throw new Error('COORD_E2E_WEB must be a localhost dev server');
export async function launch() {
  return chromium.launch({ channel: 'chrome', headless: true });
}
/** A logged-in page for one user; records API failures, console errors and page errors. */
export async function session(browser, userId, { workspace } = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const log = { api: [], console: [], pageErrors: [] };
  const origin = API.replace(/\/api$/, '');
  page.on('response', r => { const u = r.url(); if (u.startsWith(API + '/') && r.status() >= 400) log.api.push({ status: r.status(), method: r.request().method(), url: u.replace(origin, ''), page: page.url().replace(WEB, '') }); });
  page.on('console', m => { if (m.type() === 'error') log.console.push({ text: m.text().slice(0, 300), page: page.url().replace(WEB, '') }); });
  page.on('pageerror', e => log.pageErrors.push({ text: String(e).slice(0, 300), page: page.url().replace(WEB, '') }));
  await page.goto(WEB + '/home');
  execFileSync('redis-cli', ['-p', REDIS_PORT, 'FLUSHDB']);
  const status = await page.evaluate(async ([u, p, s, api]) => (await fetch(api + '/auth/login', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u, password: p, schoolSlug: s }) })).status,
    [userId, PASSWORD, SLUG, API]);
  if (status !== 200) throw new Error(`browser login ${userId} -> ${status}`);
  if (workspace) await page.evaluate(([k, w]) => localStorage.setItem(k, w), [`edunexify.workspace.v1.${SLUG}.${userId}`, workspace]);
  await page.goto(WEB + '/dashboard');
  await settle(page, 800);
  return { context, page, log };
}
export async function settle(page, ms = 1500) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
  // First-visit dialogs (welcome / what's new) sit over the page; close them like a user would.
  for (let i = 0; i < 3 && await page.locator('mat-dialog-container').count(); i++) {
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  }
}
