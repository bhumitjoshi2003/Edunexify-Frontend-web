// Stage 3: timetable, Coordinator appointments, attendance, leave, exams/marks, report card, notices.
import { Client, sql } from './api.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const ids = JSON.parse(readFileSync(new URL('./ids.json', import.meta.url)));
const T = ids.teachers, S = ids.sections, C = ids.classes;
const admin = await Client.login('E2E-ADMIN');
const session = (await admin.ok('GET', '/academic-sessions/current')).id;
const times = { 1: ['08:00', '08:40'], 2: ['08:40', '09:20'], 3: ['09:20', '10:00'], 4: ['10:20', '11:00'] };
const periods = [
  ['Sunita Rao', '6-A', 'Mathematics', 1], ['Sunita Rao', '7-A', 'Mathematics', 2], ['Sunita Rao', '10-A', 'Mathematics', 3],
  ['Kiran Mehta', '3-A', 'English', 1], ['Arjun Das', '8-B', 'Science', 2], ['Ravi Kumar', '8-A', 'Science', 1],
  ['Ravi Kumar', '9-B', 'Science', 4], ['Meena Iyer', '6-A', 'Hindi', 3], ['Farhan Ali', '7-A', 'English', 4],
  ['Neha Joshi', '9-A', 'Science', 1], ['Tara Bose', '8-A', 'Hindi', 2], ['Tara Bose', '9-B', 'Hindi', 3],
  ['Omar Sheikh', '8-B', 'Mathematics', 1], ['Vikram Singh', '3-A', 'Mathematics', 2],
];
const have = sql(`SELECT count(*) FROM timetable_entry WHERE school_id=1`);
if (have === '0') for (const day of ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'])
  for (const [t, cs, subject, p] of periods) await admin.ok('POST', '/timetable', { academicSessionId: session, classId: S[cs].classId,
    sectionId: S[cs].sectionId, day, periodNumber: p, startTime: times[p][0], endTime: times[p][1], subjectName: subject, teacherId: T[t] });

// Coordinators — A: classes 6–10; B: classes 1–5; C: 8-A only.
const appointed = await admin.ok('GET', '/coordinators');
const want = { 'Sunita Rao': ['6', '7', '8', '9', '10'].map(c => ({ classId: C[c], sectionId: null, streamId: null })),
  'Kiran Mehta': ['1', '2', '3', '4', '5'].map(c => ({ classId: C[c], sectionId: null, streamId: null })),
  'Arjun Das': [{ classId: S['8-A'].classId, sectionId: S['8-A'].sectionId, streamId: null }] };
for (const [name, scope] of Object.entries(want)) if (!appointed.some(a => a.teacherId === T[name]))
  await admin.ok('POST', '/coordinators', { teacherId: T[name], scope });

// Student attendance: 6-A submitted today by its class teacher; 8-A and 9-A left unmarked; 8-A marked on past days.
const meena = await Client.login(T['Meena Iyer']);
const sheet6 = await meena.ok('GET', '/attendance/sheet');
if (!sheet6.submitted) await meena.ok('PUT', '/attendance/sheet', { classId: null, sectionId: null, date: sheet6.date,
  students: sheet6.students.map((s, i) => ({ studentId: s.studentId, status: i === 0 ? 'ABSENT' : 'PRESENT' })) });
const ravi = await Client.login(T['Ravi Kumar']);
for (const d of ['2026-11-09', '2026-11-10']) {
  const sh = await ravi.ok('GET', `/attendance/sheet?date=${d}`);
  if (!sh.submitted && sh.markable) await ravi.ok('PUT', '/attendance/sheet', { classId: null, sectionId: null, date: d,
    students: sh.students.map(s => ({ studentId: s.studentId, status: 'PRESENT' })) });
}

// Student leave: pending requests at Day 1, Day 2, Day 3 and Day 5 (back-dated rows are inserted as history).
const leave = (student, cls, day, status) => sql(`INSERT INTO leaves (applied_date,applied_at,class_name,leave_date,reason,school_id,status,student_id,student_name)
  SELECT TIMESTAMP '${day} 07:00', TIMESTAMPTZ '${day} 07:00+05:30', '${cls}', '${day}', 'Synthetic test leave', 1, '${status}', '${student}', name FROM student WHERE student_id='${student}'
  AND NOT EXISTS (SELECT 1 FROM leaves WHERE student_id='${student}' AND leave_date='${day}')`);
const st = ids.students;
leave(st['Student 8A1'], '8', '2026-11-11', 'PENDING');   // Day 1
leave(st['Student 8A2'], '8', '2026-11-10', 'PENDING');   // Day 2
leave(st['Student 6B1'], '6', '2026-11-09', 'PENDING');   // Day 3
leave(st['Student 9A1'], '9', '2026-11-07', 'PENDING');   // Day 5
leave(st['Student 3A1'], '3', '2026-11-09', 'PENDING');   // Day 3, Coordinator B scope
leave(st['Student 10A1'], '10', '2026-11-12', 'PENDING'); // future

// Teacher leave: Ravi on approved leave today (creates uncovered 8-A / 9-B periods); Tara pending.
if (sql(`SELECT count(*) FROM teacher_leave WHERE school_id=1`) === '0') {
  await ravi.ok('POST', '/teacher-leaves/apply', { startDate: '2026-11-11', endDate: '2026-11-11', reason: 'Synthetic medical leave' });
  const tara = await Client.login(T['Tara Bose']);
  await tara.ok('POST', '/teacher-leaves/apply', { startDate: '2026-11-16', endDate: '2026-11-17', reason: 'Synthetic family function' });
  const rl = sql(`SELECT id FROM teacher_leave WHERE teacher_id='${T['Ravi Kumar']}'`);
  await admin.ok('PATCH', `/teacher-leaves/${rl}/status`, { status: 'APPROVED' });
}

// Staff attendance today: some teachers marked by Admin, others not yet.
for (const [name, status] of [['Meena Iyer', 'ON_TIME'], ['Farhan Ali', 'LATE'], ['Omar Sheikh', 'ON_TIME']])
  await admin.ok('POST', '/teacher-checkin/admin-mark', { teacherId: T[name], date: '2026-11-11', status, checkInTime: status === 'LATE' ? '08:25' : '07:50' });
await admin.ok('POST', '/teacher-checkin/admin-mark', { teacherId: T['Neha Joshi'], date: '2026-11-10', status: 'ON_TIME', checkInTime: '07:45' });

// Exams and partial marks for class 8; a report card setup on top.
let exams = await admin.ok('GET', '/exams?session=2026-2027&className=8');
let exam = exams.find(e => e.examName === 'Term 1');
if (!exam) exam = await admin.ok('POST', '/exams', { session: '2026-2027', className: '8', examName: 'Term 1' });
let subs = await admin.ok('GET', `/exams/${exam.id}/subjects`);
for (const [sub, date] of [['Mathematics', '2026-11-20'], ['Science', '2026-11-21'], ['English', '2026-11-22']])
  if (!subs.some(s => s.subjectName === sub)) await admin.ok('POST', `/exams/${exam.id}/subjects`, { subjectName: sub, maxMarks: 100, examDate: date });
subs = await admin.ok('GET', `/exams/${exam.id}/subjects`);
const math = subs.find(s => s.subjectName === 'Mathematics');
await admin.ok('POST', '/marks/bulk', ['8A1', '8A2', '8A3', '8B1'].map((k, i) => ({ studentId: st[`Student ${k}`], examSubjectEntryId: math.id, marksObtained: 60 + i * 5 })));
const setups = await admin.ok('GET', `/report-cards/v2/setups?academicSessionId=${session}&classId=${C['8']}`);
if (!setups.length) await admin.ok('POST', '/report-cards/v2/setups', { academicSessionId: session, classId: C['8'], name: 'Term 1 Report', resultMode: 'TOTAL',
  displayOrder: 1, terms: [{ key: 't1', name: 'Term 1', weight: null }], exams: [{ examConfigId: exam.id, termKey: 't1', weight: null }] });

// Communication.
if (sql(`SELECT count(*) FROM notifications WHERE school_id=1 AND title='Synthetic PTM notice'`) === '0')
  await admin.ok('POST', '/admin/notice', { title: 'Synthetic PTM notice', body: 'Parent-teacher meeting on Saturday.', targetClass: 'ALL', deliveryMode: 'IN_APP' }).catch(e => console.log('notice', e.message));
ids.session = session; ids.exam = exam.id;
writeFileSync(new URL('./ids.json', import.meta.url), JSON.stringify(ids, null, 2));
console.log('seeded', sql(`SELECT count(*) FROM timetable_entry WHERE school_id=1`), 'periods;', sql(`SELECT count(*) FROM coordinator_appointment`), 'coordinators');
