// Browser: Coordinator school-wide directory vs. scoped authority (A 6-10, B 1-5, C 8-A only). See README.md.
import { launch, session, settle, WEB } from './browser.mjs';
import { sql, API } from './api.mjs';
import { T, S, ST, check, assert, done } from './harness.mjs';
const NAMES = ['Sunita Rao','Kiran Mehta','Arjun Das','Ravi Kumar','Meena Iyer','Farhan Ali','Neha Joshi','Vikram Singh','Tara Bose','Omar Sheikh'];
const PLAN = {
  'Sunita Rao': { outside: 'Student 2A1', inside: 'Student 8A1', label: 'A (6-10)', mutate: async p => {
    const before = sql(`SELECT count(*) FROM attendance_session WHERE school_id=1 AND class_id=${S['2-A'].classId} AND section_id=${S['2-A'].sectionId}`);
    const st = await call(p, 'PUT', '/attendance/sheet', { classId: S['2-A'].classId, sectionId: S['2-A'].sectionId, date: '2026-11-11',
      students: [{ studentId: ST['Student 2A1'], status: 'ABSENT' }], correctionReason: 'E2E unauthorized attempt' });
    const after = sql(`SELECT count(*) FROM attendance_session WHERE school_id=1 AND class_id=${S['2-A'].classId} AND section_id=${S['2-A'].sectionId}`);
    return { what: 'mark Class 2-A attendance', status: st, unchanged: before === after };
  } },
  'Kiran Mehta': { outside: 'Student 10A1', inside: 'Student 3A1', label: 'B (1-5)', mutate: async p => {
    const id = sql(`INSERT INTO leaves (applied_date,class_name,leave_date,reason,school_id,status,student_id,student_name) VALUES (CURRENT_TIMESTAMP,'10','2026-11-13','E2E fever',1,'PENDING','${ST['Student 10A1']}','Student 10A1') RETURNING id`).split('\n')[0];
    const st = await call(p, 'PATCH', `/leaves/${id}/status`, { status: 'APPROVED' });
    const after = sql(`SELECT status FROM leaves WHERE id=${id}`);
    sql(`DELETE FROM leaves WHERE id=${id}`);
    return { what: 'approve a Class 10 student leave', status: st, unchanged: after === 'PENDING' };
  } },
  'Arjun Das': { outside: 'Student 8B1', inside: 'Student 8A1', label: 'C (8-A only)', mutate: async p => {
    const before = sql(`SELECT count(*) FROM assessment WHERE school_id=1`);
    const st = await call(p, 'POST', '/assessments', { classId: S['8-B'].classId, sectionId: S['8-B'].sectionId, subjectName: 'Mathematics',
      assessmentType: 'CLASS_TEST', title: 'E2E unauthorized', assessmentDate: '2026-11-20', syllabus: 'x' });
    const st2 = await call(p, 'PUT', '/attendance/sheet', { classId: S['8-B'].classId, sectionId: S['8-B'].sectionId, date: '2026-11-11',
      students: [{ studentId: ST['Student 8B1'], status: 'ABSENT' }], correctionReason: 'E2E unauthorized attempt' });
    return { what: 'schedule an 8-B assessment / mark 8-B attendance', status: `${st}/${st2}`, unchanged: before === sql(`SELECT count(*) FROM assessment WHERE school_id=1`) };
  } },
};
const call = (p, method, path, body) => p.evaluate(async ([base, m, u, b]) => (await fetch(base + u, {
  method: m, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).status, [API, method, path, body]);
const main = p => p.innerText('main');
async function workspace(p, which) {
  await p.click('.hdr-profile-pill'); await p.waitForTimeout(400);
  await p.click(`[data-testid="workspace-${which}"]`); await settle(p, 1200);
}
const only = [process.argv[2]].filter(Boolean);
const b = await launch();
for (const who of only.length ? only : Object.keys(PLAN)) {
  const plan = PLAN[who], area = `Coordinator ${plan.label}`;
  const { page: p, log } = await session(b, T[who]);                                     // 1. log in
  const readErrors = () => log.api.filter(e => e.status >= 400 && !e.deliberate);
  await check(area, '2. switch to the Coordinator workspace', async () => {
    await workspace(p, 'coordinator');
    const nav = await p.innerText('nav, aside, .sidebar').catch(() => '');
    return { url: p.url().replace(WEB, ''), navHasStudents: /Students/.test(nav) };
  });
  await check(area, '3-4. Students page lists classes 1-12; class filter shows an out-of-scope class', async () => {
    await p.goto(WEB + '/dashboard/student-list'); await settle(p);
    const chips = (await p.locator('.sl-chips-wrap').first().locator('button').allInnerTexts()).map(s => s.trim());
    assert(JSON.stringify(chips) === JSON.stringify(['1','2','3','4','5','6','7','8','9','10','11','12']), 'chips ' + chips);
    const cls = plan.outside.match(/Student (\d+)/)[1];
    await p.locator('.sl-chips-wrap').first().locator('button', { hasText: new RegExp(`^\\s*${cls}\\s*$`) }).click(); await settle(p);
    const text = await main(p);
    assert(text.includes(plan.outside), `${plan.outside} not listed under class ${cls}`);
    return { chips: chips.join(','), outsideListed: plan.outside };
  });
  await check(area, '5-6. search an out-of-scope student and open the profile (records note, no error)', async () => {
    await p.goto(WEB + '/dashboard/student-search'); await settle(p, 600);
    await p.fill('.ss-search-input', plan.outside); await settle(p, 1500);
    const row = p.locator('.ss-row', { hasText: plan.outside }).first();
    assert(await row.count(), 'no search result');
    await row.click(); await settle(p);
    assert(p.url().includes(`/student-details/${ST[plan.outside]}`), 'did not open profile: ' + p.url());
    const text = await main(p);
    assert(text.includes(plan.outside) && /PERSONAL INFORMATION/i.test(text), 'profile did not render');
    const note = await p.locator('.sd-scope-note').innerText().catch(() => '');
    assert(/outside your coordination scope/.test(note), 'scope note missing');
    assert(await p.locator('.sd-action-btn', { hasText: 'Attendance' }).count() === 0, 'attendance shortcut shown');
    assert(await p.locator('.td-btn-edit, .sd-btn-edit, button:has-text("Edit")').count() === 0, 'edit control shown');
    return { url: p.url().replace(WEB, ''), note: note.trim() };
  });
  await check(area, '6b. an in-scope student profile keeps the record shortcuts', async () => {
    await p.goto(WEB + `/dashboard/student-details/${ST[plan.inside]}`); await settle(p);
    const actions = (await p.locator('.sd-action-btn').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
    assert(actions.some(a => a.includes('Attendance')) && await p.locator('.sd-scope-note').count() === 0, 'shortcuts ' + actions);
    return { student: plan.inside, actions: actions.join(', ') };
  });
  await check(area, '7. unauthorized academic modification is refused by the backend', async () => {
    const r = await plan.mutate(p);
    log.api.forEach(e => e.deliberate = true);
    assert(String(r.status).split('/').every(s => s === '403'), 'status ' + r.status);
    assert(r.unchanged, 'data changed');
    return r;
  });
  await check(area, '8-9. Teachers page lists every teacher once, without edit controls', async () => {
    await p.goto(WEB + '/dashboard/teacher-list'); await settle(p);
    const items = (await p.locator('li', { has: p.locator('text=/emp_/') }).allInnerTexts()).length;
    const text = await main(p);
    const counts = NAMES.map(n => [n, text.split(n).length - 1]);
    assert(counts.every(([, c]) => c >= 1), 'missing ' + counts.filter(([, c]) => !c).map(([n]) => n));
    const ids = await p.locator('li').evaluateAll(ls => ls.map(l => (l.textContent.match(/emp_\d+/) || [])[0]).filter(Boolean));
    assert(new Set(ids).size === ids.length && ids.length === 10, `ids ${ids.length} unique ${new Set(ids).size}`);
    return { teachers: ids.length, unique: new Set(ids).size };
  });
  await check(area, '10. open another teacher\'s profile: read-only, no password or edit controls', async () => {
    const other = who === 'Kiran Mehta' ? 'Omar Sheikh' : 'Kiran Mehta';
    await p.goto(WEB + `/dashboard/teacher-details/${T[other]}`); await settle(p);
    const text = await main(p);
    assert(text.includes(other), 'profile not rendered');
    assert(await p.locator('.td-btn-pwd').count() === 0, 'password control shown');
    assert(await p.locator('.td-btn-edit, .td-btn-exit').count() === 0, 'edit/exit control shown');
    return { teacher: other };
  });
  await check(area, 'staff attendance teacher filter lists every active teacher', async () => {
    await p.goto(WEB + '/dashboard/staff-attendance'); await settle(p, 2000);
    await p.locator('button', { hasText: 'Individual Teacher' }).first().click(); await settle(p, 1200);
    const options = (await p.locator('select.sa-date-input option').allInnerTexts()).filter(o => /emp_/.test(o));
    assert(options.length === 10, 'options ' + options.length);
    return { teachers: options.length };
  });
  await check(area, 'read pages made no failed API calls', async () => {
    const bad = readErrors(); assert(!bad.length, JSON.stringify(bad).slice(0, 400)); return { failed: 0 };
  });
  await check(area, '11-12. Teacher workspace behaves like an ordinary teacher', async () => {
    await p.goto(WEB + '/dashboard'); await settle(p, 800);
    await workspace(p, 'teacher');
    await p.goto(WEB + '/dashboard/student-list'); await settle(p);
    const chips = await p.locator('.sl-chips-wrap').first().locator('button').count().catch(() => 0);
    await p.goto(WEB + `/dashboard/student-details/${ST[plan.outside]}`); await settle(p);
    const profileUrl = p.url().replace(WEB, '');
    const outsideShown = (await main(p).catch(() => '')).includes('Personal information');
    const nav = await p.locator('nav, aside, .sidebar').first().innerText().catch(() => '');
    const home = p.url().replace(WEB, '');
    await p.goto(WEB + '/dashboard/teacher-list'); await settle(p);
    const tl = p.url().replace(WEB, '');
    assert(chips !== 12, 'class chips 1-12 still shown in Teacher workspace');
    assert(!/Find a student|Coordinator Dashboard|Staff attendance/.test(nav), 'Coordinator navigation shown in Teacher workspace');
    return { classChips: chips, outsideProfile: `${profileUrl} rendered=${outsideShown}`, navHasTeachersDirectory: /\bTeachers\b/.test(nav), directUrlTeacherList: tl };
  });
  await p.context().close();
}
await b.close();
done();
