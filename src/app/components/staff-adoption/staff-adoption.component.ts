import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { StaffAdoptionService } from '../../services/staff-adoption.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { StaffAdoptionResponse, StaffAdoptionTeacherRow } from '../../interfaces/staff-adoption';
import { StaffAdoptionReminderType } from '../../interfaces/staff-adoption-reminder';
import {
  AdoptionAccountFilter, AdoptionActivityFilter, AdoptionAttendanceFilter, accountStatusLabel, adoptionRatePercent,
  appVersionLabel, filterStaffAdoption, notStartedForSummary, relativeActivityLabel, reminderConfirmDialog, reminderSendResult,
} from '../../utils/staff-adoption.util';

type AccountFilter = AdoptionAccountFilter;
type AttendanceFilter = AdoptionAttendanceFilter;
type ActivityFilter = AdoptionActivityFilter;

interface ReminderOption {
  type: StaffAdoptionReminderType;
  label: string;
  description: string;
}

const REMINDER_OPTIONS: ReminderOption[] = [
  { type: 'NOT_STARTED', label: 'Not started', description: 'Nudge teachers who have not yet signed in.' },
  { type: 'OUTDATED_APP', label: 'Outdated app', description: 'Ask teachers to update the Edunexify Android app.' },
  { type: 'ONBOARDING_INCOMPLETE', label: 'Onboarding incomplete', description: 'Remind teachers to finish Getting Started.' },
];

@Component({
  selector: 'app-staff-adoption',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink],
  templateUrl: './staff-adoption.component.html',
  styleUrl: './staff-adoption.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffAdoptionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  error = false;
  data: StaffAdoptionResponse | null = null;

  searchTerm = '';
  accountFilter: AccountFilter = 'ALL';
  attendanceFilter: AttendanceFilter = 'ALL';
  activityFilter: ActivityFilter = 'ALL';

  readonly reminderOptions = REMINDER_OPTIONS;
  reminderPanelOpen = false;
  selectedReminderType: StaffAdoptionReminderType = 'NOT_STARTED';
  reminderPreviewLoading = false;
  reminderSendLoading = false;
  reminderError: string | null = null;

  constructor(
    private staffAdoptionService: StaffAdoptionService,
    private logger: LoggerService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.staffAdoptionService.getStaffAdoption().pipe(takeUntil(this.destroy$)).subscribe({
      next: response => {
        this.data = response;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: e => {
        this.logger.error('Staff adoption load error:', e);
        this.loading = false;
        this.error = true;
        this.cdr.markForCheck();
      }
    });
  }

  /** Shared rules: utils/staff-adoption.util.ts (the same population and labels on both clients). */
  get notStartedForSummary(): number {
    return notStartedForSummary(this.data);
  }

  get adoptionRatePercent(): number {
    return adoptionRatePercent(this.data);
  }

  get filteredTeachers(): StaffAdoptionTeacherRow[] {
    if (!this.data) return [];
    return filterStaffAdoption(this.data.teachers, {
      search: this.searchTerm, account: this.accountFilter, attendance: this.attendanceFilter, activity: this.activityFilter,
    }, new Date());
  }

  statusLabel(status: StaffAdoptionTeacherRow['accountStatus']): string {
    return accountStatusLabel(status);
  }

  statusClass(status: StaffAdoptionTeacherRow['accountStatus']): string {
    return 'sa-chip-' + status.toLowerCase().replace(/_/g, '-');
  }

  onboardingLabel(teacher: StaffAdoptionTeacherRow): string {
    return teacher.onboardingStatus === 'COMPLETED' ? 'Completed' : 'Not reported';
  }

  appStatusLabel(teacher: StaffAdoptionTeacherRow): string {
    return appVersionLabel(teacher);
  }

  formatDate(value: string | null): string {
    return relativeActivityLabel(value, new Date());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Reminders (admin-triggered, never automatic) ────────────────

  toggleReminderPanel(): void {
    this.reminderPanelOpen = !this.reminderPanelOpen;
    this.reminderError = null;
    this.cdr.markForCheck();
  }

  /** Preview → confirm → send. The backend re-resolves recipients itself from `type` alone;
   *  this only ever asks it to preview, then to send — it never submits a recipient list. */
  previewAndSendReminder(): void {
    if (this.reminderPreviewLoading || this.reminderSendLoading) return;
    const type = this.selectedReminderType;
    this.reminderPreviewLoading = true;
    this.reminderError = null;
    this.cdr.markForCheck();

    this.staffAdoptionService.previewReminder(type).pipe(takeUntil(this.destroy$)).subscribe({
      next: preview => {
        this.reminderPreviewLoading = false;
        this.cdr.markForCheck();
        if (preview.count === 0) {
          this.toast.info('No recipients', 'No teachers currently match this reminder.');
          return;
        }
        this.confirmAndSend(type, preview.count, preview.teachers.map(t => t.name));
      },
      error: e => {
        this.logger.error('Reminder preview failed:', e);
        this.reminderPreviewLoading = false;
        this.reminderError = 'Could not load recipients. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  private confirmAndSend(type: StaffAdoptionReminderType, count: number, names: string[]): void {
    this.toast.confirm(reminderConfirmDialog(count, names)).then(confirmed => {
      if (!confirmed) return;
      this.sendReminder(type);
    });
  }

  private sendReminder(type: StaffAdoptionReminderType): void {
    this.reminderSendLoading = true;
    this.cdr.markForCheck();

    this.staffAdoptionService.sendReminder(type).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        this.reminderSendLoading = false;
        this.reminderPanelOpen = false;
        this.cdr.markForCheck();
        this.toastForSendResult(result.sentCount, result.skippedRecentCount);
      },
      error: e => {
        this.logger.error('Reminder send failed:', e);
        this.reminderSendLoading = false;
        this.reminderError = 'Could not send the reminder. Please try again.';
        this.cdr.markForCheck();
        this.toast.error('Error', 'Failed to send reminder. Please try again.');
      }
    });
  }

  private toastForSendResult(sentCount: number, skippedRecentCount: number): void {
    const result = reminderSendResult(sentCount, skippedRecentCount);
    this.toast[result.level](result.title, result.message);
  }
}
