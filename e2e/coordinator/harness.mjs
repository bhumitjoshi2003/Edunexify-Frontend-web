import { readFileSync, appendFileSync } from 'node:fs';
import { Client, sql } from './api.mjs';
export const ids = JSON.parse(readFileSync(new URL('./ids.json', import.meta.url)));
export const T = ids.teachers, S = ids.sections, C = ids.classes, ST = ids.students;
const out = new URL('./results.jsonl', import.meta.url);
const sessions = {};
export async function as(name) {
  const id = T[name] ?? name;
  if (!sessions[id]) sessions[id] = await Client.login(id, id.startsWith('E2E-OTHER') ? 'othertest' : undefined);
  return sessions[id];
}
export function forget(name) { delete sessions[T[name] ?? name]; }
let failures = 0;
export async function check(area, name, fn) {
  try { const detail = await fn(); appendFileSync(out, JSON.stringify({ area, name, result: 'PASS', detail }) + '\n'); console.log(`PASS  ${area} — ${name}`); }
  catch (e) { failures++; appendFileSync(out, JSON.stringify({ area, name, result: 'FAIL', detail: String(e.message ?? e).slice(0, 600) }) + '\n'); console.log(`FAIL  ${area} — ${name}: ${String(e.message ?? e).slice(0, 300)}`); }
}
export function expectStatus(r, ...codes) {
  if (!codes.includes(r.status)) throw new Error(`expected ${codes.join('/')} got ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
}
export function assert(cond, msg) { if (!cond) throw new Error(msg); }
export const lastAudit = (action, user) => sql(`SELECT username||'|'||role||'|'||action FROM audit_log WHERE school_id=1 AND action='${action}'${user ? ` AND username='${user}'` : ''} ORDER BY id DESC LIMIT 1`);
export function done() { console.log(`\n${failures} failure(s)`); }
