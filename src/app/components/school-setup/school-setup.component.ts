import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { LoggerService } from '../../services/logger.service';
import { SchoolService, SchoolSetupHealth, SchoolSetupItem } from '../../services/school.service';
import { Guidance, errorGuidance } from '../../guidance/guidance';
import { GuidanceComponent } from '../guidance/guidance.component';
import { HelpButtonComponent } from '../help-button/help-button.component';

interface SetupAction { label: string; route: string; queryParams?: Record<string, string>; }

@Component({
  selector: 'app-school-setup',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink, GuidanceComponent, HelpButtonComponent],
  templateUrl: './school-setup.component.html',
  styleUrl: './school-setup.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchoolSetupComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  loading = true;
  error = false;
  /** Why the status could not be loaded (Retry), never shown as an empty checklist. */
  loadError: Guidance | null = null;

  /** Academic setup readiness, shown as its own group (RECOMMENDED: never part of the Essentials score). */
  static readonly ACADEMIC_KEYS = ['CLASSES_SECTIONS', 'CLASS_SUBJECTS', 'CLASS_TEACHERS', 'EXAMS', 'REPORT_CARDS'];
  health: SchoolSetupHealth | null = null;

  private readonly actions: Record<string, SetupAction> = {
    SCHOOL_PROFILE: { label: 'Complete profile', route: '/dashboard/school-settings' },
    SCHOOL_LOGO: { label: 'Upload logo', route: '/dashboard/school-settings' },
    ACADEMIC_SESSION: { label: 'Manage sessions', route: '/dashboard/school-settings' },
    TEACHERS: { label: 'Add teachers', route: '/dashboard/register', queryParams: { type: 'teacher' } },
    STUDENTS: { label: 'Add students', route: '/dashboard/student-bulk-import' },
    TIMETABLE: { label: 'Build timetable', route: '/dashboard/timetable' },
    ATTENDANCE_CONFIGURATION: { label: 'Configure attendance', route: '/dashboard/school-settings', queryParams: { tab: 'staff-attendance' } },
    PARENT_CONTACTS: { label: 'Manage parents', route: '/dashboard/parent-bulk-import' },
    FEE_CONFIGURATION: { label: 'Configure fees', route: '/dashboard/fee-rule-config' },
    CLASSES_SECTIONS: { label: 'Manage classes', route: '/dashboard/class-management' },
    CLASS_SUBJECTS: { label: 'Add subjects', route: '/dashboard/subject-config' },
    CLASS_TEACHERS: { label: 'Assign class teachers', route: '/dashboard/timetable', queryParams: { tab: 'setup' } },
    EXAMS: { label: 'Set up exams', route: '/dashboard/exam-config' },
    REPORT_CARDS: { label: 'Set up report cards', route: '/dashboard/report-cards-v2/setup' },
  };

  /** A second step for report cards whose blocker is the exams themselves. */
  private readonly examAction: SetupAction = { label: 'Set up exams', route: '/dashboard/exam-config' };

  constructor(private schoolService: SchoolService, private logger: LoggerService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = false;
    this.loadError = null;
    // Keep any previously loaded content (and the refresh button) visible and merely
    // disabled while a refresh is in flight, instead of blanking the page on every retry.
    this.schoolService.getSetupHealth().pipe(takeUntil(this.destroy$)).subscribe({
      next: health => { this.health = health; this.loading = false; this.cdr.markForCheck(); },
      error: e => {
        this.logger.error('School setup health load error:', e);
        this.loading = false; this.error = true;
        this.loadError = { ...errorGuidance(e, 'the setup status'), message: 'Your school data is safe. Please try again.' };
        this.cdr.markForCheck();
      }
    });
  }

  actionFor(item: SchoolSetupItem): SetupAction | null {
    return item.status === 'INCOMPLETE' ? this.actions[item.key] ?? null : null;
  }

  /** Items of one importance, without the academic group (shown separately). */
  items(importance: SchoolSetupItem['importance']): SchoolSetupItem[] {
    return this.health?.items.filter(item => item.importance === importance && !this.isAcademic(item)) ?? [];
  }

  academicItems(): SchoolSetupItem[] {
    const byKey = new Map((this.health?.items ?? []).map(item => [item.key, item]));
    return SchoolSetupComponent.ACADEMIC_KEYS.map(key => byKey.get(key)).filter((item): item is SchoolSetupItem => !!item);
  }

  /** Academic group progress: ready items out of those that apply to this school. */
  get academicProgress(): { ready: number; applicable: number } {
    const applicable = this.academicItems().filter(i => i.status !== 'NOT_APPLICABLE');
    return { ready: applicable.filter(i => i.status === 'COMPLETED').length, applicable: applicable.length };
  }

  /** Width of an item's partial-progress bar (0–100), or null when the item has no count. */
  progressPercent(item: SchoolSetupItem): number | null {
    if (item.status !== 'INCOMPLETE' || !item.total) return null;
    return Math.round(((item.completed ?? 0) / item.total) * 100);
  }

  /** Report cards blocked by missing exams or exam subjects also offer the exam step. */
  secondaryActionFor(item: SchoolSetupItem): SetupAction | null {
    return item.key === 'REPORT_CARDS' && item.status === 'INCOMPLETE'
      && (item.details ?? []).some(d => d.startsWith('No exams') || d.startsWith('Exams without subjects')) ? this.examAction : null;
  }

  icon(item: SchoolSetupItem, incompleteIcon: string): string {
    return item.status === 'COMPLETED' ? 'check_circle' : item.status === 'NOT_APPLICABLE' ? 'remove_circle_outline' : incompleteIcon;
  }

  private isAcademic(item: SchoolSetupItem): boolean { return SchoolSetupComponent.ACADEMIC_KEYS.includes(item.key); }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
