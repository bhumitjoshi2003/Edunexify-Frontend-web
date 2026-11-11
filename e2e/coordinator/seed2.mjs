// Stage 2: Principal, teachers (incl. three future Coordinators), students. Synthetic people only.
import { Client, sql, hash } from './api.mjs';
import { writeFileSync } from 'node:fs';
const H = hash();
const admin = await Client.login('E2E-ADMIN');
const classes = await admin.ok('GET', '/school/classes/manage');
const sec = {};
for (const c of classes) for (const s of await admin.ok('GET', `/sections/class/${c.id}`)) sec[`${c.name}-${s.name}`] = { classId: c.id, sectionId: s.id };
const ids = { sections: sec, classes: Object.fromEntries(classes.map(c => [c.name, c.id])) };

if (!(await admin.ok('GET', '/principals')).length)
  await admin.ok('POST', '/principals', { name: 'Pallavi Principal', email: 'principal@coordtest.e2e.invalid' });
ids.principal = (await admin.ok('GET', '/principals'))[0].userId;

const teachers = [
  ['Sunita Rao', '10', 'A'], ['Kiran Mehta', null, null], ['Arjun Das', null, null],
  ['Ravi Kumar', '8', 'A'], ['Meena Iyer', '6', 'A'], ['Farhan Ali', '7', 'A'], ['Neha Joshi', '9', 'A'],
  ['Vikram Singh', '3', 'A'], ['Tara Bose', null, null], ['Omar Sheikh', '8', 'B'],
];
const existing = await admin.ok('GET', '/teachers');
ids.teachers = {};
for (const [i, [name, ct, s]] of teachers.entries()) {
  let t = existing.find(x => x.name === name);
  if (!t) t = await admin.ok('POST', '/teachers', { name, email: `${name.split(' ')[0].toLowerCase()}@coordtest.e2e.invalid`,
    phoneNumber: `91000000${String(i).padStart(2, '0')}`, dob: '1988-01-15', gender: i % 2 ? 'Male' : 'Female', joiningDate: '2025-06-01',
    classTeacher: ct, classTeacherSectionId: ct ? sec[`${ct}-${s}`].sectionId : null });
  ids.teachers[name] = t.teacherId;
}
const students = [];
for (const cls of ['3', '6', '7', '8', '9', '10']) for (const s of ['A', 'B']) for (let k = 1; k <= 3; k++) students.push([cls, s, k]);
const have = new Set();
for (const cls of ['3', '6', '7', '8', '9', '10']) for (const st of await admin.ok('GET', `/students/active/class/${cls}`)) have.add(st.name);
ids.students = {};
for (const [cls, s, k] of students) {
  const name = `Student ${cls}${s}${k}`;
  if (!have.has(name)) await admin.ok('POST', '/students', { name, email: `s${cls}${s}${k}@coordtest.e2e.invalid`, phoneNumber: `92${cls.padStart(2,'0')}${s === 'A' ? 1 : 2}0000${k}`,
    dob: '2013-02-02', className: cls, sectionId: sec[`${cls}-${s}`].sectionId, gender: k % 2 ? 'Male' : 'Female',
    fatherName: `Father ${cls}${s}${k}`, motherName: `Mother ${cls}${s}${k}`, takesBus: false, joiningDate: '2026-04-01' });
}
for (const cls of ['3', '6', '7', '8', '9', '10']) for (const st of await admin.ok('GET', `/students/active/class/${cls}`)) ids.students[st.name] = st.studentId;
sql(`UPDATE users SET password='${H}', must_change_password=false WHERE school_id=(SELECT id FROM school WHERE slug='coordtest')`);
const missingLogins = sql(`SELECT t.teacher_id FROM teacher t LEFT JOIN users u ON u.user_id=t.teacher_id WHERE t.school_id=1 AND u.id IS NULL`);
writeFileSync(new URL('./ids.json', import.meta.url), JSON.stringify(ids, null, 2));
console.log({ principal: ids.principal, teachers: Object.keys(ids.teachers).length, students: Object.keys(ids.students).length, missingLogins });
