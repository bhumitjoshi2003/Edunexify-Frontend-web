import { partitionSessions, withoutSession } from './session-security.util';
import { UserSession } from '../interfaces/user-session';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('session security', () => {
  const s = (id: number, current = false): UserSession => ({
    id, current, userAgent: null, ipAddress: null, createdAt: '2026-10-01T10:00:00', lastUsedAt: '2026-10-14T10:00:00', expiresAt: '2026-11-01T10:00:00',
  });

  it('splits the current session from the others, using only the server flag', () => {
    const p = partitionSessions([s(1), s(2, true), s(3)]);
    expect(p.current?.id).toBe(2);
    expect(p.others.map((x) => x.id)).toEqual([1, 3]);
    expect(p.currentKnown).toBeTrue();
    expect(p.canRevokeOthers).toBeTrue();
  });

  it('when the server could not identify this device, "log out others" is not offered (it would sign this device out too)', () => {
    const p = partitionSessions([s(1), s(2)]);
    expect(p.currentKnown).toBeFalse();
    expect(p.canRevokeOthers).toBeFalse();
  });

  it('only the current session: nothing else to revoke', () => {
    expect(partitionSessions([s(1, true)]).canRevokeOthers).toBeFalse();
  });

  it('revoking another session never removes the current one', () => {
    expect(withoutSession([s(1, true), s(2)], 2).map((x) => x.id)).toEqual([1]);
    expect(withoutSession([s(1, true), s(2)], 1).map((x) => x.id)).toEqual([1, 2]);
  });
});
