import { of, Subject, throwError } from 'rxjs';
import { TeacherCheckinComponent } from './teacher-checkin.component';
import { schoolDateKey } from '../../utils/school-date.util';
describe('teacher attendance eligibility contract', () => {
  function fixture() {
    const api = jasmine.createSpyObj('TeacherCheckinService', ['getMyAttendance','getCalendarConfig','checkIn','checkOut']);
    const summary = { records: [], expectedToday: true } as any;
    api.getMyAttendance.and.returnValue(of(summary));
    api.getCalendarConfig.and.returnValue(of({ workingDays: 'MONDAY', timezone: 'Asia/Kolkata' }));
    const c = new TeacherCheckinComponent(api, { getUser: () => ({ name: 'Teacher' }) } as any, { log: () => {}, error: () => {} } as any, { error: () => {}, warning: () => {}, info: () => {} } as any, { markForCheck: () => {} } as any);
    const today = schoolDateKey(); c.selectedMonth = Number(today.slice(5,7)); c.selectedYear = Number(today.slice(0,4));
    return { c, api, summary };
  }
  it('blocks check-in when loading, failed, unknown, or not expected today', async () => {
    const { c, api } = fixture();
    for (const expected of [false, null]) { c.todayStateResolved = true; c.expectedToday = expected; await c.checkIn(); }
    c.todayStateResolved = false; c.expectedToday = true; await c.checkIn();
    expect(api.checkIn).not.toHaveBeenCalled();
    api.getMyAttendance.and.returnValue(throwError(() => new Error('offline'))); c.loadMonthlyData();
    expect(c.attendanceLoadError).toBeTruthy(); expect(c.todayStateResolved).toBeFalse();
  });
  it('keeps today eligibility authoritative when browsing a historical month', () => {
    const { c, api } = fixture(); const today = schoolDateKey();
    const year = Number(today.slice(0,4)), month = Number(today.slice(5,7));
    api.getMyAttendance.and.callFake((m: number, y: number) => of({ records: [], expectedToday: y === year && m === month ? false : null } as any));
    c.selectedYear = year-1; c.loadMonthlyData();
    expect(c.todayStateResolved).toBeTrue(); expect(c.expectedToday).toBeFalse();
  });
  it('ignores an older monthly response when the viewed month changes', () => {
    const { c, api, summary } = fixture(); const old = new Subject<any>();
    api.getMyAttendance.and.returnValue(old); c.loadMonthlyData();
    api.getMyAttendance.and.returnValue(of(summary)); c.selectedYear--; c.loadMonthlyData();
    old.next({ records: [], expectedToday: false });
    expect(c.expectedToday).toBeTrue(); expect(c.monthlyData).toBe(summary);
  });
  it('does not offer another check-in over an admin-marked absence', async () => {
    const { c, api } = fixture(); c.todayStateResolved = true; c.expectedToday = true;
    c.todayRecord = { checkInTime: null, status: 'ABSENT' } as any;
    await c.checkIn(); expect(api.checkIn).not.toHaveBeenCalled();
  });
  it('rechecks eligibility after asynchronous GPS acquisition', async () => {
    const { c, api } = fixture(); c.loadMonthlyData();
    let resolve!: (position: any) => void;
    spyOn<any>(c, 'getPosition').and.returnValue(new Promise(r => resolve = r));
    const request = c.checkIn(); c.expectedToday = false;
    resolve({ latitude: 1, longitude: 2 }); await request;
    expect(api.checkIn).not.toHaveBeenCalled(); expect(c.isCheckingIn).toBeFalse();
  });

});
