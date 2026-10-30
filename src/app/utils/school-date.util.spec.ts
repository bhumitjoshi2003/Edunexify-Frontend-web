import { schoolDateKey, validDateKey, studentExitDateError } from './school-date.util';
describe('school calendar date contract', () => {
  it('uses the school date before UTC midnight and respects another configured zone', () => {
    const now = new Date('2026-10-13T19:00:00Z');
    expect(schoolDateKey(now, 'Asia/Kolkata')).toBe('2026-10-14');
    expect(schoolDateKey(now, 'America/New_York')).toBe('2026-10-13');
    expect(schoolDateKey(now, 'invalid')).toBe('2026-10-14');
  });
  it('accepts today and exact joining date, rejecting future and pre-joining values', () => {
    expect(studentExitDateError('2026-10-14', '2026-09-01', '2026-10-14')).toBeNull();
    expect(studentExitDateError('2026-09-01', '2026-09-01', '2026-10-14')).toBeNull();
    expect(studentExitDateError('2026-10-15', undefined, '2026-10-14')).toContain('future');
    expect(studentExitDateError('2026-08-31', '2026-09-01', '2026-10-14')).toContain('joining');
  });
  it('rejects impossible, malformed, and missing dates', () => {
    for (const date of ['', '2026-02-30', '2026-13-01', '14/10/2026']) expect(validDateKey(date)).toBeFalse();
    expect(validDateKey('2028-02-29')).toBeTrue();
  });
});
