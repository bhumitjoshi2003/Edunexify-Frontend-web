// Appointments, directories, revocation, staff and student attendance.
import { as, forget, check, expectStatus, assert, lastAudit, done, T, S, C, ST, ids } from './harness.mjs';
import { sql } from './api.mjs';
const admin = await as('E2E-ADMIN');

await check('Appointments', 'list shows three coordinators with scopes', async () => {
  const list = await admin.ok('GET', '/coordinators');
  assert(list.length === 3, `got ${list.length}`);
  const sunita = list.find(a => a.teacherId === T['Sunita Rao']);
  assert(sunita.scope.length === 5, 'Sunita covers 5 classes');
  return list.map(a => `${a.teacherName}: ${a.scope.map(s => s.className + (s.sectionName ? '-' + s.sectionName : '')).join(',')}`);
});
await check('Appointments', 'duplicate active appointment is refused (409)', async () =>
  expectStatus(await admin.req('POST', '/coordinators', { teacherId: T['Sunita Rao'], scope: [{ classId: C['9'], sectionId: null, streamId: null }] }), 409));
await check('Appointments', 'another school\'s class or teacher is refused (400)', async () => {
  expectStatus(await admin.req('POST', '/coordinators', { teacherId: T['Tara Bose'], scope: [{ classId: ids.other.classId, sectionId: null, streamId: null }] }), 400);
  expectStatus(await admin.req('POST', '/coordinators', { teacherId: ids.other.teacherId, scope: [{ classId: C['8'], sectionId: null, streamId: null }] }), 400);
});
await check('Appointments', 'section of a different class is refused (400)', async () =>
  expectStatus(await admin.req('POST', '/coordinators', { teacherId: T['Tara Bose'], scope: [{ classId: C['9'], sectionId: S['8-A'].sectionId, streamId: null }] }), 400));
await check('Appointments', 'principal can list; ordinary teacher cannot', async () => {
  expectStatus(await (await as(ids.principal)).req('GET', '/coordinators'), 200);
  expectStatus(await (await as('Ravi Kumar')).req('GET', '/coordinators'), 403);
});
await check('Appointments', 'scope add/remove, end, history, reappoint — teaching assignment kept', async () => {
  const before = sql(`SELECT class_teacher||'/'||coalesce(class_teacher_section_id::text,'') FROM teacher WHERE teacher_id='${T['Arjun Das']}'`);
  const a = (await admin.ok('GET', '/coordinators')).find(x => x.teacherId === T['Arjun Das']);
  const wider = await admin.ok('PUT', `/coordinators/${a.id}`, { scope: [{ classId: C['8'], sectionId: S['8-A'].sectionId, streamId: null }, { classId: C['9'], sectionId: S['9-A'].sectionId, streamId: null }] });
  assert(wider.scope.length === 2, 'added 9-A');
  await admin.ok('PUT', `/coordinators/${a.id}`, { scope: [{ classId: C['8'], sectionId: S['8-A'].sectionId, streamId: null }] });
  expectStatus(await admin.req('POST', `/coordinators/${a.id}/remove`, { reason: ' ' }), 400);
  await admin.ok('POST', `/coordinators/${a.id}/remove`, { reason: 'Synthetic: scope moved' });
  const history = await admin.ok('GET', '/coordinators?includeRemoved=true');
  assert(history.some(x => x.id === a.id && !x.active && x.removalReason === 'Synthetic: scope moved'), 'history kept');
  const again = await admin.ok('POST', '/coordinators', { teacherId: T['Arjun Das'], scope: [{ classId: C['8'], sectionId: S['8-A'].sectionId, streamId: null }] });
  assert(again.active && again.id !== a.id, 'reappointed as a new appointment');
  const after = sql(`SELECT class_teacher||'/'||coalesce(class_teacher_section_id::text,'') FROM teacher WHERE teacher_id='${T['Arjun Das']}'`);
  assert(before === after, 'teaching assignment unchanged');
  return [lastAudit('APPOINT_COORDINATOR'), lastAudit('UPDATE_COORDINATOR_SCOPE'), lastAudit('REMOVE_COORDINATOR')];
});

await check('Session', '/auth/me marks a coordinating teacher; role stays TEACHER', async () => {
  const me = await (await as('Sunita Rao')).ok('GET', '/auth/me');
  assert(me.role === 'TEACHER' && me.coordinator === true && me.primaryRole === 'COORDINATOR', JSON.stringify(me).slice(0, 200));
  const r = await (await as('Ravi Kumar')).ok('GET', '/auth/me');
  assert(r.coordinator === false, 'plain teacher');
});
await check('Session', 'refresh keeps the coordinator identity', async () => {
  const s = await as('Sunita Rao');
  const r = await s.req('POST', '/auth/refresh-token', {});
  expectStatus(r, 200);
  const me = await s.ok('GET', '/auth/me');
  assert(me.coordinator === true, 'still coordinator after refresh');
});

await check('Directories', 'school-wide teacher list and details for every coordinator (incl. single-section scope)', async () => {
  for (const who of ['Sunita Rao', 'Arjun Das', 'Kiran Mehta']) {
    const list = await (await as(who)).ok('GET', '/principal/teachers');
    assert(list.length === 10, `${who} sees ${list.length} teachers`);
    assert(!list.some(t => t.teacherId === ids.other.teacherId), 'no other-school teacher');
    await (await as(who)).ok('GET', `/principal/teachers/${T['Kiran Mehta']}`);
  }
});
await check('Directories', 'student search and details are school-wide read; other school hidden', async () => {
  const arjun = await as('Arjun Das');
  const found = await arjun.ok('GET', '/principal/students?q=Student 3A');
  assert(found.length >= 3, `found ${found.length}`);
  await arjun.ok('GET', `/principal/students/${ST['Student 3A1']}`);
  expectStatus(await arjun.req('GET', `/principal/students/${ids.other.studentId}`), 404, 403);
  expectStatus(await arjun.req('GET', `/principal/teachers/${ids.other.teacherId}`), 404, 403);
});
await check('Directories', 'ordinary teacher cannot use leadership directories', async () => {
  expectStatus(await (await as('Ravi Kumar')).req('GET', '/principal/teachers'), 403);
  expectStatus(await (await as('Ravi Kumar')).req('GET', '/principal/students?q=Student'), 403);
});
await check('Directories', 'coordinator cannot edit a teacher or student record', async () => {
  const s = await as('Sunita Rao');
  expectStatus(await s.req('PUT', `/teachers/${T['Ravi Kumar']}`, { name: 'Hacked' }), 403);
  expectStatus(await s.req('PUT', `/students/${ST['Student 8A1']}`, { name: 'Hacked' }), 403);
});

// ── Staff attendance ──
const today = '2026-11-11';
await check('Staff attendance', 'coordinator corrects an ordinary teacher (any scope) with a reason', async () => {
  const kiran = await as('Kiran Mehta');   // Omar (8-B) is outside Kiran's classes 1–5
  globalThis.adminMarksBefore = sql(`SELECT count(*) FROM audit_log WHERE action='ADMIN_MARK_TEACHER_ATTENDANCE' AND username='${T['Kiran Mehta']}'`);
  const rec = await kiran.ok('POST', '/coordinator/staff-attendance/corrections', { teacherId: T['Omar Sheikh'], date: today, status: 'LATE', checkInTime: '08:20', reason: 'Synthetic: register shows late arrival' });
  const row = sql(`SELECT corrected_by||'|'||corrected_by_role||'|'||coalesce(previous_status,'-')||'>'||new_status FROM teacher_attendance_correction WHERE teacher_id='${T['Omar Sheikh']}' ORDER BY id DESC LIMIT 1`);
  assert(row.startsWith(`${T['Kiran Mehta']}|COORDINATOR|ON_TIME>LATE`), row);
  return { row, audit: lastAudit('CORRECT_TEACHER_ATTENDANCE', T['Kiran Mehta']), record: rec };
});
await check('Staff attendance', 'the corrected record is attributed to the coordinator, not Admin', async () => {
  const day = await (await as('Sunita Rao')).ok('GET', `/coordinator/staff-attendance/date/${today}`);
  const omar = day.find(r => r.teacherId === T['Omar Sheikh']);
  const extra = sql(`SELECT count(*) FROM audit_log WHERE action='ADMIN_MARK_TEACHER_ATTENDANCE' AND username='${T['Kiran Mehta']}'`);
  assert(extra === globalThis.adminMarksBefore, `Coordinator correction also logged as ADMIN_MARK_TEACHER_ATTENDANCE (${globalThis.adminMarksBefore} -> ${extra})`);
  assert(omar.markedByRole === 'COORDINATOR' && omar.markedByName === 'Kiran Mehta' && omar.method === 'MANUAL_CORRECTION',
    `record says method=${omar.method} markedByRole=${omar.markedByRole} markedByName=${omar.markedByName}`);
  const hist = await (await as('Sunita Rao')).ok('GET', `/coordinator/staff-attendance/corrections?teacherId=${T['Omar Sheikh']}`);
  assert(hist[0].correctedByName === 'Kiran Mehta' && hist[0].correctedByRole === 'COORDINATOR', JSON.stringify(hist[0]));
  return { markedBy: `${omar.markedByName} (${omar.markedByRole})`, method: omar.method, history: `${hist[0].correctedByName} (${hist[0].correctedByRole})` };
});
await check('Staff attendance', 'own, Principal and another Coordinator are protected (direct API)', async () => {
  const s = await as('Sunita Rao');
  const body = id => ({ teacherId: id, date: today, status: 'ON_TIME', checkInTime: '07:55', reason: 'Synthetic' });
  expectStatus(await s.req('POST', '/coordinator/staff-attendance/corrections', body(T['Sunita Rao'])), 403);
  expectStatus(await s.req('POST', '/coordinator/staff-attendance/corrections', body(T['Arjun Das'])), 403);
  expectStatus(await s.req('POST', '/coordinator/staff-attendance/corrections', body(ids.principal)), 403, 404);
  expectStatus(await s.req('POST', '/coordinator/staff-attendance/corrections', body(ids.other.teacherId)), 404, 403);
  expectStatus(await s.req('POST', '/coordinator/staff-attendance/corrections', { ...body(T['Tara Bose']), reason: '' }), 400);
});
await check('Staff attendance', 'ordinary teacher cannot correct staff attendance', async () =>
  expectStatus(await (await as('Ravi Kumar')).req('POST', '/coordinator/staff-attendance/corrections', { teacherId: T['Tara Bose'], date: today, status: 'ON_TIME', reason: 'x' }), 403));

// ── Student attendance ──
await check('Student attendance', 'coordinator marks an unmarked in-scope section with a reason; audit says COORDINATOR', async () => {
  const s = await as('Sunita Rao');
  let key, sheet;
  for (key of ['8-A', '9-A', '7-B', '10-B', '9-B']) {
    sheet = await s.ok('GET', `/attendance/sheet?classId=${S[key].classId}&sectionId=${S[key].sectionId}`);
    if (!sheet.submitted && sheet.students.length) break;
  }
  assert(!sheet.submitted, `${key} unmarked today`);
  const body = { classId: S[key].classId, sectionId: S[key].sectionId, date: sheet.date, students: sheet.students.map(x => ({ studentId: x.studentId, status: 'PRESENT' })) };
  expectStatus(await s.req('PUT', '/attendance/sheet', body), 400);
  await s.ok('PUT', '/attendance/sheet', { ...body, correctionReason: 'Synthetic: class teacher on leave' });
  return lastAudit('SAVE_ATTENDANCE', T['Sunita Rao']);
});
await check('Student attendance', 'outside scope is refused (Kiran on 8-A, Arjun on 8-B)', async () => {
  expectStatus(await (await as('Kiran Mehta')).req('GET', `/attendance/sheet?classId=${S['8-A'].classId}&sectionId=${S['8-A'].sectionId}`), 403);
  expectStatus(await (await as('Arjun Das')).req('PUT', '/attendance/sheet', { classId: S['8-B'].classId, sectionId: S['8-B'].sectionId, date: today, students: [], correctionReason: 'x' }), 403, 400);
});
await check('Student attendance', 'class teacher marking own class in Teacher work stays TEACHER (no reason)', async () => {
  const s = await as('Sunita Rao');
  const sheet = await s.ok('GET', '/attendance/sheet');
  await s.ok('PUT', '/attendance/sheet', { classId: null, sectionId: null, date: sheet.date, students: sheet.students.map(x => ({ studentId: x.studentId, status: 'PRESENT' })) });
  const role = sql(`SELECT role FROM audit_log WHERE school_id=1 AND action='SAVE_ATTENDANCE' AND username='${T['Sunita Rao']}' ORDER BY id DESC LIMIT 1`);
  assert(role === 'TEACHER', role);
});
await check('Student attendance', 'summary and totals for a section', async () => {
  const r = await (await as('Sunita Rao')).ok('GET', `/attendance/summary/class/8?sectionId=${S['8-A'].sectionId}&type=month&month=11&year=2026`);
  return r.slice(0, 2);
});
done();
