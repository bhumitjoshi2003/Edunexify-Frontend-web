// Re-checks with corrected request bodies: leave decision record, assessments, events, holidays.
import { as, check, expectStatus, assert, lastAudit, done, T, S, ST } from './harness.mjs';
import { sql } from './api.mjs';
import { randomUUID } from 'node:crypto';
await check('Student leave', 'approval records the coordinator as decider; audit COORDINATOR', async () => {
  const id = sql(`SELECT id FROM leaves WHERE student_id='${ST['Student 6B1']}' ORDER BY id DESC LIMIT 1`);
  return { leave: sql(`SELECT status||'|'||decided_by FROM leaves WHERE id=${id}`), audit: lastAudit('UPDATE_LEAVE_STATUS', T['Sunita Rao']) };
});
await check('Academics', 'assessment scheduled by a coordinator for an in-scope section; refused outside', async () => {
  const a = await as('Arjun Das');
  const body = (k, sub) => ({ classId: S[k].classId, sectionId: S[k].sectionId, subjectName: sub, assessmentType: 'CLASS_TEST', title: `Synthetic quiz ${k}`, assessmentDate: '2026-11-20', syllabus: 'Chapter 4' });
  const r = await a.ok('POST', '/assessments', body('8-A', 'Science'));
  const out = await a.req('POST', '/assessments', body('9-A', 'Science'));
  expectStatus(out, 403);
  return { createdByRole: sql(`SELECT created_by_role FROM assessment WHERE id=${r.id}`) };
});
await check('Communication', 'event for a covered class works; school-wide refused', async () => {
  const s = await as('Sunita Rao');
  const ev = (aud) => ({ requestId: randomUUID(), title: 'Synthetic science fair', description: 'Class 8 fair', startDate: '2026-11-28', category: 'ACADEMIC', targetAudience: aud });
  const ok = await s.req('POST', '/events', ev(['8']));
  expectStatus(ok, 200, 201);
  expectStatus(await s.req('POST', '/events', ev(['ALL'])), 403);
  expectStatus(await (await as('Kiran Mehta')).req('POST', '/events', ev(['8'])), 403);
  return { createdBy: sql(`SELECT created_by FROM events ORDER BY id DESC LIMIT 1`), audit: sql(`SELECT username||'|'||role||'|'||action FROM audit_log WHERE action='CREATE_EVENT' ORDER BY id DESC LIMIT 1`) };
});
await check('Communication', 'holidays: coordinator can read, cannot create', async () => {
  const s = await as('Sunita Rao');
  expectStatus(await s.req('GET', '/holidays'), 200);
  expectStatus(await s.req('POST', '/holidays', { name: 'Synthetic holiday', startDate: '2026-12-01', endDate: '2026-12-01', holidayType: 'SCHOOL', affectsAll: true, academicYear: '2026-2027' }), 403);
});
done();
