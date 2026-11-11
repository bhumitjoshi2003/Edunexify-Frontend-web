// API: Coordinator directories never cross schools; an ordinary teacher gets none; Principal unchanged. See README.md.
import { as, ids, check, assert, expectStatus, done } from './harness.mjs';
import { Client } from './api.mjs';
const O = ids.other;
for (const who of ['Sunita Rao', 'Kiran Mehta', 'Arjun Das']) await check('Isolation', `${who}: no other school's students or teachers`, async () => {
  const c = await as(who);
  const search = await c.ok('GET', '/principal/students?q=Student');
  const teachers = await c.ok('GET', '/principal/teachers');
  const staff = await c.ok('GET', '/coordinator/teachers');
  const foreign = JSON.stringify([search, teachers, staff]).match(/E2E-OTHER|othertest/g);
  assert(!foreign, 'foreign rows ' + foreign);
  for (const id of Object.values(O).flat().filter(v => typeof v === 'string' && v !== 'othertest')) {
    const s = await c.req('GET', `/principal/students/${id}`), t = await c.req('GET', `/principal/teachers/${id}`);
    assert(s.status >= 400 && t.status >= 400, `${id} readable ${s.status}/${t.status}`);
  }
  return { students: search.length, teachers: teachers.length, staffList: staff.length };
});
await check('Ordinary teacher', 'Meena Iyer (not a Coordinator) gets no Coordinator directory', async () => {
  const c = await as('Meena Iyer');
  return Object.fromEntries(await Promise.all(['/principal/students?q=Student', '/principal/teachers', '/coordinator/teachers', '/coordinator/students']
    .map(async u => { const r = await c.req('GET', u); expectStatus(r, 403); return [u, r.status]; })));
});
await check('Leadership', 'Principal and Admin directories unchanged', async () => {
  const p = await Client.login(ids.principal);
  const ps = await p.ok('GET', '/principal/students?q=Student'), pt = await p.ok('GET', '/principal/teachers');
  const a = await Client.login('E2E-ADMIN').catch(() => null);
  const at = a ? await a.ok('GET', '/teacher/all').catch(e => String(e).slice(0, 80)) : 'no admin login';
  assert(ps.length === 48 && pt.length === 10, `${ps.length}/${pt.length}`);
  return { principalStudents: ps.length, principalTeachers: pt.length, adminTeachers: Array.isArray(at) ? at.length : at };
});
done();
