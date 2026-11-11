// Communication edits, notification delivery for Coordinator actions, Principal regression.
import { as, check, expectStatus, assert, done, T, S, ST, ids } from './harness.mjs';
import { sql } from './api.mjs';
import { randomUUID } from 'node:crypto';
const ev = (aud, title = 'Synthetic event') => ({ requestId: randomUUID(), title, description: 'Synthetic', startDate: '2026-11-29', category: 'ACADEMIC', targetAudience: aud });
await check('Communication', 'coordinator edits own class event; cannot edit or delete a school-wide event', async () => {
  const admin = await as('E2E-ADMIN');
  const schoolWide = await admin.ok('POST', '/events', ev(['ALL'], 'Synthetic annual day'));
  const s = await as('Sunita Rao');
  const mine = await s.ok('POST', '/events', ev(['8'], 'Synthetic class 8 trip'));
  const { requestId, ...edit } = ev(['8'], 'Synthetic class 8 trip (moved)');
  await s.ok('PUT', `/events/${mine.id}`, edit);
  expectStatus(await s.req('PUT', `/events/${mine.id}`, { ...edit, targetAudience: ['ALL'] }), 403);
  expectStatus(await s.req('PUT', `/events/${schoolWide.id}`, { ...edit, targetAudience: ['8'] }), 403);
  expectStatus(await s.req('DELETE', `/events/${schoolWide.id}`), 403);
  expectStatus(await (await as('Kiran Mehta')).req('DELETE', `/events/${mine.id}`), 403);
  return sql(`SELECT username||'|'||role||'|'||action FROM audit_log WHERE action LIKE '%EVENT%' AND username='${T['Sunita Rao']}' ORDER BY id DESC LIMIT 2`).split('\n');
});
await check('Communication', 'a class notice reaches that class only', async () => {
  await (await as('Sunita Rao')).ok('POST', '/admin/notice', { title: 'Synthetic class 7 notice', body: 'Lab day.', targetClass: '7', deliveryMode: 'IN_APP' });
  const recipients = sql(`SELECT string_agg(DISTINCT coalesce(s.class_name,'?'), ',') FROM user_notifications un JOIN notifications n ON n.id=un.notification_id LEFT JOIN student s ON s.student_id=un.user_id WHERE n.title='Synthetic class 7 notice'`);
  assert(recipients === '7', `recipient classes: ${recipients}`);
  return recipients;
});
await check('Notifications', 'report-card correction request notifies the responsible class teacher (live stack)', async () => {
  const s = await as('Sunita Rao');
  const rows = await s.ok('GET', '/coordinator/report-cards');
  const r = rows.find(x => x.className === '8' && x.sectionName === 'A');
  await s.ok('POST', `/coordinator/report-cards/${r.setupId}/correction-requests`, { sectionId: r.sectionId, reason: 'Synthetic: remarks missing', studentId: null });
  const n = sql(`SELECT count(*) FROM user_notifications un JOIN notifications n ON n.id=un.notification_id WHERE un.user_id='${T['Ravi Kumar']}' AND n.event_code='REPORT_CARD_CORRECTION_REQUESTED'`);
  assert(Number(n) >= 1, `class teacher notifications: ${n}`);
  return n;
});
await check('Notifications', 'an appointment notifies the appointed teacher (live stack)', async () => {
  const n = sql(`SELECT count(*) FROM user_notifications un JOIN notifications n ON n.id=un.notification_id WHERE un.user_id='${T['Sunita Rao']}' AND n.source_entity_type='COORDINATOR_APPOINTMENT'`);
  assert(Number(n) >= 1, `appointment notifications: ${n}`);
  return n;
});
await check('Principal regression', 'Principal schedules an assessment (previously failed on the role check)', async () => {
  const p = await as(ids.principal);
  const r = await p.ok('POST', '/assessments', { classId: S['8-A'].classId, sectionId: S['8-A'].sectionId, subjectName: 'Science', assessmentType: 'CLASS_TEST', title: 'Principal quiz', assessmentDate: '2026-11-21', syllabus: 'Ch 1' });
  return sql(`SELECT created_by_role FROM assessment WHERE id=${r.id}`);
});
await check('Principal regression', 'Principal staff correction is attributed to the Principal', async () => {
  const p = await as(ids.principal);
  await p.ok('POST', '/principal/staff-attendance/corrections', { teacherId: T['Farhan Ali'], date: '2026-11-11', status: 'ON_TIME', checkInTime: '07:58', reason: 'Synthetic: biometric fault' });
  const row = sql(`SELECT marked_by_name||'|'||marked_by_role||'|'||method FROM teacher_attendance WHERE teacher_id='${T['Farhan Ali']}' AND date='2026-11-11'`);
  assert(row === 'Pallavi Principal|PRINCIPAL|MANUAL_CORRECTION', row);
  return row;
});
done();
