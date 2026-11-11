// Browser: primary actions through the real UI, verified against the database.
import { launch, session, settle, WEB } from './browser.mjs';
import { check, done, T, ST, ids } from './harness.mjs';
import { sql } from './api.mjs';
const browser = await launch();
const path = page => page.url().replace(WEB, '').split('?')[0];
const sunita = await session(browser, T['Sunita Rao'], { workspace: 'COORDINATOR' });
const p = sunita.page;
const confirmDialog = async () => { const b = p.locator('mat-dialog-container button').filter({ hasText: /yes|confirm|approve|save|submit|reject/i }).first(); if (await b.count()) { await b.click(); await settle(p, 800); } };

await check('UI · Dashboard', 'tiles match the database (students present, staff present, leave, report cards)', async () => {
  await p.goto(WEB + '/dashboard/coordinator-dashboard'); await settle(p, 2000);
  const tiles = await p.$$eval('.pd-today .pd-tile', ts => ts.map(t => t.innerText.replace(/\s+/g, ' ').trim()));
  const present = sql(`SELECT count(*) FILTER (WHERE r.status='PRESENT')||'/'||count(*) FROM student_attendance r JOIN attendance_session a ON a.id=r.attendance_session_id JOIN school_class c ON c.id=a.class_id WHERE a.school_id=1 AND a.attendance_date='2026-11-11' AND c.name IN ('6','7','8','9','10')`);
  const pending = sql(`SELECT count(*) FROM leaves WHERE school_id=1 AND status='PENDING' AND class_name IN ('6','7','8','9','10')`);
  const [pr, mk] = present.split('/');
  if (!tiles[0].includes(`${pr} of ${mk} marked`)) throw new Error(`students tile "${tiles[0]}" vs db ${present}`);
  if (!new RegExp(`Leave requests\\s+${pending}\\b`).test(tiles[2].replace(/event_note/, '').replace(/\s+/g, ' '))) throw new Error(`leave tile "${tiles[2]}" vs db ${pending}`);
  return tiles;
});
await check('UI · Student leave', 'approve an in-scope request from the Student leave page; card names the Coordinator', async () => {
  await p.goto(WEB + '/dashboard/view-leaves'); await settle(p, 2000);
  const card = p.locator('.vl-card, [class*="vl-card"]').filter({ hasText: 'Student 8A2' }).first();
  await card.locator('.vl-btn-approve').click(); await p.waitForTimeout(800); await confirmDialog();
  const row = sql(`SELECT status||'|'||decided_by||'|'||coalesce(decided_by_role,'') FROM leaves WHERE student_id='${ST['Student 8A2']}'`);
  if (!row.startsWith(`APPROVED|${T['Sunita Rao']}|COORDINATOR`)) throw new Error(row);
  await p.goto(WEB + '/dashboard/view-leaves'); await settle(p, 1500);
  await p.locator('.vl-status-filter', { hasText: /^\s*Approved\s*$/ }).first().click(); await settle(p, 1500);
  const text = await p.innerText('body');
  if (!/Approved by Sunita Rao \(Coordinator\)/.test(text)) throw new Error('card does not name Sunita Rao (Coordinator)');
  return row;
});
await check('UI · Teacher leave', 'Coordinator sees teacher leave read-only (no approve/reject controls)', async () => {
  await p.goto(WEB + '/dashboard/teacher-leave-requests'); await settle(p, 1500);
  if (path(p) !== '/dashboard/teacher-leave-requests') throw new Error(`at ${path(p)}`);
  const buttons = await p.locator('.tl-btn-approve, .tl-btn-reject').count();
  if (buttons) throw new Error(`${buttons} decision buttons shown`);
  return (await p.innerText('main')).match(/Tara Bose[^\n]*/)?.[0];
});
await check('UI · Staff attendance', 'correct Tara\'s attendance with a reason; history shows Sunita Rao (Coordinator)', async () => {
  await p.goto(WEB + '/dashboard/staff-attendance'); await settle(p, 2000);
  await p.click('.sa-mark-btn'); await p.waitForTimeout(800);
  await p.locator('select').filter({ has: p.locator(`option[value="${T['Tara Bose']}"]`) }).first().selectOption(T['Tara Bose']);
  await p.locator('select').filter({ has: p.locator('option[value="LATE"]') }).first().selectOption('LATE');
  await p.locator('input[type="time"]').first().fill('08:30').catch(() => {});
  await p.fill('#sa-correction-reason', 'Synthetic UI: register shows a late arrival');
  await p.click('.sa-dialog-submit'); await settle(p, 1500);
  const row = sql(`SELECT corrected_by||'|'||corrected_by_role||'|'||new_status FROM teacher_attendance_correction WHERE teacher_id='${T['Tara Bose']}' ORDER BY id DESC LIMIT 1`);
  if (!row.startsWith(`${T['Sunita Rao']}|COORDINATOR|LATE`)) throw new Error(`db: ${row}`);
  const text = await p.innerText('body');
  if (!/Corrected by Sunita Rao \(Coordinator\)/.test(text)) throw new Error('list does not show the coordinator');
  return row;
});
await check('UI · Staff attendance', 'own and another Coordinator\'s records are read-only in the list', async () => {
  const own = p.locator('.sa-teacher-card.sa-card-readonly').filter({ hasText: 'Sunita Rao' });
  const other = p.locator('.sa-teacher-card.sa-card-readonly').filter({ hasText: /Arjun Das|Kiran Mehta/ });
  return { ownReadOnly: await own.count(), otherCoordinatorReadOnly: await other.count() };
});
await check('UI · Substitutions', 'assign a substitute for the uncovered 9-B period', async () => {
  await p.goto(WEB + '/dashboard/teacher-substitutions'); await settle(p, 2000);
  const before = sql(`SELECT count(*) FROM teacher_substitution WHERE school_id=1 AND status='ACTIVE'`);
  const btn = p.locator('button.primary', { hasText: 'Assign suggested' }).first();
  if (!(await btn.count())) throw new Error('no Assign suggested button');
  await btn.click(); await p.waitForTimeout(800); await confirmDialog(); await settle(p, 800);
  const after = sql(`SELECT count(*) FROM teacher_substitution WHERE school_id=1 AND status='ACTIVE'`);
  if (Number(after) !== Number(before) + 1) throw new Error(`${before} -> ${after}`);
  return sql(`SELECT username||'|'||role||'|'||action FROM audit_log WHERE action='ASSIGN_TEACHER_SUBSTITUTION' ORDER BY id DESC LIMIT 1`);
});
await check('UI · Report cards', 'open 8-B, request a correction with a reason; the class teacher is notified', async () => {
  await p.goto(WEB + '/dashboard/report-card-review'); await settle(p, 2500);
  const card = p.locator('.cr-card').filter({ hasText: /8-B|Class 8-B/ }).first();
  if (!(await card.count())) throw new Error('no 8-B card');
  await card.click(); await settle(p, 2000);
  await p.locator('.cr-btn', { hasText: /Request correction/i }).first().click(); await settle(p, 500);
  await p.fill('textarea[name="reason"]', 'Synthetic UI: English marks missing');
  await p.click('.cr-btn.cr-primary'); await settle(p, 1500);
  const row = sql(`SELECT teacher_id||'|'||requested_by||'|'||reason FROM report_card_correction_request ORDER BY id DESC LIMIT 1`);
  if (!row.startsWith(`${T['Omar Sheikh']}|${T['Sunita Rao']}`)) throw new Error(row);
  const approve = await p.locator('button', { hasText: /^\s*(Approve|Publish|Sign)/i }).count();
  if (approve) throw new Error(`${approve} approval/publication buttons visible`);
  return row;
});
await check('UI · Student attendance', 'mark an unmarked in-scope section from Student attendance with a reason', async () => {
  await p.goto(WEB + '/dashboard/coordinator-attendance'); await settle(p, 2000);
  const chips = p.locator('.ta-chips-wrap').first().locator('button.ta-chip');
  const names = await chips.allInnerTexts();
  await chips.filter({ hasText: /^\s*10\s*$/ }).first().click(); await settle(p, 1000);
  await p.locator('.ta-chips-wrap').nth(1).locator('button.ta-chip').filter({ hasText: /^\s*B\s*$/ }).first().click(); await settle(p, 1500);
  await p.fill('.ta-correction textarea', 'Synthetic UI: class teacher away');
  await p.click('.ta-btn-save'); await p.waitForTimeout(800); await confirmDialog(); await settle(p, 1000);
  const row = sql(`SELECT a.marked_by_user_id FROM attendance_session a WHERE a.school_id=1 AND a.section_id=${ids.sections['10-B'].sectionId} AND a.attendance_date='2026-11-11'`);
  if (row !== T['Sunita Rao']) throw new Error(`session marked by "${row}" (chips: ${names.slice(0, 12).join(',')})`);
  return sql(`SELECT username||'|'||role||'|'||new_value FROM audit_log WHERE action='SAVE_ATTENDANCE' ORDER BY id DESC LIMIT 1`).slice(0, 160);
});
await check('UI · Appointments', 'Admin appoints Tara Bose for class 7 from the Coordinators page', async () => {
  const admin = await session(browser, 'E2E-ADMIN');
  const a = admin.page;
  await a.goto(WEB + '/dashboard/coordinator-management'); await settle(a, 2000);
  await a.click('button.cm-appoint'); await a.waitForTimeout(600);
  const opts = await a.$$eval('select[name="teacher"] option', os => os.map(o => ({ v: o.value, t: o.textContent })));
  await a.selectOption('select[name="teacher"]', opts.find(o => o.t.includes('Tara Bose')).v);
  await a.locator('button.cm-class').filter({ hasText: /^\s*(Class )?7\s*$/ }).first().click();
  await a.locator('.cm-pick').first().locator('button.cm-chip', { hasText: /^\s*A\s*$/ }).click();
  await a.locator('button.cm-btn.cm-primary').click(); await a.waitForTimeout(1500);
  const row = sql(`SELECT a.teacher_id||'|'||a.appointed_by||'|'||c.name FROM coordinator_appointment a JOIN coordinator_scope s ON s.appointment_id=a.id JOIN school_class c ON c.id=s.class_id WHERE a.active AND a.teacher_id='${T['Tara Bose']}'`);
  if (!row.endsWith('|E2E-ADMIN|7')) throw new Error(row);
  const sec = sql(`SELECT sec.name FROM coordinator_scope s JOIN coordinator_appointment a ON a.id=s.appointment_id JOIN section sec ON sec.id=s.section_id WHERE a.active AND a.teacher_id='${T['Tara Bose']}'`);
  if (sec !== 'A') throw new Error(`section ${sec}`);
  await admin.context.close();
  return row;
});
const issues = sunita.log.api.filter(x => x.page !== '/home' && (x.status >= 500 || (x.status >= 400 && !x.url.includes('/coordinators'))));
await check('UI · Network', 'no unexpected API errors during the UI flows', async () => { if (issues.length) throw new Error(issues.map(i => `${i.status} ${i.method} ${i.url} @${i.page}`).join(' | ')); if (sunita.log.pageErrors.length) throw new Error(sunita.log.pageErrors.map(e => e.text).join(' | ')); });
await browser.close();
done();
