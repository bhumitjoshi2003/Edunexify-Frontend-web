import { schoolDateKey } from '../../utils/school-date.util';
import { formatTeacherAttendanceTime, teacherAttendanceErrorMessage } from '../../utils/teacher-attendance.util';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, interval, takeUntil, forkJoin, shareReplay } from 'rxjs';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { TeacherAttendanceRecord, TeacherAttendanceSummary } from '../../interfaces/teacher-checkin';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';

interface CalendarDay {
  date: number | null;
  status: string;
  fullDate: string;
}

@Component({
  selector: 'app-teacher-checkin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-checkin.component.html',
  styleUrl: './teacher-checkin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherCheckinComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private monthlyRequest$ = new Subject<void>();
  private schoolTimezone = 'Asia/Kolkata';
  private calendarReady = false;

  userName = '';
  currentTime = '';
  todayRecord: TeacherAttendanceRecord | null = null;
  /** False on a holiday, the teacher's own day off or approved leave (backend rule); null = unknown. */
  expectedToday: boolean | null = null;
  monthlyData: TeacherAttendanceSummary | null = null;
  calendarDays: CalendarDay[] = [];

  selectedMonth: number;
  selectedYear: number;

  isLoading = false;
  todayStateResolved = false;
  attendanceLoadError: string | null = null;
  isCheckingIn = false;
  isCheckingOut = false;
  gpsError: string | null = null;

  readonly CALENDAR_SKELETON_COUNT = 35;
  skeletonDays = Array(this.CALENDAR_SKELETON_COUNT);

  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  constructor(
    private checkinService: TeacherCheckinService,
    private authState: AuthStateService,
    private logger: LoggerService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
  }

  ngOnInit(): void {
    const user = this.authState.getUser();
    this.userName = user?.name ?? 'Teacher';
    this.updateTime();
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => this.updateTime());
    this.loadCalendar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateTime(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: this.schoolTimezone });
    this.cdr.markForCheck();
  }

  get greeting(): string {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: this.schoolTimezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  get todayDateStr(): string {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: this.schoolTimezone });
  }

  get hasCheckedIn(): boolean {
    return !!this.todayRecord?.checkInTime;
  }

  get hasCheckedOut(): boolean {
    return !!this.todayRecord?.checkOutTime;
  }

  private loadCalendar(): void {
    this.todayStateResolved = false;
    this.attendanceLoadError = null;
    this.checkinService.getCalendarConfig().pipe(takeUntil(this.destroy$)).subscribe({
      next: config => {
        this.schoolTimezone = config.timezone || 'Asia/Kolkata';
        this.calendarReady = true;
        this.loadCurrentMonth();
      },
      error: err => {
        this.attendanceLoadError = teacherAttendanceErrorMessage(err, "We could not load the school calendar. Please retry.");
        this.cdr.markForCheck();
      },
    });
  }

  loadMonthlyData(): void {
    this.monthlyRequest$.next();
    this.isLoading = true;
    this.todayStateResolved = false;
    this.attendanceLoadError = null;
    const today = schoolDateKey(new Date(), this.schoolTimezone);
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const selected$ = this.checkinService.getMyAttendance(this.selectedMonth, this.selectedYear).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    const today$ = this.selectedMonth === month && this.selectedYear === year
      ? selected$ : this.checkinService.getMyAttendance(month, year);
    this.cdr.markForCheck();
    forkJoin({ selected: selected$, today: today$ }).pipe(takeUntil(this.monthlyRequest$), takeUntil(this.destroy$)).subscribe({
      next: data => {
        this.monthlyData = data.selected;
        this.todayRecord = data.today.records.find(r => r.date === today) ?? null;
        this.expectedToday = data.today.expectedToday ?? null;
        this.buildCalendar(data.selected);
        this.isLoading = false;
        this.todayStateResolved = true;
        if (this.expectedToday === null && !this.todayRecord) {
          this.todayStateResolved = false;
          this.attendanceLoadError = "Today's attendance eligibility could not be confirmed. Please retry.";
        }
        this.cdr.markForCheck();
      },
      error: err => {
        this.logger.error('Failed to load attendance data', err);
        this.isLoading = false;
        this.attendanceLoadError = teacherAttendanceErrorMessage(err, "We could not load today's attendance. Check your connection and try again.");
        this.cdr.markForCheck();
      },
    });
  }

  private buildCalendar(data: TeacherAttendanceSummary): void {
    const recordMap = new Map<string, string>();
    data.records.forEach(r => recordMap.set(r.date, r.status));

    const year = this.selectedYear;
    const month = this.selectedMonth - 1;
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Monday=0 start
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: CalendarDay[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push({ date: null, status: '', fullDate: '' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const status = data.trackingStartDate && dateStr < data.trackingStartDate
        ? 'NOT_TRACKED'
        : (recordMap.get(dateStr) ?? '');
      days.push({ date: d, status, fullDate: dateStr });
    }
    this.calendarDays = days;
  }

  async checkIn(): Promise<void> {
    if (!this.todayStateResolved || this.expectedToday !== true || this.todayRecord) return;
    if (this.hasCheckedIn) {
      this.toast.warning('Already Checked In', 'You have already checked in for today.');
      return;
    }
    const requestDay = schoolDateKey(new Date(), this.schoolTimezone);
    this.isCheckingIn = true;
    this.gpsError = null;
    this.cdr.markForCheck();
    try {
      const pos = await this.getPosition();
      if (!this.todayStateResolved || this.expectedToday !== true || this.todayRecord || schoolDateKey(new Date(), this.schoolTimezone) !== requestDay) {
        this.isCheckingIn = false;
        this.cdr.markForCheck();
        return;
      }
      this.checkinService.checkIn({ latitude: pos.latitude, longitude: pos.longitude })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (record) => {
            this.todayRecord = record;
            this.isCheckingIn = false;
            if (record.status === 'ON_TIME') {
              this.toast.success('Checked In', 'You are on time! Have a great day.');
            } else {
              this.toast.warning('Checked In — Late', 'You were marked as LATE.');
            }
            this.loadMonthlyData();
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.isCheckingIn = false;
            const msg = teacherAttendanceErrorMessage(err, 'Check-in failed. Please try again.');
            this.toast.error('Check-in Failed', msg);
            this.cdr.markForCheck();
          }
        });
    } catch (err: any) {
      this.isCheckingIn = false;
      this.gpsError = err?.message || 'Could not get your location.';
      this.toast.error('GPS Error', this.gpsError!);
      this.cdr.markForCheck();
    }
  }

  async checkOut(): Promise<void> {
    if (!this.todayStateResolved) return;
    if (!this.hasCheckedIn) {
      this.toast.warning('Not Checked In', 'You must check in before checking out.');
      return;
    }
    if (this.hasCheckedOut) {
      this.toast.warning('Already Checked Out', 'You have already checked out for today.');
      return;
    }
    this.isCheckingOut = true;
    this.gpsError = null;
    this.cdr.markForCheck();
    try {
      const pos = await this.getPosition();
      this.checkinService.checkOut({ latitude: pos.latitude, longitude: pos.longitude })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (record) => {
            this.todayRecord = record;
            this.isCheckingOut = false;
            this.toast.success('Checked Out', 'Have a nice evening!');
            this.loadMonthlyData();
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.isCheckingOut = false;
            const msg = teacherAttendanceErrorMessage(err, 'Check-out failed. Please try again.');
            this.toast.error('Check-out Failed', msg);
            this.cdr.markForCheck();
          }
        });
    } catch (err: any) {
      this.isCheckingOut = false;
      this.gpsError = err?.message || 'Could not get your location.';
      this.toast.error('GPS Error', this.gpsError!);
      this.cdr.markForCheck();
    }
  }

  private getPosition(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(new Error(this.getGpsErrorMessage(err))),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }

  private getGpsErrorMessage(err: GeolocationPositionError): string {
    switch (err.code) {
      case err.PERMISSION_DENIED: return 'Location permission denied. Please enable GPS.';
      case err.POSITION_UNAVAILABLE: return 'Location unavailable. Please try again.';
      case err.TIMEOUT: return 'Location request timed out. Please try again.';
      default: return 'Could not get your location.';
    }
  }

  retryAttendanceLoad(): void {
    if (!this.calendarReady) this.loadCalendar(); else this.loadCurrentMonth();
  }

  private loadCurrentMonth(): void {
    const today = schoolDateKey(new Date(), this.schoolTimezone);
    this.selectedMonth = Number(today.slice(5, 7));
    this.selectedYear = Number(today.slice(0, 4));
    this.loadMonthlyData();
  }

  goToPreviousMonth(): void {
    if (this.selectedMonth === 1) {
      this.selectedMonth = 12;
      this.selectedYear--;
    } else {
      this.selectedMonth--;
    }
    this.loadMonthlyData();
  }

  goToNextMonth(): void {
    const now = new Date();
    if (this.selectedYear === now.getFullYear() && this.selectedMonth === now.getMonth() + 1) return;
    if (this.selectedMonth === 12) {
      this.selectedMonth = 1;
      this.selectedYear++;
    } else {
      this.selectedMonth++;
    }
    this.loadMonthlyData();
  }

  formatCheckInTime(value: string | null): string { return formatTeacherAttendanceTime(value); }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ON_TIME': return 'status-ontime';
      case 'LATE': return 'status-late';
      case 'ABSENT': return 'status-absent';
      case 'ON_LEAVE': return 'status-leave';
      case 'HALF_DAY': return 'status-halfday';
      case 'NOT_TRACKED': return 'status-not-tracked';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ON_TIME': return 'On Time';
      case 'LATE': return 'Late';
      case 'ABSENT': return 'Absent';
      case 'ON_LEAVE': return 'On Leave';
      case 'HALF_DAY': return 'Half Day';
      case 'NOT_TRACKED': return 'Not Tracked';
      default: return status;
    }
  }

  getCellClass(day: CalendarDay): string {
    if (!day.date) return 'cal-empty';
    if (!day.status) return 'cal-nodata';
    return 'cal-' + day.status.toLowerCase().replace('_', '');
  }

  isToday(day: CalendarDay): boolean {
    if (!day.fullDate) return false;
    return day.fullDate === schoolDateKey(new Date(), this.schoolTimezone);
  }
}
