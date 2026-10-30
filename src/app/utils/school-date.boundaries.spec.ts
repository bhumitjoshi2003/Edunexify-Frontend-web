import { schoolDateKey, studentExitDateError } from './school-date.util';
import { sessionKind } from '../components/academic-session-selector/academic-session-selector.component';
import { FeeAssignmentComponent } from '../components/fee-assignment/fee-assignment.component';

/**
 * F45 date authority. Shared by the web and Android clients — keep the two copies identical.
 *  - School-day values (attendance day, exit/effective-date defaults, form "today" limits) follow
 *    the school's timezone, like the backend's SchoolTimeUtil — never the UTC date.
 *  - Academic-session classification deliberately follows the backend clock (UTC).
 */
describe('date authority at day boundaries', () => {
  afterEach(() => jasmine.clock().uninstall());

  it('00:30 IST is already the new school day (the UTC date is still yesterday)', () => {
    const at0030Ist = new Date('2026-10-14T19:00:00Z');
    expect(at0030Ist.toISOString().slice(0, 10)).toBe('2026-10-14');
    expect(schoolDateKey(at0030Ist)).toBe('2026-10-15');
  });

  it('just before and after school midnight', () => {
    expect(schoolDateKey(new Date('2026-10-14T18:29:59Z'))).toBe('2026-10-14');
    expect(schoolDateKey(new Date('2026-10-14T18:30:00Z'))).toBe('2026-10-15');
  });

  it('a same-day exit at 00:30 IST is valid, not "in the future"', () => {
    const today = schoolDateKey(new Date('2026-10-14T19:00:00Z'));
    expect(studentExitDateError('2026-10-15', '2026-04-01', today)).toBeNull();
    expect(studentExitDateError('2026-10-16', '2026-04-01', today)).toBe('Leaving date cannot be in the future.');
  });

  it('effective-date defaults use the school day', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-14T19:00:00Z'));
    const c = new FeeAssignmentComponent({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    expect((c as any).today()).toBe('2026-10-15');
  });

  it('academic-session classification intentionally keeps the backend (UTC) clock', () => {
    const session = { id: 1, label: 'Next', startDate: '2026-10-15', endDate: '2027-03-31', current: false };
    expect(sessionKind(session, new Date('2026-10-14T19:00:00Z'))).toBe('FUTURE');
  });
});
