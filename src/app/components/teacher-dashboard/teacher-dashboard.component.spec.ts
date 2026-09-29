import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideRouter, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { UnreadCountState } from '../../services/notification.service';
import { TeacherDashboardComponent } from './teacher-dashboard.component';
import { TimetableEntry } from '../../interfaces/timetable';
import { AuthStateService } from '../../auth/auth-state.service';
import { TeacherService } from '../../services/teacher.service';
import { StudentService } from '../../services/student.service';
import { AttendanceService } from '../../services/attendance.service';
import { LeaveService } from '../../services/leave.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { TeacherLeaveService } from '../../services/teacher-leave.service';
import { TimetableService } from '../../services/timetable.service';
import { TeacherSubstitutionService } from '../../services/teacher-substitution.service';
import { TeacherSubstitution } from '../../interfaces/teacher-substitution';
import { NotificationService } from '../../services/notification.service';
import { EventService } from '../../services/event.service';

describe('TeacherDashboardComponent today classes', () => {
  let authState: any;
  let teacherService: any;
  let studentService: any;
  let attendanceService: any;
  let leaveService: any;
  let cdr: any;
  let logger: any;
  let toast: any;
  let checkinService: any;
  let teacherLeaveService: any;
  let timetableService: any;
  let substitutionService: any;
  let notificationService: any;
  let eventService: any;

  const build = () => new TeacherDashboardComponent(
    authState, teacherService, studentService, attendanceService, leaveService,
    logger, cdr, toast, checkinService, teacherLeaveService, timetableService, substitutionService, notificationService, eventService
  );

  const timetableEntry = (overrides: Partial<TimetableEntry> = {}): TimetableEntry => ({
    id: 1, className: 'X', sectionName: null, day: 'THURSDAY', periodNumber: 1,
    startTime: '09:10', endTime: '09:50', subjectName: 'English', teacherId: 'T1',
    ...overrides,
  });

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 17, 9, 30, 0));
    authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'T1' });
    authState.hasFeature.and.returnValue(false);
    teacherService = jasmine.createSpyObj('TeacherService', ['getTeacher']);
    teacherService.getTeacher.and.returnValue(of({ name: 'Ms Rao', classTeacher: null }));
    studentService = jasmine.createSpyObj('StudentService', ['getActiveStudentsByClass']);
    attendanceService = jasmine.createSpyObj('AttendanceService', ['getSheet', 'getClassSummary']);
    leaveService = jasmine.createSpyObj('LeaveService', ['getLeavesPaginated', 'updateLeaveStatus']);
    logger = jasmine.createSpyObj('LoggerService', ['error']);
    cdr = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'info', 'error']);
    checkinService = jasmine.createSpyObj('TeacherCheckinService', ['getMyAttendance']);
    checkinService.getMyAttendance.and.returnValue(of({
      totalWorkingDays: 0, presentDays: 0, lateDays: 0, absentDays: 0,
      halfDayDays: 0, onLeaveDays: 0, onTimePercentage: 0,
      attendancePercentage: 0, trackingStartDate: null, records: [],
    }));
    teacherLeaveService = jasmine.createSpyObj('TeacherLeaveService', ['getMyLeaves']);
    teacherLeaveService.getMyLeaves.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0 }));
    timetableService = jasmine.createSpyObj('TimetableService', ['getTeacherTimetable']);
    timetableService.getTeacherTimetable.and.returnValue(of([]));
    substitutionService = jasmine.createSpyObj('TeacherSubstitutionService', ['getMine', 'getMyCoverage']);
    substitutionService.getMine.and.returnValue(of([]));
    substitutionService.getMyCoverage.and.returnValue(of(null as any));
    notificationService = jasmine.createSpyObj('NotificationService', ['getUnreadNotificationCount']);
    notificationService.getUnreadNotificationCount.and.returnValue(of(0));
    notificationService.unreadCountState$ = new BehaviorSubject<UnreadCountState>({ status: 'loading', count: 0 });
    eventService = jasmine.createSpyObj('EventService', ['getEventsForMonthAndYear']);
    eventService.getEventsForMonthAndYear.and.returnValue(of([]));
  });

  afterEach(() => jasmine.clock().uninstall());

  it('reuses the teacher timetable API and builds the current/next view', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ id: 1, startTime: '09:10', endTime: '09:50' }),
      timetableEntry({ id: 2, startTime: '10:00', endTime: '10:40', className: 'IX' }),
    ]));
    const component = build();
    component.ngOnInit();
    expect(timetableService.getTeacherTimetable).toHaveBeenCalledWith('T1');
    expect(component.todayView.current?.key).toBe('1');
    expect(component.todayView.upcoming[0].key).toBe('2');
  });

  it('renders untimed entries using Period N and no time range', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ periodNumber: 4, startTime: null as any, endTime: null as any }),
    ]));
    const component = build();
    component.ngOnInit();
    const entry = component.todayView.upcoming[0];
    expect(component.periodClassLabel(entry)).toBe('Period 4 · Class X');
    expect(component.classTimeRange(entry)).toBeNull();
  });

  it('distinguishes no timetable from no classes today and completed classes', () => {
    const component = build();
    component.ngOnInit();
    expect(component.timetableEntries).toEqual([]);
    expect(component.todayView.hasAnyToday).toBeFalse();

    timetableService.getTeacherTimetable.and.returnValue(of([timetableEntry({ day: 'MONDAY' })]));
    component.retryTodayClasses();
    expect(component.timetableEntries.length).toBe(1);
    expect(component.todayView.hasAnyToday).toBeFalse();

    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ startTime: '08:00', endTime: '08:40' }),
    ]));
    component.retryTodayClasses();
    expect(component.todayView.allDone).toBeTrue();
  });

  it('shows an isolated timetable error and Retry reloads only timetable data', () => {
    timetableService.getTeacherTimetable.and.returnValue(throwError(() => ({ error: { message: 'Timetable unavailable.' } })));
    const component = build();
    component.ngOnInit();
    expect(component.todayClassesError).toBe('Timetable unavailable.');
    expect(component.isLoading).toBeFalse();
    expect(component.teacherName).toBe('Ms Rao');

    timetableService.getTeacherTimetable.and.returnValue(of([timetableEntry()]));
    component.retryTodayClasses();
    expect(component.todayClassesError).toBeNull();
    expect(timetableService.getTeacherTimetable).toHaveBeenCalledTimes(2);
    expect(teacherService.getTeacher).toHaveBeenCalledTimes(1);
  });

  it('keeps existing class-teacher dashboard loading independent', () => {
    teacherService.getTeacher.and.returnValue(of({ name: 'Mr Shah', classTeacher: 'X' }));
    studentService.getActiveStudentsByClass.and.returnValue(of([{ studentId: 'S1' }]));
    attendanceService.getSheet.and.returnValue(of(null));
    leaveService.getLeavesPaginated.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0 }));
    attendanceService.getClassSummary.and.returnValue(of([]));
    const component = build();
    component.ngOnInit();
    expect(component.isClassTeacher).toBeTrue();
    expect(component.totalStudents).toBe(1);
    expect(component.isLoading).toBeFalse();
  });

  it('a class-data failure never fabricates "0 active students" / "no pending requests" — it flags classDataFailed instead', () => {
    teacherService.getTeacher.and.returnValue(of({ name: 'Mr Shah', classTeacher: 'X' }));
    studentService.getActiveStudentsByClass.and.returnValue(throwError(() => new Error('offline')));
    attendanceService.getSheet.and.returnValue(of(null));
    leaveService.getLeavesPaginated.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0 }));
    attendanceService.getClassSummary.and.returnValue(of([]));
    const component = build();
    component.ngOnInit();
    expect(component.classDataFailed).toBeTrue();
    expect(component.isLoading).toBeFalse();
    // Nothing else on the dashboard should be disturbed by this isolated failure.
    expect(component.teacherName).toBe('Mr Shah');
    expect(component.todayView.hasAnyToday).toBeFalse();
  });

  it('retrying class data re-requests only the class-data sources, and clears the failure on success', () => {
    teacherService.getTeacher.and.returnValue(of({ name: 'Mr Shah', classTeacher: 'X' }));
    studentService.getActiveStudentsByClass.and.returnValue(throwError(() => new Error('offline')));
    attendanceService.getSheet.and.returnValue(of(null));
    leaveService.getLeavesPaginated.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0 }));
    attendanceService.getClassSummary.and.returnValue(of([]));
    const component = build();
    component.ngOnInit();
    expect(component.classDataFailed).toBeTrue();

    studentService.getActiveStudentsByClass.and.returnValue(of([{ studentId: 'S1' }]));
    component.loadClassData();
    expect(component.classDataFailed).toBeFalse();
    expect(component.totalStudents).toBe(1);
    expect(timetableService.getTeacherTimetable).toHaveBeenCalledTimes(1);
    expect(teacherService.getTeacher).toHaveBeenCalledTimes(1);
  });

  it('reads today\'s explicit statuses and a weighted monthly rate (Attendance V2)', () => {
    teacherService.getTeacher.and.returnValue(of({ name: 'Mr Shah', classTeacher: 'X' }));
    studentService.getActiveStudentsByClass.and.returnValue(of([{ studentId: 'S1' }, { studentId: 'S2' }, { studentId: 'S3' }]));
    attendanceService.getSheet.and.returnValue(of({
      submitted: true, markable: true, students: [
        { studentId: 'S1', name: 'A', status: 'PRESENT', approvedLeave: false },
        { studentId: 'S2', name: 'B', status: 'ABSENT', approvedLeave: true },
        { studentId: 'S3', name: 'C', status: 'PRESENT', approvedLeave: false },
      ],
    }));
    leaveService.getLeavesPaginated.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0 }));
    attendanceService.getClassSummary.and.returnValue(of([
      { studentId: 'S1', studentName: 'A', totalWorkingDays: 20, daysPresent: 20, daysAbsent: 0, approvedLeaveDays: 0, attendancePercentage: 100 },
      { studentId: 'S2', studentName: 'B', totalWorkingDays: 2, daysPresent: 0, daysAbsent: 2, approvedLeaveDays: 1, attendancePercentage: 0 },
    ]));
    const component = build();
    component.ngOnInit();

    expect(attendanceService.getSheet).toHaveBeenCalledWith(null);
    expect(component.attendanceTaken).toBeTrue();
    expect(component.todayPresentCount).toBe(2);
    expect(component.todayAbsent).toBe(1);
    expect(component.monthlyAttendanceRate).toBe(90.9); // 20 / 22, not the 50% average of percentages
  });

  it('an unsubmitted day shows as not marked', () => {
    teacherService.getTeacher.and.returnValue(of({ name: 'Mr Shah', classTeacher: 'X' }));
    studentService.getActiveStudentsByClass.and.returnValue(of([{ studentId: 'S1' }]));
    attendanceService.getSheet.and.returnValue(of({ submitted: false, markable: true, students: [
      { studentId: 'S1', name: 'A', status: null, approvedLeave: false }] }));
    leaveService.getLeavesPaginated.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0 }));
    attendanceService.getClassSummary.and.returnValue(of([]));
    const component = build();
    component.ngOnInit();

    expect(component.attendanceTaken).toBeFalse();
    expect(component.todayAbsent).toBe(0);
    expect(component.monthlyAttendanceRate).toBe(0);
  });

  it('uses the existing timetable route for the dashboard action', () => {
    expect(build().timetableRoute).toBe('/dashboard/timetable');
  });

  // ─── Teacher substitution — cover classes appear in Today's Classes ───

  const coverClass = (overrides: Partial<TeacherSubstitution> = {}): TeacherSubstitution => ({
    id: 9, revision: 0, date: '2026-09-17', timetableEntryId: 55,
    originalTeacherId: 'T9', originalTeacherName: 'Mr Original',
    substituteTeacherId: 'T1', substituteTeacherName: 'Ms Rao',
    className: 'VII', sectionName: null, subjectName: 'Science', periodNumber: 5,
    startTime: '12:00', endTime: '12:40', status: 'ACTIVE', assignedBy: 'A1',
    assignedAt: '2026-09-17T08:00:00', updatedAt: '2026-09-17T08:00:00',
    ...overrides,
  });

  it('merges an active cover class alongside normal timetable entries in Today\'s Classes', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ id: 1, startTime: '09:10', endTime: '09:50' }),
    ]));
    substitutionService.getMine.and.returnValue(of([coverClass()]));
    const component = build();
    component.ngOnInit();

    expect(substitutionService.getMine).toHaveBeenCalledWith('2026-09-17');
    const cover = component.todayView.upcoming.find(e => e.subjectName === 'Science');
    expect(cover).toBeTruthy();
    expect(cover!.isSubstitution).toBeTrue();
    expect(cover!.originalTeacherName).toBe('Mr Original');
    expect(cover!.className).toBe('VII');
  });

  it('counts only current or upcoming cover classes for teacher attention', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([]));
    substitutionService.getMine.and.returnValue(of([coverClass()]));
    const component = build();
    component.ngOnInit();

    expect(component.coverClassCount).toBe(1);
    component.todayView = { current: null, upcoming: [], allDone: true, hasAnyToday: true };
    expect(component.coverClassCount).toBe(0);
  });

  it('never marks a normal (non-cover) class as a substitution', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ id: 1, startTime: '09:10', endTime: '09:50' }),
    ]));
    substitutionService.getMine.and.returnValue(of([coverClass()]));
    const component = build();
    component.ngOnInit();

    const normal = component.todayView.current;
    expect(normal?.isSubstitution).toBeFalse();
  });

  it('shows Today\'s Classes normally when the teacher has no cover classes today', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ id: 1, startTime: '09:10', endTime: '09:50' }),
    ]));
    substitutionService.getMine.and.returnValue(of([]));
    const component = build();
    component.ngOnInit();

    expect(component.todayView.current?.isSubstitution).toBeFalse();
    expect(component.timetableEntries.length).toBe(1);
  });

  it('a substitution-lookup failure does not block or error the rest of Today\'s Classes', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ id: 1, startTime: '09:10', endTime: '09:50' }),
    ]));
    substitutionService.getMine.and.returnValue(throwError(() => new Error('offline')));
    const component = build();
    component.ngOnInit();

    expect(component.todayClassesLoading).toBeFalse();
    expect(component.todayClassesError).toBeNull();
    expect(component.todayView.current?.subjectName).toBe('English');
    expect(component.todayView.current?.isSubstitution).toBeFalse();
  });

  it('a cover class carries who it replaces and the admin\'s note', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([]));
    substitutionService.getMine.and.returnValue(of([coverClass({ note: 'Worksheet on desk' })]));
    const component = build();
    component.ngOnInit();

    const cover = component.todayView.upcoming.find(e => e.isSubstitution)!;
    expect(cover.originalTeacherName).toBe('Mr Original');
    expect(cover.substitutionNote).toBe('Worksheet on desk');
  });

  it('loads tomorrow\'s cover periods for the substitute', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([]));
    substitutionService.getMine.and.callFake((date: string) =>
      of(date === '2026-09-18' ? [coverClass({ id: 12, date: '2026-09-18', note: 'Test paper' })] : []));
    const component = build();
    component.ngOnInit();

    expect(substitutionService.getMine).toHaveBeenCalledWith('2026-09-18');
    expect(component.tomorrowCovers.map(c => c.id)).toEqual([12]);
  });

  it('shows the teacher\'s own periods and who covers them on a day they are away', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([]));
    substitutionService.getMyCoverage.and.returnValue(of({
      date: '2026-09-17', unavailable: true, unavailabilityReason: 'APPROVED_LEAVE',
      periods: [
        { timetableEntryId: 1, periodNumber: 2, startTime: '09:50', endTime: '10:30', className: 'VIII', sectionName: 'A', subjectName: 'English', covered: true, substituteTeacherName: 'Ms Rao' },
        { timetableEntryId: 2, periodNumber: 4, startTime: '11:10', endTime: '11:50', className: 'IX', sectionName: null, subjectName: 'English', covered: false, substituteTeacherName: null },
      ],
    }));
    const component = build();
    component.ngOnInit();

    expect(substitutionService.getMyCoverage).toHaveBeenCalledWith('2026-09-17');
    expect(component.showMyCoverage).toBeTrue();
    expect(component.myCoverageReason()).toBe('on leave');
  });

  it('hides the own-coverage card when the teacher is not away, and a lookup failure hides the extras only', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([timetableEntry({ id: 1, startTime: '09:10', endTime: '09:50' })]));
    substitutionService.getMyCoverage.and.returnValue(throwError(() => new Error('offline')));
    const component = build();
    component.ngOnInit();

    expect(component.showMyCoverage).toBeFalse();
    expect(component.todayClassesError).toBeNull();
    expect(component.timetableEntries.length).toBe(1);
  });

  // ─── Show Time parity — a per-device viewer preference, not a school/admin setting ───

  describe('show-times preference (shared localStorage key with the Timetable page)', () => {
    afterEach(() => localStorage.removeItem('tt_showTimes'));

    it('A: show times ON (the default) renders a valid time range', () => {
      localStorage.removeItem('tt_showTimes'); // unset == on
      timetableService.getTeacherTimetable.and.returnValue(of([timetableEntry({ startTime: '09:10', endTime: '09:50' })]));
      const component = build();
      component.ngOnInit();
      expect(component.showTimes).toBeTrue();
      expect(component.classTimeRange(component.todayView.current!)).toBe('9:10 AM – 9:50 AM');
    });

    it('B: show times OFF suppresses the time range entirely (never renders a placeholder)', () => {
      localStorage.setItem('tt_showTimes', 'false');
      timetableService.getTeacherTimetable.and.returnValue(of([timetableEntry({ startTime: '09:10', endTime: '09:50' })]));
      const component = build();
      component.ngOnInit();
      expect(component.showTimes).toBeFalse();
      expect(component.classTimeRange(component.todayView.current!)).toBeNull();
    });

    it('C: show times OFF still allows internal current/next classification using real start/end times', () => {
      localStorage.setItem('tt_showTimes', 'false');
      timetableService.getTeacherTimetable.and.returnValue(of([
        timetableEntry({ id: 1, startTime: '09:10', endTime: '09:50' }), // covers mocked "now" 09:30
        timetableEntry({ id: 2, startTime: '10:00', endTime: '10:40', className: 'IX' }),
      ]));
      const component = build();
      component.ngOnInit();
      expect(component.todayView.current?.key).toBe('1');
      expect(component.todayView.upcoming[0].key).toBe('2');
    });

    it('D: re-enabling show times (new component instance) renders the time again', () => {
      timetableService.getTeacherTimetable.and.returnValue(of([timetableEntry({ startTime: '09:10', endTime: '09:50' })]));

      localStorage.setItem('tt_showTimes', 'false');
      const off = build();
      off.ngOnInit();
      expect(off.classTimeRange(off.todayView.current!)).toBeNull();

      localStorage.setItem('tt_showTimes', 'true');
      const on = build();
      on.ngOnInit();
      expect(on.classTimeRange(on.todayView.current!)).toBe('9:10 AM – 9:50 AM');
    });

    it('N: the preference is read synchronously at construction, so it can never briefly show times before the real value is known', () => {
      localStorage.setItem('tt_showTimes', 'false');
      const component = build(); // showTimes is already correct before ngOnInit or any subscription resolves
      expect(component.showTimes).toBeFalse();
    });
  });

  // ─── Period number + subject icon — reused from the existing timetable, never hidden ───

  it('E/F: period number renders and remains visible regardless of the show-times preference', () => {
    localStorage.setItem('tt_showTimes', 'false');
    timetableService.getTeacherTimetable.and.returnValue(of([timetableEntry({ periodNumber: 3, startTime: '09:10', endTime: '09:50' })]));
    const component = build();
    component.ngOnInit();
    expect(component.periodClassLabel(component.todayView.current!)).toBe('Period 3 · Class X');
    localStorage.removeItem('tt_showTimes');
  });

  it('G: reuses the existing timetable subject-icon mapping rather than a separate one', () => {
    const component = build();
    expect(component.getSubjectIcon('Physics')).toBe('⚛️');
    expect(component.getSubjectIcon('Mathematics')).toBe('🔢');
    expect(component.getSubjectIcon('Something Unmapped')).toBe('📚');
  });

  it('H: a missing/zero period number still degrades cleanly (no crash, no invented label)', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([timetableEntry({ periodNumber: 0 as any })]));
    const component = build();
    component.ngOnInit();
    const entry = component.todayView.current!; // default times (09:10-09:50) cover mocked "now" 09:30
    expect(() => component.periodClassLabel(entry)).not.toThrow();
    expect(component.periodClassLabel(entry)).toBe('Period 0 · Class X');
  });

  it('I/J: an untimed entry follows Period N behaviour and is never classified Current', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ id: 1, periodNumber: 2, startTime: null as any, endTime: null as any }),
    ]));
    const component = build();
    component.ngOnInit();
    expect(component.todayView.current).toBeNull();
    expect(component.todayView.upcoming[0].status).toBe('scheduled');
  });

  it('K: current/next/later classification and labels remain correct with the new row layout', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ id: 1, startTime: '09:10', endTime: '09:50' }), // current at mocked 09:30
      timetableEntry({ id: 2, startTime: '10:00', endTime: '10:40' }),
      timetableEntry({ id: 3, startTime: '11:00', endTime: '11:40' }),
    ]));
    const component = build();
    component.ngOnInit();
    expect(component.todayView.current?.key).toBe('1');
    expect(component.todayView.upcoming.map(e => e.key)).toEqual(['2', '3']);
  });

  it('L: the visible list is still capped at 3 rows total (current + upcoming)', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      timetableEntry({ id: 1, startTime: '09:10', endTime: '09:50' }),
      timetableEntry({ id: 2, startTime: '10:00', endTime: '10:40' }),
      timetableEntry({ id: 3, startTime: '11:00', endTime: '11:40' }),
      timetableEntry({ id: 4, startTime: '12:00', endTime: '12:40' }),
    ]));
    const component = build();
    component.ngOnInit();
    expect(1 + component.todayView.upcoming.length).toBeLessThanOrEqual(3);
  });

  it('M: empty/error/completed states remain intact', () => {
    const component = build();
    component.ngOnInit();
    expect(component.todayView.hasAnyToday).toBeFalse(); // no timetable / no classes today

    timetableService.getTeacherTimetable.and.returnValue(of([timetableEntry({ startTime: '08:00', endTime: '08:40' })]));
    component.retryTodayClasses();
    expect(component.todayView.allDone).toBeTrue(); // completed (mocked "now" 09:30 is after 08:40)

    timetableService.getTeacherTimetable.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));
    component.retryTodayClasses();
    expect(component.todayClassesError).toBe('boom');
  });

  // ─── Updates (unread notification count) — reuses the dashboard shell's shared
  //     NotificationService.unreadCountState$ rather than fetching its own copy ───

  it('never calls getUnreadNotificationCount directly — it only subscribes to the shared shell state', () => {
    const component = build();
    component.ngOnInit();
    expect(notificationService.getUnreadNotificationCount).not.toHaveBeenCalled();
  });

  it('renders a positive unread count from the shared shell state', () => {
    notificationService.unreadCountState$ = of({ status: 'success', count: 3 } as UnreadCountState);
    const component = build();
    component.ngOnInit();
    expect(component.unreadCount).toBe(3);
    expect(component.unreadCountLoading).toBeFalse();
    expect(component.unreadCountFailed).toBeFalse();
  });

  it('shows a zero-unread state distinctly from a failed load', () => {
    notificationService.unreadCountState$ = of({ status: 'success', count: 0 } as UnreadCountState);
    const component = build();
    component.ngOnInit();
    expect(component.unreadCount).toBe(0);
    expect(component.unreadCountLoading).toBeFalse();
    expect(component.unreadCountFailed).toBeFalse();
  });

  it('reflects the shared loading state while the shell refresh is still in flight', () => {
    notificationService.unreadCountState$ = new BehaviorSubject<UnreadCountState>({ status: 'loading', count: 0 });
    const component = build();
    component.ngOnInit();
    expect(component.unreadCountLoading).toBeTrue();
    expect(component.unreadCountFailed).toBeFalse();
  });

  it('an unread-count failure never blocks the rest of the dashboard', () => {
    notificationService.unreadCountState$ = of({ status: 'error', count: 0 } as UnreadCountState);
    const component = build();
    component.ngOnInit();
    expect(component.unreadCountFailed).toBeTrue();
    expect(component.unreadCountLoading).toBeFalse();
    // Everything else still loads normally — the dashboard never enters a global error state.
    expect(component.teacherName).toBe('Ms Rao');
    expect(component.isLoading).toBeFalse();
    expect(component.todayView.hasAnyToday).toBeFalse();
  });

  it('reacts live when the shared unread count changes after initial load (e.g. the shell\'s 60s poll)', () => {
    const shared = new BehaviorSubject<UnreadCountState>({ status: 'success', count: 1 });
    notificationService.unreadCountState$ = shared;
    const component = build();
    component.ngOnInit();
    expect(component.unreadCount).toBe(1);

    shared.next({ status: 'success', count: 6 });
    expect(component.unreadCount).toBe(6);
    expect(component.unreadCountLoading).toBeFalse();
    expect(component.unreadCountFailed).toBeFalse();
  });

  it('uses the existing notices route for the Updates CTA', () => {
    expect(build().updatesRoute).toBe('/dashboard/notice');
  });

  // ─── Leave status — derived from the already-fetched recentTeacherLeaves, no new request ───

  it('shows the pending count when the most recent leaves include a pending request', () => {
    teacherLeaveService.getMyLeaves.and.returnValue(of({
      content: [
        { id: 1, teacherId: 'T1', teacherName: 'Ms Rao', startDate: '2026-10-01', endDate: '2026-10-01', reason: 'x', status: 'PENDING', appliedDate: '2026-09-15', days: 1 },
      ], totalElements: 1, totalPages: 1,
    }));
    const component = build();
    component.ngOnInit();
    expect(component.leaveStatusLabel).toBe('1 request pending');
  });

  it('shows a neutral state when there are no pending or current leaves', () => {
    teacherLeaveService.getMyLeaves.and.returnValue(of({
      content: [
        { id: 1, teacherId: 'T1', teacherName: 'Ms Rao', startDate: '2026-08-01', endDate: '2026-08-01', reason: 'x', status: 'REJECTED', appliedDate: '2026-07-15', days: 1 },
      ], totalElements: 1, totalPages: 1,
    }));
    const component = build();
    component.ngOnInit();
    expect(component.leaveStatusLabel).toBe('No pending requests');
  });

  it('prioritizes "on leave today" over a pending count when both exist', () => {
    teacherLeaveService.getMyLeaves.and.returnValue(of({
      content: [
        { id: 1, teacherId: 'T1', teacherName: 'Ms Rao', startDate: '2026-09-16', endDate: '2026-09-18', reason: 'x', status: 'APPROVED', appliedDate: '2026-09-01', days: 3 },
        { id: 2, teacherId: 'T1', teacherName: 'Ms Rao', startDate: '2026-10-01', endDate: '2026-10-01', reason: 'y', status: 'PENDING', appliedDate: '2026-09-15', days: 1 },
      ], totalElements: 2, totalPages: 1,
    }));
    const component = build();
    component.ngOnInit(); // mocked "now" is 2026-09-17, inside the approved 16th-18th range
    expect(component.leaveStatusLabel).toBe('On leave today · Approved');
  });

  it('does not fire a second/duplicate request for the leave status card', () => {
    const component = build();
    component.ngOnInit();
    expect(teacherLeaveService.getMyLeaves).toHaveBeenCalledTimes(1);
  });

  it('uses the existing apply-teacher-leave route for the Leave CTA', () => {
    expect(build().leaveRoute).toBe('/dashboard/apply-teacher-leave');
  });

  // ─── Upcoming event — bounded to at most 2 requests, isolated failure ───

  const event = (overrides: Partial<import('../../interfaces/event-calendar.component').CalendarEvent> = {}) => ({
    id: 1, title: 'Event', description: '', startDate: '2026-09-20', category: 'GENERAL', targetAudience: [],
    ...overrides,
  });

  it('picks the nearest upcoming event, excluding past ones', () => {
    eventService.getEventsForMonthAndYear.and.returnValue(of([
      event({ id: 1, title: 'Past Event', startDate: '2026-09-10' }),
      event({ id: 2, title: 'Sooner Event', startDate: '2026-09-24' }),
      event({ id: 3, title: 'Later Event', startDate: '2026-09-28' }),
    ]));
    const component = build();
    component.ngOnInit();
    expect(component.upcomingEvent?.title).toBe('Sooner Event');
    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledTimes(1);
    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledWith(2026, 9);
  });

  it('falls back to next month when the current month has no upcoming event', () => {
    eventService.getEventsForMonthAndYear.and.returnValue(of([event({ id: 1, title: 'Past Event', startDate: '2026-09-10' })]));
    const component = build();
    component.ngOnInit();

    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledWith(2026, 9);
    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledWith(2026, 10);
    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledTimes(2);
  });

  it('shows a no-event state when neither the current nor next month has one', () => {
    eventService.getEventsForMonthAndYear.and.returnValue(of([]));
    const component = build();
    component.ngOnInit();
    expect(component.upcomingEvent).toBeNull();
    expect(component.upcomingEventLoading).toBeFalse();
    expect(component.upcomingEventFailed).toBeFalse();
  });

  it('isolates an event-load failure — the rest of the dashboard still loads normally', () => {
    eventService.getEventsForMonthAndYear.and.returnValue(throwError(() => new Error('offline')));
    const component = build();
    component.ngOnInit();
    expect(component.upcomingEventFailed).toBeTrue();
    expect(component.upcomingEventLoading).toBeFalse();
    expect(component.teacherName).toBe('Ms Rao');
    expect(component.isLoading).toBeFalse();
  });

  it('formats an event start time using the existing clock-time formatter', () => {
    expect(build().formatEventTime('10:00:00')).toBe('10:00 AM');
  });

  it('uses the existing event-calendar route for the Upcoming Event CTA', () => {
    expect(build().eventsRoute).toBe('/dashboard/event-calendar');
  });
});

// ─── Layout ordering — rendered via TestBed since it's a template-order concern, not state ───

@Component({ selector: 'app-wisdom-cards', standalone: true, template: '' })
class StubWisdomCardsComponent {}

@Component({ selector: 'app-teacher-getting-started', standalone: true, template: '<div class="stub-getting-started">Getting Started</div>', inputs: ['todaysClassesAvailable'] })
class StubTeacherGettingStartedComponent {}

describe('TeacherDashboardComponent layout order', () => {
  let fixture: ComponentFixture<TeacherDashboardComponent>;

  beforeEach(async () => {
    const authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'T1' });
    authState.hasFeature.and.returnValue(false);
    const teacherService = jasmine.createSpyObj('TeacherService', ['getTeacher']);
    teacherService.getTeacher.and.returnValue(of({ name: 'Ms Rao', classTeacher: null }));
    const checkinService = jasmine.createSpyObj('TeacherCheckinService', ['getMyAttendance']);
    checkinService.getMyAttendance.and.returnValue(of({
      totalWorkingDays: 0, presentDays: 0, lateDays: 0, absentDays: 0,
      halfDayDays: 0, onLeaveDays: 0, onTimePercentage: 0,
      attendancePercentage: 0, trackingStartDate: null, records: [],
    }));
    const teacherLeaveService = jasmine.createSpyObj('TeacherLeaveService', ['getMyLeaves']);
    teacherLeaveService.getMyLeaves.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0 }));
    const timetableService = jasmine.createSpyObj('TimetableService', ['getTeacherTimetable']);
    timetableService.getTeacherTimetable.and.returnValue(of([]));
    const substitutionService = jasmine.createSpyObj('TeacherSubstitutionService', ['getMine', 'getMyCoverage']);
    substitutionService.getMine.and.returnValue(of([]));
    substitutionService.getMyCoverage.and.returnValue(of(null as any));
    const notificationService = jasmine.createSpyObj('NotificationService', ['getUnreadNotificationCount']);
    notificationService.getUnreadNotificationCount.and.returnValue(of(2));
    notificationService.unreadCountState$ = of({ status: 'success', count: 2 } as UnreadCountState);
    const eventService = jasmine.createSpyObj('EventService', ['getEventsForMonthAndYear']);
    eventService.getEventsForMonthAndYear.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [TeacherDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStateService, useValue: authState },
        { provide: TeacherService, useValue: teacherService },
        { provide: StudentService, useValue: jasmine.createSpyObj('StudentService', ['getActiveStudentsByClass']) },
        { provide: AttendanceService, useValue: jasmine.createSpyObj('AttendanceService', { getSheet: of(null), getClassSummary: of([]) }) },
        { provide: LeaveService, useValue: jasmine.createSpyObj('LeaveService', ['getLeavesPaginated', 'updateLeaveStatus']) },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'info', 'error']) },
        { provide: TeacherCheckinService, useValue: checkinService },
        { provide: TeacherLeaveService, useValue: teacherLeaveService },
        { provide: TimetableService, useValue: timetableService },
        { provide: TeacherSubstitutionService, useValue: substitutionService },
        { provide: NotificationService, useValue: notificationService },
        { provide: EventService, useValue: eventService },
      ],
    })
      .overrideComponent(TeacherDashboardComponent, {
        set: { imports: [StubWisdomCardsComponent, StubTeacherGettingStartedComponent, CommonModule, RouterLink, MatIconModule] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TeacherDashboardComponent);
    fixture.detectChanges();
  });

  it('keeps Check-in and Today\'s Classes near the top, above Getting Started', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text.indexOf('My attendance')).toBeGreaterThan(-1);
    expect(text.indexOf('Today\'s Classes')).toBeLessThan(text.indexOf('Getting Started'));
    expect(text.indexOf('My attendance')).toBeLessThan(text.indexOf('Getting Started'));
  });

  it('never renders Getting Started above the daily-operational sections (leave, workspaces)', () => {
    const text: string = fixture.nativeElement.textContent;
    const gettingStartedIndex = text.indexOf('Getting Started');
    expect(gettingStartedIndex).toBeGreaterThan(-1);
    expect(text.indexOf('Quick actions')).toBeLessThan(gettingStartedIndex);
    expect(fixture.nativeElement.querySelector('.td-insight-tile.insight-amber')).toBeTruthy();
  });

  it('renders the Updates tile visibly without dominating the layout, using the shared unread-count state', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Updates');
    expect(text).toContain('2');
    const tile = fixture.nativeElement.querySelector('.td-insight-tile.insight-indigo');
    expect(tile).toBeTruthy();
    expect(TestBed.inject(NotificationService).getUnreadNotificationCount).not.toHaveBeenCalled();
  });

  it('keeps Check-in and guarded Mark Attendance in Quick Actions without restoring Timetable or My Leave', () => {
    (TestBed.inject(AuthStateService) as jasmine.SpyObj<AuthStateService>).hasFeature.and.returnValue(true);
    (TestBed.inject(TeacherService) as jasmine.SpyObj<TeacherService>).getTeacher.and.returnValue(of({ teacherId: 'T1', name: 'Ms Rao', classTeacher: 'X' }));
    fixture.destroy();
    fixture = TestBed.createComponent(TeacherDashboardComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.td-actions-grid a[href="/dashboard/teacher-checkin"]')).toBeTruthy();
    expect(root.querySelector('.td-actions-grid a[href="/dashboard/teacher-attendance"]')).toBeTruthy();
    expect(root.querySelector('.td-actions-grid a[href="/dashboard/timetable"]')).toBeNull();
    expect(root.querySelector('.td-actions-grid a[href="/dashboard/apply-teacher-leave"]')).toBeNull();
  });

  it('orders Today\'s Classes, September attendance, Leaves, Updates and Upcoming Event ahead of Quick actions and the class workspace', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(fixture.nativeElement.querySelector('.td-insight-tile.insight-amber')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.td-insight-tile.insight-teal')).toBeTruthy();
    const todayIdx = text.indexOf('Today\'s Classes');
    const attendanceIdx = text.indexOf('September attendance');
    const leavesIdx = text.indexOf('Leaves');
    const updatesIdx = text.indexOf('Updates');
    const eventIdx = text.indexOf('Upcoming Event');
    const quickActionsIdx = text.indexOf('Quick actions');
    const gettingStartedIdx = text.indexOf('Getting Started');
    expect(todayIdx).toBeLessThan(attendanceIdx);
    expect(attendanceIdx).toBeLessThan(leavesIdx);
    expect(leavesIdx).toBeLessThan(updatesIdx);
    expect(updatesIdx).toBeLessThan(eventIdx);
    expect(eventIdx).toBeLessThan(quickActionsIdx);
    expect(quickActionsIdx).toBeLessThan(gettingStartedIdx);
  });
});
