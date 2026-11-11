// A second synthetic school, only for cross-school isolation checks.
import { Client, sql, hash } from './api.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const ids = JSON.parse(readFileSync(new URL('./ids.json', import.meta.url)));
const H = hash();
const sa = await Client.login('E2E-SUPER', null);
let school = (await sa.ok('GET', '/super-admin/schools')).find(s => s.slug === 'othertest');
if (!school) school = await sa.ok('POST', '/super-admin/schools', { name: 'Other Test School (synthetic)', slug: 'othertest', boardType: 'CBSE',
  city: 'Elsewhere', state: 'Test', email: 'office@othertest.e2e.invalid', phone: '9000000099', contactPersonName: 'Office',
  academicYearStartMonth: 4, workingDays: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY',
  adminUserId: 'E2E-OTHER-ADMIN', adminEmail: 'admin@othertest.e2e.invalid', adminName: 'Other Admin', adminDob: '1980-01-01', adminGender: 'Male', adminPhone: '9000000098' });
const sid = school.id ?? school.schoolId;
await sa.ok('POST', `/super-admin/schools/${sid}/subscription`, { planId: 3, status: 'ACTIVE', activatedAt: '2026-04-01T00:00:00', expiresAt: '2027-12-31T23:59:59' });
sql(`UPDATE users SET password='${H}', must_change_password=false WHERE user_id='E2E-OTHER-ADMIN'`);
const oa = await Client.login('E2E-OTHER-ADMIN', 'othertest');
if (!(await oa.ok('GET', '/academic-sessions')).length) await oa.ok('POST', '/academic-sessions', { label: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', current: true });
if (!(await oa.ok('GET', '/school/classes/manage')).length) await oa.ok('POST', '/school/classes', { name: '8' });
const cls = (await oa.ok('GET', '/school/classes/manage'))[0];
if (!(await oa.ok('GET', `/sections/class/${cls.id}`)).length) await oa.ok('POST', '/sections', { classId: cls.id, name: 'A', displayOrder: 1, active: true });
const sec = (await oa.ok('GET', `/sections/class/${cls.id}`))[0];
let t = (await oa.ok('GET', '/teachers'))[0];
if (!t) t = await oa.ok('POST', '/teachers', { name: 'Other Teacher', email: 'ot@othertest.e2e.invalid', phoneNumber: '9100000099', dob: '1990-01-01', gender: 'Male', joiningDate: '2025-06-01', classTeacher: '8', classTeacherSectionId: sec.id });
let s = (await oa.ok('GET', '/students/active/class/8'))[0];
if (!s) { await oa.ok('POST', '/students', { name: 'Other Student', email: 'os@othertest.e2e.invalid', phoneNumber: '9299999999', dob: '2013-01-01', className: '8', sectionId: sec.id, gender: 'Male', fatherName: 'F', motherName: 'M', takesBus: false, joiningDate: '2026-04-01' }); s = (await oa.ok('GET', '/students/active/class/8'))[0]; }
sql(`UPDATE users SET password='${H}', must_change_password=false WHERE school_id=${sid}`);
ids.other = { schoolId: sid, classId: cls.id, sectionId: sec.id, teacherId: t.teacherId, studentId: s.studentId };
writeFileSync(new URL('./ids.json', import.meta.url), JSON.stringify(ids, null, 2));
console.log(ids.other);
