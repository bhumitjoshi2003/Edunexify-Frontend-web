import { WisdomCardsComponent } from '../wisdom/wisdom-cards.component';
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
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ToastService } from '../../services/toast.service';

import { AuthStateService } from '../../auth/auth-state.service';
import { StudentService } from '../../services/student.service';
import { AttendanceService } from '../../services/attendance.service';
import { LeaveService, LeaveApplication } from '../../services/leave.service';
import { LoggerService } from '../../services/logger.service';
import { HomeworkService } from '../../services/homework.service';
import { HomeworkClasswork, dueLabel, homeworkKind } from '../../interfaces/homework';
import { ClassUpdateService } from '../../services/class-update.service';
import { ClassUpdate } from '../../interfaces/class-update';
import { AssessmentService } from '../../services/assessment.service';
import { Assessment, countdownLabel, countdownTone, dateParts } from '../../interfaces/assessment';
import { countLabel, countOnPage } from '../../utils/page-count.util';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [WisdomCardsComponent, CommonModule, RouterLink, MatIconModule],
  templateUrl: './student-dashboard.component.html',
  styleUrl: './student-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  studentId = '';
  studentName = '';
  className = '';
  isLoading = true;
  today = new Date();

  attendancePercentage = 0;
  daysPresent = 0;
  daysAbsent = 0;
  totalWorkingDays = 0;
  lowAttendance = false;
  lowAttendanceThreshold = 75;
  pendingLeavesCount = 0;
  /** "3", or "3+" when the student has more leave requests than the 10 most recent checked. */
  pendingLeavesLabel = '0';
  recentLeaves: LeaveApplication[] = [];

  /** Isolated from the main dashboard load: a homework outage never blocks the rest. */
  todayHomework: HomeworkClasswork[] = [];
  homeworkLoading = true;
  homeworkFailed = false;
  readonly homeworkPreviewLimit = 3;
  readonly homeworkKind = homeworkKind;
  readonly dueLabel = dueLabel;

  /** Recent active class updates — isolated like homework: an outage never blocks the rest. */
  classUpdates: ClassUpdate[] = [];
  classUpdatesLoading = true;
  classUpdatesFailed = false;
  readonly classUpdatesPreviewLimit = 3;

  /** Next few assessments — isolated like homework: an outage never blocks the rest. */
  upcomingAssessments: Assessment[] = [];
  assessmentsLoading = true;
  assessmentsFailed = false;
  readonly assessmentsPreviewLimit = 3;
  readonly assessmentCountdown = (date: string) => countdownLabel(date);
  readonly assessmentCountdownTone = (date: string) => countdownTone(date);
  readonly assessmentParts = dateParts;

  constructor(
    private authState: AuthStateService,
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private leaveService: LeaveService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private homework: HomeworkService,
    private classUpdateService: ClassUpdateService,
    private assessmentService: AssessmentService
  ) {}

  ngOnInit(): void {
    const user = this.authState.getUser();
    if (!user) {
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }
    this.studentId = user.userId;

    this.studentService
      .getStudent(this.studentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (student) => {
          this.studentName = student.name;
          this.className = student.className;
          this.cdr.markForCheck();
          this.loadDashboardData();
        },
        error: (err) => {
          this.logger.error('Failed to load student', err);
          this.isLoading = false;
          this.cdr.markForCheck();
          this.toast.error('Error', 'Failed to load student profile.');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTodayHomework(): void {
    this.homeworkLoading = true;
    this.homeworkFailed = false;
    this.cdr.markForCheck();
    this.homework.studentOn().pipe(takeUntil(this.destroy$)).subscribe({
      next: items => {
        this.todayHomework = items;
        this.homeworkLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.logger.error('Today\'s homework load failed (isolated):', err);
        this.homeworkLoading = false;
        this.homeworkFailed = true;
        this.cdr.markForCheck();
      },
    });
  }

  loadClassUpdates(): void {
    this.classUpdatesLoading = true;
    this.classUpdatesFailed = false;
    this.cdr.markForCheck();
    this.classUpdateService.studentActive(this.classUpdatesPreviewLimit).pipe(takeUntil(this.destroy$)).subscribe({
      next: items => {
        this.classUpdates = items.slice(0, this.classUpdatesPreviewLimit);
        this.classUpdatesLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.logger.error('Class updates load failed (isolated):', err);
        this.classUpdatesLoading = false;
        this.classUpdatesFailed = true;
        this.cdr.markForCheck();
      },
    });
  }

  loadUpcomingAssessments(): void {
    this.assessmentsLoading = true;
    this.assessmentsFailed = false;
    this.cdr.markForCheck();
    this.assessmentService.studentUpcoming(this.assessmentsPreviewLimit).pipe(takeUntil(this.destroy$)).subscribe({
      next: items => {
        this.upcomingAssessments = items.slice(0, this.assessmentsPreviewLimit);
        this.assessmentsLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.logger.error('Upcoming assessments load failed (isolated):', err);
        this.assessmentsLoading = false;
        this.assessmentsFailed = true;
        this.cdr.markForCheck();
      },
    });
  }

  private loadDashboardData(): void {
    this.loadTodayHomework();
    this.loadClassUpdates();
    this.loadUpcomingAssessments();

    forkJoin({
      // Current-session Attendance Insights (the full breakdown lives on the Attendance page).
      summary: this.attendanceService.getMyInsights(),
      leaves: this.leaveService.getLeavesByStudentId(this.studentId, 0, 10),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ summary, leaves }) => {
          this.attendancePercentage = summary.percentage;
          this.daysPresent = summary.present;
          this.daysAbsent = summary.absent;
          this.totalWorkingDays = summary.submittedDays;
          this.lowAttendance = summary.lowAttendance;
          this.lowAttendanceThreshold = summary.lowAttendanceThreshold;

          const sorted = [...leaves.content].sort(
            (a, b) =>
              new Date(b.leaveDate).getTime() - new Date(a.leaveDate).getTime()
          );
          this.recentLeaves = sorted.slice(0, 5);
          // The student leave endpoint has no status filter: count within the latest page and say
          // "N+" when older requests exist, rather than presenting a partial count as the total.
          const pending = countOnPage(leaves, (l) => l.status === 'PENDING');
          this.pendingLeavesCount = pending.count;
          this.pendingLeavesLabel = countLabel(pending);

          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load dashboard data', err);
          this.isLoading = false;
          this.cdr.markForCheck();
          this.toast.error('Error', 'Failed to load dashboard data.');
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
    // Attendance Insights rule: at or above the threshold (75%) is healthy.
    if (this.totalWorkingDays === 0) return '#94a3b8';
    return this.lowAttendance ? '#dc2626' : '#059669';
  }

  getLeaveStatusClass(status: string): string {
    if (status === 'APPROVED') return 'sd-status--approved';
    if (status === 'REJECTED') return 'sd-status--rejected';
    return 'sd-status--pending';
  }

  getLeaveStatusLabel(status: string): string {
    if (status === 'APPROVED') return 'Approved';
    if (status === 'REJECTED') return 'Rejected';
    return 'Pending';
  }

  hasFeature(featureKey: string): boolean {
    return this.authState.hasFeature(featureKey);
  }
}
