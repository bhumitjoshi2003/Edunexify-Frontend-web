// Stage 1: super admin, the isolated test school, plan, admin, session, classes, sections, subjects.
import { Client, sql, hash, SLUG } from './api.mjs';
const H = hash();
sql(`INSERT INTO users(user_id,password,role,active,must_change_password,email) VALUES ('E2E-SUPER','${H}','SUPER_ADMIN',true,false,'super@e2e.invalid') ON CONFLICT DO NOTHING`);
const sa = await Client.login('E2E-SUPER', null);
let school = (await sa.ok('GET', '/super-admin/schools')).find(s => s.slug === SLUG);
if (!school) school = await sa.ok('POST', '/super-admin/schools', {
  name: 'Coordinator Test School (synthetic)', slug: SLUG, boardType: 'CBSE', city: 'Testpur', state: 'Test',
  email: 'office@coordtest.e2e.invalid', phone: '9000000000', contactPersonName: 'Office',
  academicYearStartMonth: 4, workingDays: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY',
  adminUserId: 'E2E-ADMIN', adminEmail: 'admin@coordtest.e2e.invalid', adminName: 'Asha Admin', adminDob: '1985-05-05', adminGender: 'Female', adminPhone: '9000000001', adminPhoneNumber: '9000000001',
});
const schoolId = school.id ?? school.schoolId;
await sa.ok('POST', `/super-admin/schools/${schoolId}/subscription`, { planId: 3, status: 'ACTIVE', activatedAt: '2026-04-01T00:00:00', expiresAt: '2027-12-31T23:59:59' });
sql(`UPDATE users SET password='${H}', must_change_password=false WHERE user_id='E2E-ADMIN'`);
const admin = await Client.login('E2E-ADMIN');
let sessions = await admin.ok('GET', '/academic-sessions');
let cur = sessions.find(s => s.label === '2026-2027');
if (!cur) cur = await admin.ok('POST', '/academic-sessions', { label: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', current: true });
if (!cur.current) await admin.req('PUT', `/academic-sessions/${cur.id}/set-current`, {});
const existing = await admin.ok('GET', '/school/classes/manage');
for (const n of ['1','2','3','4','5','6','7','8','9','10','11','12']) {
  if (!existing.some(c => c.name === n)) await admin.ok('POST', '/school/classes', { name: n });
}
const classes = await admin.ok('GET', '/school/classes/manage');
for (const c of classes) {
  const secs = await admin.ok('GET', `/sections/class/${c.id}`);
  for (const [i, s] of ['A', 'B'].entries()) if (!secs.some(x => x.name === s))
    await admin.ok('POST', '/sections', { classId: c.id, name: s, displayOrder: i + 1, active: true });
  const subs = await admin.ok('GET', `/subjects/class/${c.name}`);
  for (const sub of ['Mathematics', 'English', 'Science', 'Hindi', 'Social Studies'])
    if (!subs.some(x => x.subjectName === sub)) await admin.ok('POST', '/subjects/class', { className: c.name, subjectName: sub });
}
console.log(JSON.stringify({ schoolId, session: cur.id, classes: classes.length }));
