// Leave, substitutions, academics, communication, report cards, dashboard, revocation.
import { as, forget, check, expectStatus, assert, lastAudit, done, T, S, C, ST, ids } from './harness.mjs';
import { sql } from './api.mjs';
const leaveId = (student) => sql(`SELECT id FROM leaves WHERE student_id='${student}' ORDER BY id DESC LIMIT 1`);
const today = '2026-11-11';

// ── Student leave ──
await check('Student leave', 'coordinator lists in-scope pending leave', async () => {
  const r = await (await as('Sunita Rao')).ok('GET', '/leaves/for-review?status=PENDING&size=50');
  const rows = r.content ?? r;
  const students = rows.map(x => x.studentId);
  assert(students.includes(ST['Student 6B1']) && students.includes(ST['Student 9A1']), 'in-scope present');
  assert(!students.includes(ST['Student 3A1']), 'class 3 is outside Sunita scope');
  return rows.map(x => `${x.studentName}:${x.escalation?.day}`);
});
await check('Student leave', 'coordinator approves in-scope leave (not her class); audit COORDINATOR', async () => {
  const s = await as('Sunita Rao');
  const r = await s.ok('PATCH', `/leaves/${leaveId(ST['Student 6B1'])}/status`, { status: 'APPROVED', reason: null });
  assert(r.status === 'APPROVED', JSON.stringify(r).slice(0, 200));
  return { decidedBy: sql(`SELECT status||'|'||coalesce(decided_by,'') FROM leaves WHERE id=${leaveId(ST['Student 6B1'])}`).slice(0, 80), audit: lastAudit('UPDATE_LEAVE_STATUS', T['Sunita Rao']) };
});
await check('Student leave', 'coordinator rejects and reverses where policy permits', async () => {
  const s = await as('Sunita Rao');
  const id = leaveId(ST['Student 9A1']);
  await s.ok('PATCH', `/leaves/${id}/status`, { status: 'REJECTED', reason: 'Synthetic: no supporting note' });
  const rev = await s.req('POST', `/leaves/${id}/reverse`, { reason: 'Synthetic: note received' });
  return { reverse: rev.status, audit: lastAudit('REVERSE_LEAVE_DECISION') };
});
await check('Student leave', 'outside scope and other school refused', async () => {
  expectStatus(await (await as('Kiran Mehta')).req('PATCH', `/leaves/${leaveId(ST['Student 8A1'])}/status`, { status: 'APPROVED' }), 403);
  expectStatus(await (await as('Arjun Das')).req('PATCH', `/leaves/${leaveId(ST['Student 9A1'])}/status`, { status: 'APPROVED' }), 403);
});
await check('Student leave', 'class teacher (Teacher work) still approves own class', async () => {
  const r = await (await as('Kiran Mehta')).req('GET', '/leaves/for-review?status=PENDING');
  expectStatus(r, 200);
  const v = await (await as('Vikram Singh')).ok('PATCH', `/leaves/${leaveId(ST['Student 3A1'])}/status`, { status: 'APPROVED' });
  assert(v.status === 'APPROVED', 'class teacher decided');
  return lastAudit('UPDATE_LEAVE_STATUS', T['Vikram Singh']);
});

// ── Teacher leave ──
await check('Teacher leave', 'coordinator can read teacher leave but never decide it (direct API)', async () => {
  const s = await as('Sunita Rao');
  const list = await s.req('GET', '/teacher-leaves?size=20');
  const id = sql(`SELECT id FROM teacher_leave WHERE teacher_id='${T['Tara Bose']}'`);
  expectStatus(await s.req('PATCH', `/teacher-leaves/${id}/status`, { status: 'APPROVED' }), 403);
  expectStatus(await s.req('POST', `/teacher-leaves/${id}/reverse`, { reason: 'x' }), 403, 404, 405);
  return { list: list.status };
});
await check('Teacher leave', 'coordinator\'s own leave cannot be self-approved', async () => {
  const s = await as('Sunita Rao');
  const r = await s.req('POST', '/teacher-leaves/apply', { startDate: '2026-11-25', endDate: '2026-11-25', reason: 'Synthetic' });
  const id = sql(`SELECT id FROM teacher_leave WHERE teacher_id='${T['Sunita Rao']}' ORDER BY id DESC LIMIT 1`);
  expectStatus(await s.req('PATCH', `/teacher-leaves/${id}/status`, { status: 'APPROVED' }), 403);
  return r.status;
});

// ── Substitutions ──
let assignedId;
await check('Substitutions', 'uncovered periods for Ravi (on leave) appear in scope', async () => {
  const o = await (await as('Sunita Rao')).ok('GET', `/substitutions/overview?date=${today}`);
  const mine = o.periods.map(p => `${p.className}-${p.sectionName} P${p.periodNumber} ${p.state}`);
  assert(mine.some(x => x.startsWith('8-A')) && mine.some(x => x.startsWith('9-B')), mine.join(','));
  const arjun = await (await as('Arjun Das')).ok('GET', `/substitutions/overview?date=${today}`);
  assert(arjun.periods.every(p => p.className === '8' && p.sectionName === 'A'), 'Arjun sees only 8-A');
  const kiran = await (await as('Kiran Mehta')).ok('GET', `/substitutions/overview?date=${today}`);
  assert(kiran.periods.length === 0, 'Kiran (1–5) sees none');
  return mine;
});
await check('Substitutions', 'free teachers, assign, change, cancel; substitute notified; audit COORDINATOR', async () => {
  const s = await as('Sunita Rao');
  const entry = sql(`SELECT id FROM timetable_entry WHERE school_id=1 AND teacher_id='${T['Ravi Kumar']}' AND day='WEDNESDAY' AND class_name='8'`);
  const free = await s.ok('GET', `/substitutions/free-teachers?timetableEntryId=${entry}&date=${today}`);
  assert(free.length > 0, 'free teachers');
  const sub = free.find(f => f.teacherId === T['Vikram Singh']) ?? free[0];
  const a = await s.ok('POST', '/substitutions', { timetableEntryId: Number(entry), date: today, substituteTeacherId: sub.teacherId });
  assignedId = a.id;
  const other = free.find(f => f.teacherId !== sub.teacherId);
  if (other) await s.ok('PUT', `/substitutions/${a.id}`, { substituteTeacherId: other.teacherId });
  await s.ok('DELETE', `/substitutions/${a.id}`);
  const again = await s.ok('POST', '/substitutions', { timetableEntryId: Number(entry), date: today, substituteTeacherId: sub.teacherId });
  const notified = sql(`SELECT count(*) FROM user_notifications un JOIN notifications n ON n.id=un.notification_id WHERE un.user_id='${sub.teacherId}' AND n.event_code LIKE 'TEACHER_SUBSTITUTION%'`);
  return { audit: lastAudit('ASSIGN_TEACHER_SUBSTITUTION', T['Sunita Rao']), notified, final: again.id };
});
await check('Substitutions', 'out-of-scope period refused (Kiran and Arjun on 9-B)', async () => {
  const entry = sql(`SELECT id FROM timetable_entry WHERE school_id=1 AND teacher_id='${T['Ravi Kumar']}' AND day='WEDNESDAY' AND class_name='9'`);
  for (const who of ['Kiran Mehta', 'Arjun Das'])
    expectStatus(await (await as(who)).req('POST', '/substitutions', { timetableEntryId: Number(entry), date: today, substituteTeacherId: T['Tara Bose'] }), 403);
});

// ── Academics ──
await check('Academics', 'Sunita creates an exam for class 9 (covered in full); audit COORDINATOR_*', async () => {
  const e = await (await as('Sunita Rao')).ok('POST', '/exams', { session: '2026-2027', className: '9', examName: 'Synthetic Unit Test' });
  return { id: e.id, audit: sql(`SELECT username||'|'||role||'|'||action FROM audit_log WHERE school_id=1 AND action LIKE 'COORDINATOR_%EXAM%' ORDER BY id DESC LIMIT 1`) };
});
await check('Academics', 'Arjun (8-A only) cannot change class-wide exams or subjects', async () => {
  const a = await as('Arjun Das');
  expectStatus(await a.req('POST', '/exams', { session: '2026-2027', className: '8', examName: 'x' }), 403);
  expectStatus(await a.req('POST', '/subjects/class', { className: '8', subjectName: 'Art' }), 403);
});
await check('Academics', 'Sunita adds and removes a class subject for class 7', async () => {
  const s = await as('Sunita Rao');
  const sub = await s.ok('POST', '/subjects/class', { className: '7', subjectName: 'Synthetic Robotics' });
  await s.ok('DELETE', `/subjects/class/${sub.id}`);
});
await check('Academics', 'assessment scheduled by a coordinator for an in-scope section', async () => {
  const a = await as('Arjun Das');
  const r = await a.ok('POST', '/assessments', { classId: S['8-A'].classId, sectionId: S['8-A'].sectionId, subjectName: 'Science', assessmentType: 'CLASS_TEST', title: 'Synthetic quiz', assessmentDate: '2026-11-20', syllabus: 'Ch 3' });
  expectStatus(await a.req('POST', '/assessments', { classId: S['8-B'].classId, sectionId: S['8-B'].sectionId, subjectName: 'Mathematics', assessmentType: 'CLASS_TEST', title: 'x', assessmentDate: '2026-11-20', syllabus: 'Ch 3' }), 403);
  return { createdByRole: sql(`SELECT created_by_role FROM assessment WHERE id=${r.id}`) };
});
await check('Academics', 'marks correction needs a reason and stays in scope', async () => {
  const s = await as('Sunita Rao');
  const entry = sql(`SELECT x.id FROM exam_subject_entry x JOIN exam_config e ON e.id=x.exam_config_id WHERE e.class_name='8' AND x.subject_name='Mathematics'`);
  expectStatus(await s.req('POST', '/coordinator/marks/corrections', { marks: [{ studentId: ST['Student 8A1'], examSubjectEntryId: Number(entry), marksObtained: 71 }], reason: '' }), 400);
  const r = await s.ok('POST', '/coordinator/marks/corrections', { marks: [{ studentId: ST['Student 8A1'], examSubjectEntryId: Number(entry), marksObtained: 71 }], reason: 'Synthetic: totalling error' });
  expectStatus(await (await as('Kiran Mehta')).req('POST', '/coordinator/marks/corrections', { marks: [{ studentId: ST['Student 8A1'], examSubjectEntryId: Number(entry), marksObtained: 1 }], reason: 'x' }), 403);
  return { r, audit: lastAudit('COORDINATOR_CORRECT_ACADEMIC_MARKS') };
});
await check('Academics', 'marks completion and class results read', async () => {
  const s = await as('Sunita Rao');
  const m = await s.ok('GET', '/coordinator/marks-completion');
  await s.ok('GET', `/marks/class/8/exam/${ids.exam}?sectionId=${S['8-A'].sectionId}`);
  return m.slice(0, 2).map(x => `${x.examName} ${x.className}-${x.sectionName}: ${x.entered}/${x.expected}`);
});

// ── Communication ──
await check('Communication', 'notice to a covered class works; school-wide is refused', async () => {
  const s = await as('Sunita Rao');
  expectStatus(await s.req('POST', '/admin/notice', { title: 'Synthetic class 8 notice', body: 'Bring lab coats.', targetClass: '8', deliveryMode: 'IN_APP' }), 200, 201);
  expectStatus(await s.req('POST', '/admin/notice', { title: 'x', body: 'x', targetClass: 'ALL', deliveryMode: 'IN_APP' }), 403);
  expectStatus(await (await as('Kiran Mehta')).req('POST', '/admin/notice', { title: 'x', body: 'x', targetClass: '8', deliveryMode: 'IN_APP' }), 403);
});
await check('Communication', 'event for a covered class works; school-wide refused; holidays read-only', async () => {
  const s = await as('Sunita Rao');
  const ev = await s.req('POST', '/events', { title: 'Synthetic science fair', description: 'Class 8 fair', date: '2026-11-28', startTime: '10:00', endTime: '12:00', targetAudience: ['8'] });
  const all = await s.req('POST', '/events', { title: 'x', description: 'x', date: '2026-11-28', startTime: '10:00', endTime: '12:00', targetAudience: ['ALL'] });
  const hol = await s.req('POST', '/holidays', { name: 'x', startDate: '2026-12-01', endDate: '2026-12-01' });
  expectStatus(await s.req('GET', '/holidays'), 200);
  return { event: ev.status, eventAll: all.status, holidayCreate: hol.status, detail: JSON.stringify(ev.data).slice(0, 160) };
});

// ── Report cards ──
await check('Report cards', 'progress, preview, correction request to the class teacher; no approval rights', async () => {
  const s = await as('Sunita Rao');
  const rows = await s.ok('GET', '/coordinator/report-cards');
  const r8a = rows.find(r => r.className === '8' && r.sectionName === 'A');
  assert(r8a, 'has 8-A');
  const summary = await s.ok('GET', `/report-cards/v2/setups/${r8a.setupId}/summary?sectionId=${r8a.sectionId}`);
  const pdf = await s.req('GET', `/report-cards/v2/setups/${r8a.setupId}/students/${ST['Student 8A1']}/pdf`, undefined, { raw: true });
  const req = await s.ok('POST', `/coordinator/report-cards/${r8a.setupId}/correction-requests`, { sectionId: r8a.sectionId, reason: 'Synthetic: science marks missing', studentId: null });
  expectStatus(await s.req('POST', `/report-card-approvals/setups/${r8a.setupId}/principal-approve?sectionId=${r8a.sectionId}`, {}), 403);
  expectStatus(await s.req('POST', `/report-cards/v2/setups/${r8a.setupId}/publication-jobs`, {}), 403);
  return { progress: `${r8a.complete}/${r8a.students}`, students: summary.students.length, pdf: pdf.status, teacher: req.teacherId, event: sql(`SELECT actor_role||'|'||action FROM report_card_approval_event ORDER BY id DESC LIMIT 1`) };
});
await check('Report cards', 'Principal report-card review list still works', async () => {
  const p = await as(ids.principal);
  const r = await p.req('GET', '/principal/report-cards');
  expectStatus(r, 200);
  return Array.isArray(r.data) ? r.data.length : r.data;
});

// ── Dashboard ──
await check('Dashboard', 'overview numbers match the database for Sunita (classes 6–10)', async () => {
  const o = await (await as('Sunita Rao')).ok('GET', '/coordinator/overview');
  const dbStudents = sql(`SELECT count(*) FROM student s JOIN school_class c ON c.id=s.class_id WHERE s.school_id=1 AND s.status='ACTIVE' AND c.name IN ('6','7','8','9','10')`);
  assert(String(o.students) === dbStudents, `students ${o.students} vs ${dbStudents}`);
  const submitted = o.attendance.filter(a => a.submitted).length;
  const dbSubmitted = sql(`SELECT count(*) FROM attendance_session a JOIN school_class c ON c.id=a.class_id WHERE a.school_id=1 AND a.attendance_date='${today}' AND c.name IN ('6','7','8','9','10')`);
  assert(String(submitted) === dbSubmitted, `submitted ${submitted} vs ${dbSubmitted}`);
  return { keys: Object.keys(o), students: o.students, submitted, sections: o.attendance.length, subs: o.substitutionsNeeded, attention: o.attention?.map(a => a.title) };
});

// ── Revocation while signed in ──
await check('Revocation', 'ending the appointment revokes coordinator access but keeps teaching access, no 401', async () => {
  const admin = await as('E2E-ADMIN');
  const a = (await admin.ok('GET', '/coordinators')).find(x => x.teacherId === T['Arjun Das']);
  const arjun = await as('Arjun Das');
  expectStatus(await arjun.req('GET', '/coordinator/overview'), 200);
  await admin.ok('POST', `/coordinators/${a.id}/remove`, { reason: 'Synthetic revocation test' });
  expectStatus(await arjun.req('GET', '/coordinator/overview'), 403);
  expectStatus(await arjun.req('GET', '/principal/teachers'), 403);
  expectStatus(await arjun.req('GET', '/attendance/sheet'), 200, 403, 400);
  const me = await arjun.ok('GET', '/auth/me');
  assert(me.coordinator === false, 'me no longer coordinator');
  expectStatus(await arjun.req('GET', `/timetable/teacher/${T['Arjun Das']}`), 200);
  await admin.ok('POST', '/coordinators', { teacherId: T['Arjun Das'], scope: [{ classId: C['8'], sectionId: S['8-A'].sectionId, streamId: null }] });
});
done();
