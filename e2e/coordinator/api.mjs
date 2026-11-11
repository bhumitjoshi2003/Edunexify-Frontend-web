// Minimal API client for a LOCAL, disposable Coordinator test stack. See README.md.
// It refuses anything but a localhost backend and a database whose name ends in "_e2e".
import { execFileSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
export const API = process.env.COORD_E2E_API ?? 'http://localhost:8080/api';
if (!/^http:\/\/localhost:\d+\/api$/.test(API)) throw new Error('COORD_E2E_API must be a localhost backend');
export const REDIS_PORT = process.env.COORD_E2E_REDIS_PORT ?? '6390';
const DB = process.env.COORD_E2E_DB ?? 'edunexify_coord_e2e';
if (!DB.endsWith('_e2e')) throw new Error('COORD_E2E_DB must be a disposable *_e2e database');
const PSQL = ['-h', process.env.COORD_E2E_DB_HOST ?? '127.0.0.1', '-p', process.env.COORD_E2E_DB_PORT ?? '55434',
  '-U', process.env.COORD_E2E_DB_USER ?? 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1'];
export const SLUG = 'coordtest';
export const PASSWORD = 'Coord#Test2026';
export function sql(text) {
  return execFileSync(process.env.COORD_E2E_PSQL ?? 'psql', [...PSQL, '-Atc', text], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'en_US.UTF-8' } }).trim();
}
export const hash = () => bcrypt.hashSync(PASSWORD, 10);
export class Client {
  constructor(name) { this.name = name; this.cookies = {}; }
  cookieHeader() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '); }
  absorb(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';'); const i = pair.indexOf('=');
      this.cookies[pair.slice(0, i)] = pair.slice(i + 1);
    }
  }
  async req(method, path, body, { raw = false } = {}) {
    const res = await fetch(API + path, {
      method, headers: { 'Content-Type': 'application/json', Cookie: this.cookieHeader(), Origin: 'http://localhost:4200' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.absorb(res);
    if (raw) return res;
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  }
  async ok(method, path, body) {
    const r = await this.req(method, path, body);
    if (r.status >= 300) throw new Error(`${this.name} ${method} ${path} -> ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
    return r.data;
  }
  static async login(userId, slug = SLUG) {
    const c = new Client(userId);
    // The scratch Redis holds only this test backend's login rate-limit counters.
    execFileSync('redis-cli', ['-p', REDIS_PORT, 'FLUSHDB']);
    const r = await c.req('POST', '/auth/login', { userId, password: PASSWORD, ...(slug ? { schoolSlug: slug } : {}) });
    if (r.status !== 200) throw new Error(`login ${userId} -> ${r.status} ${JSON.stringify(r.data)}`);
    c.me = r.data;
    return c;
  }
}
