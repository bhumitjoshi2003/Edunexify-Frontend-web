import { WisdomCardsComponent } from '../wisdom/wisdom-cards.component';
import { TeacherGettingStartedComponent } from '../teacher-getting-started/teacher-getting-started.component';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthStateService } from '../../auth/auth-state.service';
import { TeacherService } from '../../services/teacher.service';
import { StudentService } from '../../services/student.service';
import { AttendanceService } from '../../services/attendance.service';
import { LeaveService, LeaveApplication } from '../../services/leave.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { NotificationService } from '../../services/notification.service';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { TeacherAttendanceRecord, TeacherAttendanceSummary } from '../../interfaces/teacher-checkin';
import { TeacherLeaveService } from '../../services/teacher-leave.service';
import { TeacherLeave } from '../../interfaces/teacher-leave';
import { TimetableService } from '../../services/timetable.service';
import { TeacherSubstitutionService } from '../../services/teacher-substitution.service';
import { MyCoverage, TeacherSubstitution } from '../../interfaces/teacher-substitution';
import { TimetableEntry } from '../../interfaces/timetable';
import {
  buildTodayClassesView,
  todayDayCode,
  TeacherTodayClassEntry,
  TeacherTodayClassesView,
} from '../../utils/teacher-timetable-today.util';
import { subjectIcon } from '../../utils/subject-visual.util';
import { isShowTimesEnabled } from '../../utils/timetable-preferences.util';
import { EventService } from '../../services/event.service';
import { CalendarEvent } from '../../interfaces/event-calendar.component';
import { pickNearestUpcomingEvent } from '../../utils/upcoming-event.util';

const EMPTY_TODAY_VIEW: TeacherTodayClassesView = {
  current: null,
  upcoming: [],
  allDone: false,
  hasAnyToday: false,
};

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [WisdomCardsComponent, TeacherGettingStartedComponent, CommonModule, RouterLink, MatIconModule],
  templateUrl: './teacher-dashboard.component.html',
  styleUrl: './teacher-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  readonly timetableRoute = '/dashboard/timetable';
  readonly updatesRoute = '/dashboard/notice';
  readonly leaveRoute = '/dashboard/apply-teacher-leave';
  readonly eventsRoute = '/dashboard/event-calendar';

  teacherName = '';
  className = '';
  isClassTeacher = false;
  isLoading = true;
  today = new Date();
  coverClassesHighlighted = false;

  totalStudents = 0;
  todayAbsent = 0;
  todayPresent = 0;
  attendanceTaken = false;
  pendingLeavesCount = 0;
  monthlyAttendanceRate = 0;
  recentLeaves: LeaveApplication[] = [];
  /** true only when the combined class-data request failed — "Class {{ className }} today"
   *  and "Pending approvals" must show a neutral unavailable state instead of the fabricated
   *  "0 active students" / "No pending requests" a blank default would otherwise imply. */
  classDataFailed = false;
  personalAttendance: TeacherAttendanceSummary | null = null;
  todayTeacherRecord: TeacherAttendanceRecord | null = null;
  personalSummaryLoading = true;
  recentTeacherLeaves: TeacherLeave[] = [];
  teacherLeavesLoading = true;
  timetableEntries: TimetableEntry[] = [];
  todayClassesLoading = true;
  todayClassesError: string | null = null;
  todayView: TeacherTodayClassesView = EMPTY_TODAY_VIEW;
  tomorrowCovers: TeacherSubstitution[] = [];
  myCoverage: MyCoverage | null = null;
  unreadCount = 0;
  unreadCountLoading = true;
  /** true only when the unread-count call itself failed — the dashboard must stay fully
   *  usable either way, so this only swaps the Updates panel to a neutral fallback line. */
  unreadCountFailed = false;
  upcomingEvent: CalendarEvent | null = null;
  upcomingEventLoading = true;
  /** true only when both the current-month and (if needed) next-month event calls failed —
   *  the dashboard must stay fully usable either way, this only swaps the Upcoming Event
   *  panel to a neutral fallback line. */
  upcomingEventFailed = false;
  /** Read synchronously at construction — never loaded asynchronously, so the UI can never
   * briefly show clock times before the real "show times" preference is known. This is the
   * same per-device viewer preference as the full Timetable page's own "Show times" toggle
   * (localStorage, not a school/admin setting) — see timetable-preferences.util. */
  readonly showTimes: boolean = isShowTimesEnabled();

  constructor(
    private authState: AuthStateService,
    private teacherService: TeacherService,
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private leaveService: LeaveService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private checkinService: TeacherCheckinService,
    private teacherLeaveService: TeacherLeaveService,
    private timetableService: TimetableService,
    private substitutionService: TeacherSubstitutionService,
    private notificationService: NotificationService,
    private eventService: EventService
  ) {}

  ngOnInit(): void {
    const user = this.authState.getUser();
    if (!user) {
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loadPersonalAttendance();
    this.loadRecentTeacherLeaves();
    this.loadTodayClasses(user.userId);
    this.subscribeToUnreadCount();
    this.loadUpcomingEvent();

    this.teacherService
      .getTeacher(user.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (teacher) => {
          this.teacherName = teacher.name;
          this.className = teacher.classTeacher ?? '';
          this.isClassTeacher = !!teacher.classTeacher;
          this.cdr.markForCheck();

          if (this.isClassTeacher) {
            this.loadClassData();
          } else {
            this.isLoading = false;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.logger.error('Failed to load teacher', err);
          this.isLoading = false;
          this.cdr.markForCheck();
          this.toast.error('Error', 'Failed to load teacher profile.');
        },
      });
  }

  private loadRecentTeacherLeaves(): void {
    this.teacherLeaveService.getMyLeaves(0, 3)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.recentTeacherLeaves = response.content.slice(0, 3);
          this.teacherLeavesLoading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Recent teacher leaves load error:', error);
          this.teacherLeavesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadPersonalAttendance(): void {
    const month = this.today.getMonth() + 1;
    const year = this.today.getFullYear();

    this.checkinService.getMyAttendance(month, year)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: summary => {
          this.personalAttendance = summary;
          const todayKey = this.toLocalDateKey(this.today);
          this.todayTeacherRecord = summary.records.find(record => record.date === todayKey) ?? null;
          this.personalSummaryLoading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Personal attendance summary load error:', error);
          this.personalSummaryLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Reuses the dashboard shell's shared unread-count state (kept fresh by the shell on load,
   *  on navigation, and on its periodic poll) instead of issuing a second, redundant
   *  GET /api/notification/user/unread/count — the shell is always mounted as the parent of
   *  this route, so its refresh is already in flight (or resolved) by the time this
   *  subscribes, and the BehaviorSubject replays the latest value immediately either way.
   *  Isolated from every other dashboard section on purpose — a failure here must never
   *  block or blank out check-in status, Today's Classes, or leave data. */
  private subscribeToUnreadCount(): void {
    this.notificationService.unreadCountState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.unreadCountLoading = state.status === 'loading';
        this.unreadCountFailed = state.status === 'error';
        if (state.status === 'success') this.unreadCount = state.count;
        this.cdr.markForCheck();
      });
  }

  /** Current-month request first; only fires the next-month fallback when the current month
   *  genuinely has no upcoming event left — at most 2 requests, never fired in parallel, and
   *  isolated from the rest of the dashboard so an event failure never blocks anything else. */
  private loadUpcomingEvent(): void {
    this.upcomingEventLoading = true;
    this.upcomingEventFailed = false;
    const now = new Date();

    this.eventService.getEventsForMonthAndYear(now.getFullYear(), now.getMonth() + 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: events => {
          const nearest = pickNearestUpcomingEvent(events, now);
          if (nearest) {
            this.upcomingEvent = nearest;
            this.upcomingEventLoading = false;
            this.cdr.markForCheck();
            return;
          }
          this.loadNextMonthEvent(now);
        },
        error: error => {
          this.logger.error('Upcoming event load error:', error);
          this.upcomingEventLoading = false;
          this.upcomingEventFailed = true;
          this.cdr.markForCheck();
        }
      });
  }

  private loadNextMonthEvent(now: Date): void {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    this.eventService.getEventsForMonthAndYear(nextMonth.getFullYear(), nextMonth.getMonth() + 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: events => {
          // Every date in the next month is trivially in the future, so the same picker works
          // unchanged — no special-casing needed for the fallback.
          this.upcomingEvent = pickNearestUpcomingEvent(events, now);
          this.upcomingEventLoading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Next-month event load error:', error);
          this.upcomingEventLoading = false;
          this.upcomingEventFailed = true;
          this.cdr.markForCheck();
        }
      });
  }

  private toLocalDateKey(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private loadTodayClasses(teacherId: string): void {
    this.todayClassesLoading = true;
    this.todayClassesError = null;
    this.cdr.markForCheck();
    this.loadCoverExtras();

    forkJoin({
      timetable: this.timetableService.getTeacherTimetable(teacherId),
      // Isolated so a substitution-service outage never blocks normal timetable classes —
      // Today's Classes must stay usable either way, just without cover-class markers.
      substitutions: this.substitutionService.getMine(this.toLocalDateKey(new Date())).pipe(
        catchError(error => {
          this.logger.error('Cover-class lookup failed (isolated from timetable load):', error);
          return of([]);
        }),
      ),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ timetable, substitutions }) => {
          const coverEntries: TimetableEntry[] = substitutions.map(item => ({
            id: -item.id,
            className: item.className,
            sectionName: item.sectionName,
            day: todayDayCode(new Date()),
            periodNumber: item.periodNumber,
            startTime: item.startTime,
            endTime: item.endTime,
            subjectName: item.subjectName,
            teacherId,
            teacherName: item.substituteTeacherName,
            isSubstitution: true,
            originalTeacherName: item.originalTeacherName,
            substitutionNote: item.note ?? null,
            timetableEntryId: item.timetableEntryId,
          }));
          const entries = [...timetable, ...coverEntries];
          this.timetableEntries = entries;
          this.todayView = buildTodayClassesView(entries, new Date());
          this.todayClassesLoading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Today\'s classes load error:', error);
          this.todayClassesError = this.timetableErrorMessage(error);
          this.todayClassesLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Tomorrow's cover periods (as the substitute) and, on a day this teacher is away,
   *  who covers each of their own periods. Both are optional extras: a failure only hides them. */
  private loadCoverExtras(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    forkJoin({
      tomorrow: this.substitutionService.getMine(this.toLocalDateKey(tomorrow)).pipe(catchError(() => of([] as TeacherSubstitution[]))),
      coverage: this.substitutionService.getMyCoverage(this.toLocalDateKey(new Date())).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ tomorrow, coverage }) => {
        this.tomorrowCovers = tomorrow ?? [];
        this.myCoverage = coverage;
        this.cdr.markForCheck();
      });
  }

  get showMyCoverage(): boolean {
    return !!this.myCoverage?.unavailable && !!this.myCoverage.periods?.length;
  }

  myCoverageReason(): string {
    switch (this.myCoverage?.unavailabilityReason) {
      case 'APPROVED_LEAVE': return 'on leave';
      case 'ABSENT': return 'marked absent';
      case 'ON_LEAVE': return 'marked on leave';
      default: return 'away';
    }
  }

  coverClassLabel(item: { className: string; sectionName?: string | null }): string {
    return item.sectionName ? `Class ${item.className} – ${item.sectionName}` : `Class ${item.className}`;
  }

  retryTodayClasses(): void {
    const teacherId = this.authState.getUser()?.userId;
    if (teacherId) this.loadTodayClasses(teacherId);
  }

  classLabel(entry: TeacherTodayClassEntry): string {
    return entry.sectionName
      ? `Class ${entry.className} – ${entry.sectionName}`
      : `Class ${entry.className}`;
  }

  /** Period identity + class — always shown regardless of the "show times" preference,
   * since that preference only governs clock-time visibility (see classTimeRange). */
  periodClassLabel(entry: TeacherTodayClassEntry): string {
    return `Period ${entry.periodNumber} · ${this.classLabel(entry)}`;
  }

  getSubjectIcon(subjectName: string): string {
    return subjectIcon(subjectName);
  }

  /**
   * The clock-time range, or null when there's nothing genuine to show — either the entry
   * has no reliable start/end time (an untimed "scheduled" fallback entry) or the viewer's
   * "show times" preference is off. Never invents a time and never returns a placeholder
   * like "--": the template hides the whole time element when this is null, so the row
   * layout reclaims that space instead of leaving it blank.
   */
  classTimeRange(entry: TeacherTodayClassEntry): string | null {
    if (!this.showTimes) return null;
    if (!entry.startTime || !entry.endTime) return null;
    return `${this.formatClockTime(entry.startTime)} – ${this.formatClockTime(entry.endTime)}`;
  }

  /** Reuses the exact same "HH:mm" → "h:mm AM/PM" formatting already used for class period
   *  times — an event's startTime comes from the same LocalTime-shaped backend field. */
  formatEventTime(value: string): string {
    return this.formatClockTime(value);
  }

  private formatClockTime(value: string): string {
    const match = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!match) return value;
    const hour = Number(match[1]);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${match[2]} ${suffix}`;
  }

  private timetableErrorMessage(error: any): string {
    const message = error?.error?.message;
    if (typeof message === 'string' && message.trim() && !/<[a-z][\s\S]*>/i.test(message)) {
      return message.trim();
    }
    return 'Unable to load today\'s classes.';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadClassData(): void {
    this.classDataFailed = false;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    forkJoin({
      students: this.studentService.getActiveStudentsByClass(this.className),
      // Today's sheet for the teacher's own class/section (the server picks the school's today).
      // A sheet failure (e.g. no current session) only hides today's figures.
      todaySheet: this.attendanceService.getSheet(null).pipe(catchError(err => {
        this.logger.error('Failed to load today\'s attendance', err);
        return of(null);
      })),
      leaves: this.leaveService.getLeavesPaginated(0, 50, this.className),
      summary: this.attendanceService.getClassSummary(this.className, { year, month }),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ students, todaySheet, leaves, summary }) => {
          this.totalStudents = students.length;
          this.attendanceTaken = !!todaySheet?.submitted;
          const todayRows = this.attendanceTaken ? todaySheet!.students : [];
          this.todayAbsent = todayRows.filter(s => s.status === 'ABSENT').length;
          this.todayPresent = todayRows.filter(s => s.status === 'PRESENT').length;

          const pending = leaves.content.filter((l) => l.status === 'PENDING');
          this.pendingLeavesCount = pending.length;
          this.recentLeaves = pending.slice(0, 10);

          // Class rate = all present days / all submitted days (the same formula as each student's %).
          const workingDays = summary.reduce((sum, s) => sum + s.totalWorkingDays, 0);
          const presentDays = summary.reduce((sum, s) => sum + s.daysPresent, 0);
          this.monthlyAttendanceRate = workingDays > 0 ? Math.round(presentDays * 1000 / workingDays) / 10 : 0;

          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load class data', err);
          this.classDataFailed = true;
          this.isLoading = false;
          this.cdr.markForCheck();
          this.toast.error('Error', 'Failed to load class data.');
        },
      });
  }

  approveLeave(leaveId: number): void {
    this.leaveService
      .updateLeaveStatus(leaveId, 'APPROVED')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.recentLeaves = this.recentLeaves.filter((l) => l.id !== leaveId);
          this.pendingLeavesCount = Math.max(0, this.pendingLeavesCount - 1);
          this.cdr.markForCheck();
          this.toast.success('Approved', 'Leave has been approved.');
        },
        error: (err) => {
          this.logger.error('Approve failed', err);
          this.toast.error('Error', 'Failed to approve leave.');
        },
      });
  }

  rejectLeave(leaveId: number): void {
    this.leaveService
      .updateLeaveStatus(leaveId, 'REJECTED')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.recentLeaves = this.recentLeaves.filter((l) => l.id !== leaveId);
          this.pendingLeavesCount = Math.max(0, this.pendingLeavesCount - 1);
          this.cdr.markForCheck();
          this.toast.info('Rejected', 'Leave has been rejected.');
        },
        error: (err) => {
          this.logger.error('Reject failed', err);
          this.toast.error('Error', 'Failed to reject leave.');
        },
      });
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  get attendanceColor(): string {
    if (this.monthlyAttendanceRate >= 85) return '#059669';
    if (this.monthlyAttendanceRate >= 70) return '#d97706';
    return '#dc2626';
  }

  get todayPresentCount(): number {
    return this.todayPresent;
  }

  /** Holiday, own day off or approved leave: no attendance owed today (backend rule). */
  get notExpectedToday(): boolean {
    return !this.todayTeacherRecord && this.personalAttendance?.expectedToday === false;
  }

  get personalAttendanceStatus(): string {
    if (!this.todayTeacherRecord) return this.notExpectedToday ? 'Not expected today' : 'Not checked in';
    return this.todayTeacherRecord.status.replaceAll('_', ' ').toLowerCase()
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  get coverClassCount(): number {
    return (this.todayView.current?.isSubstitution ? 1 : 0)
      + this.todayView.upcoming.filter(entry => entry.isSubstitution).length;
  }

  scrollToCoverClasses(): void {
    document.getElementById('todays-classes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.coverClassesHighlighted = true;
    this.cdr.markForCheck();
    window.setTimeout(() => {
      this.coverClassesHighlighted = false;
      this.cdr.markForCheck();
    }, 1800);
  }

  get checkInNeedsAttention(): boolean {
    if (this.personalSummaryLoading) return false;
    const status = this.todayTeacherRecord?.status;
    return !this.todayTeacherRecord?.checkInTime && status !== 'ON_LEAVE' && status !== 'ABSENT';
  }

  get recentLeaveDecision(): TeacherLeave | null {
    const decided = this.recentTeacherLeaves.find(leave => leave.status === 'APPROVED' || leave.status === 'REJECTED');
    if (!decided?.appliedDate) return null;
    const applied = new Date(decided.appliedDate).getTime();
    return Number.isFinite(applied) && Date.now() - applied <= 7 * 24 * 60 * 60 * 1000 ? decided : null;
  }

  get teacherAttentionLoading(): boolean {
    return this.personalSummaryLoading || this.todayClassesLoading || this.unreadCountLoading || this.teacherLeavesLoading;
  }

  get hasTeacherAttention(): boolean {
    return this.checkInNeedsAttention || this.coverClassCount > 0 || this.unreadCount > 0 || !!this.recentLeaveDecision;
  }

  get personalAttendancePercent(): number {
    return Math.max(0, Math.min(100, this.personalAttendance?.attendancePercentage ?? 0));
  }

  formatAttendanceTime(value: string | null): string {
    if (!value) return '—';
    const time = value.includes('T') ? value.split('T')[1] : value;
    const [hour = '', minute = ''] = time.split(':');
    if (!hour || !minute) return value;
    return `${Number(hour)}:${minute}`;
  }

  /**
   * Derived entirely from `recentTeacherLeaves` — the same 3-most-recent-by-startDate list
   * already fetched for the "My recent leaves" panel — so this adds zero new requests. The
   * teacher-facing `/my-leaves` endpoint has no status filter (unlike the admin endpoint), so
   * fetching a dedicated pending count would mean a second, largely-duplicate call against the
   * same data; reusing what's already loaded is deliberately preferred over that per the
   * "avoid unnecessary backend/frontend work" guidance. This is a best-effort signal from the
   * most recent 3 applications, not an exhaustive lifetime count — accurate for the common
   * case of at most a couple of active/recent leave requests.
   */
  get leaveStatusLabel(): string {
    const todayKey = this.toLocalDateKey(new Date());
    const onLeaveToday = this.recentTeacherLeaves.find(leave =>
      leave.status === 'APPROVED' && leave.startDate <= todayKey && leave.endDate >= todayKey);
    if (onLeaveToday) return 'On leave today · Approved';

    const pendingCount = this.recentTeacherLeaves.filter(leave => leave.status === 'PENDING').length;
    if (pendingCount > 0) return `${pendingCount} request${pendingCount === 1 ? '' : 's'} pending`;

    return 'No pending requests';
  }

  get absentCardState(): 'marked' | 'not-marked' | 'weekend' {
    const day = new Date().getDay();
    if (day === 0 || day === 6) return 'weekend';
    if (!this.attendanceTaken) return 'not-marked';
    return 'marked';
  }

  hasFeature(featureKey: string): boolean {
    return this.authState.hasFeature(featureKey);
  }
}
