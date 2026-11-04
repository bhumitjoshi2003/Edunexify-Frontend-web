import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AuthStateService } from '../../auth/auth-state.service';
import { AdminService } from '../../services/admin.service';
import { DashboardAnalyticsService } from '../../services/dashboard-analytics.service';
import { LeaveService } from '../../services/leave.service';
import { SchoolService } from '../../services/school.service';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { StaffAdoptionService } from '../../services/staff-adoption.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { StaffAdoptionResponse } from '../../interfaces/staff-adoption';
import { TeacherLeaveService } from '../../services/teacher-leave.service';
import { EventService } from '../../services/event.service';
import { TeacherSubstitutionService } from '../../services/teacher-substitution.service';

describe('AdminDashboardComponent — Staff Adoption card', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let staffAdoptionService: jasmine.SpyObj<StaffAdoptionService>;
  let authState: jasmine.SpyObj<AuthStateService>;

  const staffAdoption: StaffAdoptionResponse = {
    summary: { totalTeachers: 22, startedTeachers: 18, notStartedTeachers: 3, attendanceUsedTeachers: 16, disabledTeachers: 1 },
    teachers: [],
  };

  function configure(role: string): void {
    authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'U1', role, name: 'Test', className: '' } as any);
    authState.hasFeature.and.returnValue(false);
    staffAdoptionService = jasmine.createSpyObj('StaffAdoptionService', ['getStaffAdoption']);
    staffAdoptionService.getStaffAdoption.and.returnValue(of(staffAdoption));

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: TeacherSubstitutionService, useValue: { getUncovered: () => of([]) } },
        { provide: AuthStateService, useValue: authState },
        { provide: AdminService, useValue: { getAdminById: () => of({ name: 'Test Admin' }) } },
        { provide: DashboardAnalyticsService, useValue: { getStats: () => of({ totalStudents: 0, totalTeachers: 0, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 }) } },
        { provide: LeaveService, useValue: { getLeavesPaginated: () => of({ content: [] }), getOnLeaveToday: () => of({ date: '2026-10-05', students: [], staff: [], periodsNeedingSubstitute: 0 }) } },
        { provide: SchoolService, useValue: { getEntitlement: () => of(null), getSetupHealth: () => of(null) } },
        { provide: TeacherCheckinService, useValue: { getTodaySummary: () => of(null) } },
        { provide: StaffAdoptionService, useValue: staffAdoptionService },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) },
        { provide: TeacherLeaveService, useValue: { getLeaves: () => of({ content: [], totalElements: 0, totalPages: 0 }) } },
        { provide: EventService, useValue: { getEventsForMonthAndYear: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(AdminDashboardComponent);
  }

  it('renders compact Staff adoption status inside School & plan for an ADMIN', () => {
    configure('ADMIN');
    fixture.detectChanges();

    expect(staffAdoptionService.getStaffAdoption).toHaveBeenCalled();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('School & plan');
    expect(text).toContain('Staff adoption');
    expect(text).toContain('18 of 22 teachers started');
  });

  it('does not call staff adoption or render its compact status for a non-ADMIN role', () => {
    configure('SUB_ADMIN');
    fixture.detectChanges();

    expect(staffAdoptionService.getStaffAdoption).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Staff adoption');
  });

  it('the Staff adoption row links to the dedicated page', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector('a[routerLink="/dashboard/staff-adoption"]');
    expect(link).not.toBeNull();
  });
});

describe('AdminDashboardComponent — Daily Action Center (Phase 1)', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let teacherLeaveService: jasmine.SpyObj<TeacherLeaveService>;
  let eventService: jasmine.SpyObj<EventService>;
  let adminService: jasmine.SpyObj<AdminService>;

  function configure(role: string, opts: {
    stats?: any;
    staffAttendance?: any;
    teacherLeavesTotal?: number;
    events?: any[];
    entitlement?: any;
    statsError?: boolean;
    staffAttendanceError?: boolean;
    studentLeavesError?: boolean;
    entitlementError?: boolean;
    setupHealthError?: boolean;
    staffAdoptionError?: boolean;
  } = {}): void {
    const authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'U1', role, name: 'Test', className: '' } as any);
    authState.hasFeature.and.returnValue(false);
    const staffAdoptionService = jasmine.createSpyObj('StaffAdoptionService', ['getStaffAdoption']);
    staffAdoptionService.getStaffAdoption.and.returnValue(
      opts.staffAdoptionError
        ? throwError(() => new Error('staff adoption offline'))
        : of({
          summary: { totalTeachers: 22, startedTeachers: 18, notStartedTeachers: 3, attendanceUsedTeachers: 16, disabledTeachers: 1 },
          teachers: [],
        }),
    );

    const stats = opts.stats ?? { totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 };
    const staffAttendance = opts.staffAttendance ?? { date: '2026-09-22', presentCount: 4, lateCount: 1, absentCount: 0, halfDayCount: 0, onLeaveCount: 1, expectedCount: 9, notCheckedInCount: 3 };

    teacherLeaveService = jasmine.createSpyObj('TeacherLeaveService', ['getLeaves']);
    teacherLeaveService.getLeaves.and.returnValue(of({
      content: [], totalElements: opts.teacherLeavesTotal ?? 0, totalPages: 1, size: 1, number: 0, first: true, last: true, empty: true,
    }));
    eventService = jasmine.createSpyObj('EventService', ['getEventsForMonthAndYear']);
    eventService.getEventsForMonthAndYear.and.returnValue(of(opts.events ?? []));
    adminService = jasmine.createSpyObj('AdminService', ['getAdminById']);
    adminService.getAdminById.and.returnValue(of({ name: 'Test Admin' } as any));

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStateService, useValue: authState },
        { provide: TeacherSubstitutionService, useValue: { getUncovered: () => of([]) } },
        { provide: AdminService, useValue: adminService },
        {
          provide: DashboardAnalyticsService, useValue: {
            getStats: () => opts.statsError ? throwError(() => new Error('stats offline')) : of(stats),
          },
        },
        {
          provide: LeaveService, useValue: {
            getOnLeaveToday: () => of({ date: '2026-10-05', students: [], staff: [], periodsNeedingSubstitute: 0 }),
            getLeavesPaginated: () => opts.studentLeavesError ? throwError(() => new Error('leaves offline')) : of({ content: [] }),
          },
        },
        {
          provide: SchoolService, useValue: {
            getEntitlement: () => opts.entitlementError ? throwError(() => new Error('entitlement offline')) : of(opts.entitlement ?? null),
            getSetupHealth: () => opts.setupHealthError
              ? throwError(() => new Error('setup offline'))
              : of({ completionPercentage: 80, completedRequired: 4, totalRequired: 5, status: 'IN_PROGRESS', items: [] }),
          },
        },
        {
          provide: TeacherCheckinService, useValue: {
            getTodaySummary: () => opts.staffAttendanceError ? throwError(() => new Error('attendance offline')) : of(staffAttendance),
          },
        },
        { provide: StaffAdoptionService, useValue: staffAdoptionService },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) },
        { provide: TeacherLeaveService, useValue: teacherLeaveService },
        { provide: EventService, useValue: eventService },
      ],
    });
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
  }

  // ─── Admin profile — reuses the session's /auth/me name, no separate admin-profile fetch ───

  it('renders the greeting name from the session user without a duplicate admin-profile request, for ADMIN', () => {
    configure('ADMIN');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Test');
    expect(adminService.getAdminById).not.toHaveBeenCalled();
  });

  it('renders the greeting name from the session user without a duplicate admin-profile request, for SUB_ADMIN', () => {
    configure('SUB_ADMIN');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Test');
    expect(adminService.getAdminById).not.toHaveBeenCalled();
  });

  it('renders the new hierarchy with Today at a glance before Needs your attention and School & plan', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    const todayIdx = text.indexOf('Today at a glance');
    const attentionIdx = text.indexOf('Needs your attention');
    const schoolPlanIdx = text.indexOf('School & plan');
    expect(todayIdx).toBeGreaterThan(-1);
    expect(attentionIdx).toBeGreaterThan(todayIdx);
    expect(schoolPlanIdx).toBeGreaterThan(attentionIdx);
  });

  it('shows Not Yet Checked In from the backend\'s expected-to-attend count, not total staff minus check-ins', () => {
    configure('ADMIN', {
      stats: { totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 },
      staffAttendance: { date: '2026-09-22', presentCount: 4, lateCount: 1, absentCount: 0, halfDayCount: 0, onLeaveCount: 1, expectedCount: 7, notCheckedInCount: 2 },
    });
    fixture.detectChanges();
    expect(component.notYetCheckedIn).toBe(2);   // not 10 − 6: two teachers are off today
    expect(fixture.nativeElement.textContent).toContain('2 not checked in');
    expect(fixture.nativeElement.textContent).toContain('Teachers not checked in');
  });

  it('on a school holiday nobody is reported as not checked in', () => {
    configure('ADMIN', {
      stats: { totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 },
      staffAttendance: { date: '2026-09-22', presentCount: 0, lateCount: 0, absentCount: 0, halfDayCount: 0, onLeaveCount: 0, expectedCount: 0, notCheckedInCount: 0 },
    });
    fixture.detectChanges();
    expect(component.notYetCheckedIn).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('Teachers not checked in');
  });

  it('never labels the not-yet-checked-in metric as "Absent"', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const today = fixture.nativeElement.querySelector('.ad-today');
    expect(today).toBeTruthy();
    expect(today.textContent).toContain('not checked in');
    expect(today.textContent).not.toContain('Not Yet Checked In');
  });

  it('renders the compact shortcut set with the correct core routes', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const routes = ['/dashboard/register', '/dashboard/notice', '/dashboard/view-leaves', '/dashboard/attendance-summary'];
    for (const route of routes) {
      const link = fixture.nativeElement.querySelector(`.ad-actions-grid--compact a[routerLink="${route}"]`);
      expect(link).withContext(route).toBeTruthy();
    }
    expect(fixture.nativeElement.querySelector('.ad-daily-actions-grid')).toBeNull();
  });

  it('hides ADMIN-only dashboard sections for SUB_ADMIN', () => {
    configure('SUB_ADMIN');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ad-today')).toBeNull();
    expect(fixture.nativeElement.querySelector('.ad-actions-grid--compact a[routerLink="/dashboard/register"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[routerLink="/dashboard/view-leaves"]')).toBeNull();
  });

  it('keeps Leave Approvals, Send Notice and Attendance in Shortcuts while Events stays in Coming up', () => {
    configure('ADMIN');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Shortcuts');
    for (const route of ['/dashboard/view-leaves', '/dashboard/notice', '/dashboard/attendance-summary']) {
      expect(fixture.nativeElement.querySelector(`.ad-actions-grid--compact a[routerLink="${route}"]`)).withContext(route).toBeTruthy();
    }
    expect(fixture.nativeElement.querySelector('.ad-view-all[routerLink="/dashboard/event-calendar"]')).toBeTruthy();
  });

  it('renders the simplified dashboard instead of the old duplicate sections', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Today at a glance');
    expect(text).toContain('Needs your attention');
    expect(text).toContain('Shortcuts');
    expect(text).not.toContain('Staff Attendance Today');
    expect(text).not.toContain('Pending Leave Requests');
    expect(text).not.toContain('Today\'s Actions');
  });

  // ─── Teacher pending leave — reuses the existing ADMIN-only status-filtered endpoint ───

  it('renders the student pending-leave count in Needs your attention', () => {
    configure('ADMIN', { stats: { totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 3 } });
    fixture.detectChanges();
    const row = Array.from(fixture.nativeElement.querySelectorAll('.ad-attention-list a'))
      .find((r: any) => r.textContent.includes('Student leave requests')) as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('3');
  });

  it('renders the teacher pending-leave count separately, via getLeaves(0,1,"PENDING")', () => {
    configure('ADMIN', { teacherLeavesTotal: 2 });
    fixture.detectChanges();
    expect(teacherLeaveService.getLeaves).toHaveBeenCalledWith(0, 1, 'PENDING');
    const row = Array.from(fixture.nativeElement.querySelectorAll('.ad-attention-list a'))
      .find((r: any) => r.textContent.includes('Teacher leave requests')) as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('2');
  });

  it('hides the teacher pending-leave attention row when the count is zero', () => {
    configure('ADMIN', { teacherLeavesTotal: 0 });
    fixture.detectChanges();
    const rows = Array.from(fixture.nativeElement.querySelectorAll('.ad-attention-list a'));
    expect(rows.some((r: any) => r.textContent.includes('Teacher leave requests'))).toBeFalse();
  });

  it('does not fire the ADMIN-only teacher-leave count request for SUB_ADMIN', () => {
    configure('SUB_ADMIN');
    fixture.detectChanges();
    expect(teacherLeaveService.getLeaves).not.toHaveBeenCalled();
  });

  it('links student and teacher leave attention rows to the correct existing routes', () => {
    configure('ADMIN', { teacherLeavesTotal: 2, stats: { totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 3 } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ad-attention-list a[routerLink="/dashboard/view-leaves"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.ad-attention-list a[routerLink="/dashboard/teacher-leave-requests"]')).toBeTruthy();
  });

  it('isolates a teacher-leave-count failure — the rest of the dashboard still loads', () => {
    const authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'U1', role: 'ADMIN', name: 'Test', className: '' } as any);
    authState.hasFeature.and.returnValue(false);
    teacherLeaveService = jasmine.createSpyObj('TeacherLeaveService', ['getLeaves']);
    teacherLeaveService.getLeaves.and.returnValue(throwError(() => new Error('offline')));
    eventService = jasmine.createSpyObj('EventService', ['getEventsForMonthAndYear']);
    eventService.getEventsForMonthAndYear.and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStateService, useValue: authState },
        { provide: AdminService, useValue: { getAdminById: () => of({ name: 'Test Admin' }) } },
        { provide: TeacherSubstitutionService, useValue: { getUncovered: () => of([]) } },
        { provide: DashboardAnalyticsService, useValue: { getStats: () => of({ totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 }) } },
        { provide: LeaveService, useValue: { getLeavesPaginated: () => of({ content: [] }), getOnLeaveToday: () => of({ date: '2026-10-05', students: [], staff: [], periodsNeedingSubstitute: 0 }) } },
        { provide: SchoolService, useValue: { getEntitlement: () => of(null), getSetupHealth: () => of({ completionPercentage: 80, completedRequired: 4, totalRequired: 5, status: 'IN_PROGRESS', items: [] }) } },
        { provide: TeacherCheckinService, useValue: { getTodaySummary: () => of({ date: '2026-09-22', presentCount: 4, lateCount: 1, absentCount: 0, halfDayCount: 0, onLeaveCount: 1, expectedCount: 9, notCheckedInCount: 3 }) } },
        { provide: StaffAdoptionService, useValue: jasmine.createSpyObj('StaffAdoptionService', { getStaffAdoption: of({ summary: { totalTeachers: 1, startedTeachers: 1, notStartedTeachers: 0, attendanceUsedTeachers: 1, disabledTeachers: 0 }, teachers: [] }) }) },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) },
        { provide: TeacherLeaveService, useValue: teacherLeaveService },
        { provide: EventService, useValue: eventService },
      ],
    });
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.teacherPendingLeaveFailed).toBeTrue();
    expect(component.isLoading).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Today at a glance');
  });

  // ─── Upcoming event — bounded to at most 2 requests, isolated failure ───

  const event = (overrides: any = {}) => ({
    id: 1, title: 'Event', description: '', startDate: '2026-09-22', category: 'GENERAL', targetAudience: [], ...overrides,
  });

  // The fixtures are September 2026 events and the component reads the real clock for "now",
  // so pin it to 22 Sep 2026 to keep current-month / next-month fallback independent of the run date.
  describe('with the clock pinned to 22 Sep 2026', () => {
    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 8, 22, 10, 0, 0));
    });

    afterEach(() => jasmine.clock().uninstall());

    it('renders the nearest upcoming event for the current month', () => {
      configure('ADMIN', { events: [event({ title: 'Sooner', startDate: '2026-09-24' }), event({ id: 2, title: 'Later', startDate: '2026-09-28' })] });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Sooner');
      expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledTimes(1);
    });

    it('falls back to next month when the current month has no upcoming event', () => {
      configure('ADMIN', { events: [event({ title: 'Past', startDate: '2026-09-01' })] });
      fixture.detectChanges();
      expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledTimes(2);
    });

    it('shows a no-event state and School Setup/Staff Adoption still remain below daily content', () => {
      configure('ADMIN', { events: [] });
      fixture.detectChanges();
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('No upcoming events this month.');
      expect(text.indexOf('Upcoming Event')).toBeLessThan(text.indexOf('School & plan'));
      expect(text.indexOf('Upcoming Event')).toBeLessThan(text.lastIndexOf('Staff adoption'));
    });
  });

  it('isolates an event-load failure — other sections stay intact', () => {
    const authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'U1', role: 'ADMIN', name: 'Test', className: '' } as any);
    authState.hasFeature.and.returnValue(false);
    eventService = jasmine.createSpyObj('EventService', ['getEventsForMonthAndYear']);
    eventService.getEventsForMonthAndYear.and.returnValue(throwError(() => new Error('offline')));
    teacherLeaveService = jasmine.createSpyObj('TeacherLeaveService', ['getLeaves']);
    teacherLeaveService.getLeaves.and.returnValue(of({ content: [], totalElements: 0, totalPages: 1, size: 1, number: 0, first: true, last: true, empty: true }));

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: TeacherSubstitutionService, useValue: { getUncovered: () => of([]) } },
        { provide: AuthStateService, useValue: authState },
        { provide: AdminService, useValue: { getAdminById: () => of({ name: 'Test Admin' }) } },
        { provide: DashboardAnalyticsService, useValue: { getStats: () => of({ totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 }) } },
        { provide: LeaveService, useValue: { getLeavesPaginated: () => of({ content: [] }), getOnLeaveToday: () => of({ date: '2026-10-05', students: [], staff: [], periodsNeedingSubstitute: 0 }) } },
        { provide: SchoolService, useValue: { getEntitlement: () => of(null), getSetupHealth: () => of({ completionPercentage: 80, completedRequired: 4, totalRequired: 5, status: 'IN_PROGRESS', items: [] }) } },
        { provide: TeacherCheckinService, useValue: { getTodaySummary: () => of({ date: '2026-09-22', presentCount: 4, lateCount: 1, absentCount: 0, halfDayCount: 0, onLeaveCount: 1, expectedCount: 9, notCheckedInCount: 3 }) } },
        { provide: StaffAdoptionService, useValue: jasmine.createSpyObj('StaffAdoptionService', { getStaffAdoption: of({ summary: { totalTeachers: 1, startedTeachers: 1, notStartedTeachers: 0, attendanceUsedTeachers: 1, disabledTeachers: 0 }, teachers: [] }) }) },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) },
        { provide: TeacherLeaveService, useValue: teacherLeaveService },
        { provide: EventService, useValue: eventService },
      ],
    });
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.upcomingEventFailed).toBeTrue();
    expect(component.isLoading).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Today at a glance');
  });

  // ─── Failure isolation — one failed source must never blank an unrelated section ───

  it('stats failure does not hide staff attendance information from Today at a glance', () => {
    configure('ADMIN', { statsError: true });
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Today at a glance');
    expect(text).toContain('Staff present');
    expect(text).toContain('Attendance unavailable');
  });

  it('stats failure does not hide Shortcuts', () => {
    configure('ADMIN', { statsError: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ad-actions-grid--compact')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Shortcuts');
  });

  it('stats failure does not fabricate a student leave attention count', () => {
    configure('ADMIN', { statsError: true });
    fixture.detectChanges();
    const rows = Array.from(fixture.nativeElement.querySelectorAll('.ad-attention-list a'));
    expect(rows.some((r: any) => r.textContent.includes('Student leave requests'))).toBeFalse();
  });

  it('staff attendance failure keeps Today at a glance visible with an unavailable state', () => {
    configure('ADMIN', { staffAttendanceError: true });
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Today at a glance');
    expect(text).toContain('Staff attendance unavailable');
  });

  it('staff attendance failure does not compute "Not Yet Checked In" from missing data', () => {
    configure('ADMIN', { staffAttendanceError: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Teachers not checked in');
  });

  it('student leave failure does not hide the teacher pending-leave attention row', () => {
    configure('ADMIN', { studentLeavesError: true, teacherLeavesTotal: 3 });
    fixture.detectChanges();
    const row = Array.from(fixture.nativeElement.querySelectorAll('.ad-attention-list a'))
      .find((r: any) => r.textContent.includes('Teacher leave requests')) as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('3');
  });

  it('student leave preview failure does not break the simplified dashboard', () => {
    configure('ADMIN', { studentLeavesError: true });
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Today at a glance');
    expect(text).toContain('Shortcuts');
  });

  it('entitlement failure is isolated inside School & plan', () => {
    configure('ADMIN', { entitlementError: true });
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Some school status data is unavailable');
    expect(text).toContain('Today at a glance');
    expect(text).toContain('Shortcuts');
  });

  it('entitlement success renders the plan in the compact School & plan section', () => {
    configure('ADMIN', { entitlement: { planName: 'Growth Plan', subscriptionStatus: 'ACTIVE', featureCount: 5, activeStudents: 10, maxStudents: 100, totalStaff: 4, maxStaff: 20 } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('School & plan');
    expect(fixture.nativeElement.textContent).toContain('Growth Plan');
  });

  it('Staff Adoption failure remains isolated from the rest of the dashboard', () => {
    configure('ADMIN', { staffAdoptionError: true });
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Some school status data is unavailable');
    expect(text).toContain('Today at a glance');
  });

  it('School Setup failure remains isolated from the rest of the dashboard', () => {
    configure('ADMIN', { setupHealthError: true });
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Some school status data is unavailable');
    expect(text).toContain('Today at a glance');
  });

  it('a fully successful ADMIN dashboard renders the simplified happy path', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Today at a glance');
    expect(text).toContain('Needs your attention');
    expect(text).toContain('School & plan');
    expect(text).toContain('Shortcuts');
    expect(text).not.toContain('temporarily unavailable');
    expect(text).not.toContain('Could not load dashboard stats');
  });

  it('a fully successful SUB_ADMIN dashboard keeps ADMIN-only sections hidden', () => {
    configure('SUB_ADMIN');
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).not.toContain('Today at a glance');
    expect(text).not.toContain('Staff adoption');
    expect(text).not.toContain('temporarily unavailable');
  });

  it('loadStaffAttendance re-requests only that source, not stats/leaves/entitlement', () => {
    const getStats = jasmine.createSpy('getStats').and.returnValue(of({ totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 }));
    const getLeavesPaginated = jasmine.createSpy('getLeavesPaginated').and.returnValue(of({ content: [] }));
    const getEntitlement = jasmine.createSpy('getEntitlement').and.returnValue(of(null));
    const getTodaySummary = jasmine.createSpy('getTodaySummary').and.returnValue(of({ date: '2026-09-22', presentCount: 4, lateCount: 1, absentCount: 0, halfDayCount: 0, onLeaveCount: 1, expectedCount: 9, notCheckedInCount: 3 }));
    const authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'U1', role: 'ADMIN', name: 'Test', className: '' } as any);
    authState.hasFeature.and.returnValue(false);

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStateService, useValue: authState },
        { provide: AdminService, useValue: { getAdminById: () => of({ name: 'Test Admin' }) } },
        { provide: TeacherSubstitutionService, useValue: { getUncovered: () => of([]) } },
        { provide: DashboardAnalyticsService, useValue: { getStats } },
        { provide: LeaveService, useValue: { getLeavesPaginated, getOnLeaveToday: () => of({ date: '2026-10-05', students: [], staff: [], periodsNeedingSubstitute: 0 }) } },
        { provide: SchoolService, useValue: { getEntitlement, getSetupHealth: () => of(null) } },
        { provide: TeacherCheckinService, useValue: { getTodaySummary } },
        { provide: StaffAdoptionService, useValue: jasmine.createSpyObj('StaffAdoptionService', { getStaffAdoption: of({ summary: { totalTeachers: 1, startedTeachers: 1, notStartedTeachers: 0, attendanceUsedTeachers: 1, disabledTeachers: 0 }, teachers: [] }) }) },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) },
        { provide: TeacherLeaveService, useValue: { getLeaves: () => of({ content: [], totalElements: 0, totalPages: 0 }) } },
        { provide: EventService, useValue: { getEventsForMonthAndYear: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(AdminDashboardComponent);
    const cmp = fixture.componentInstance;
    fixture.detectChanges();

    expect(getTodaySummary).toHaveBeenCalledTimes(1);
    cmp.loadStaffAttendance();
    expect(getTodaySummary).toHaveBeenCalledTimes(2);
    expect(getStats).toHaveBeenCalledTimes(1);
    expect(getLeavesPaginated).toHaveBeenCalledTimes(1);
    expect(getEntitlement).toHaveBeenCalledTimes(1);
  });
});
