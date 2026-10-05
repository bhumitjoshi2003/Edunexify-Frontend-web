import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router,
} from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { CommonModule } from '@angular/common';
import { StudentService } from '../../services/student.service';
import { TeacherService } from '../../services/teacher.service';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../services/notification.service';
import { SchoolService } from '../../services/school.service';
import { WhatsNewService } from '../../services/whats-new.service';
import { TenantService } from '../../services/tenant.service';
import { Subject, takeUntil, interval, Subscription } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AiCopilotComponent } from '../ai-copilot/ai-copilot.component';
import { ParentPortalService } from '../../services/parent-portal.service';
import { ParentChildContextService } from '../../services/parent-child-context.service';
import { ChildAccess } from '../../interfaces/parent-portal';
import { AppResumeService } from '../../core/app-resume.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatMenuModule,
    MatIconModule,
    MatDividerModule,
    CommonModule,
    MatBadgeModule,
    AiCopilotComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  Role: string = '';
  Id: string = '';
  Name: string = '';
  Class: string = '';
  ClassTeacher: string = '';
  unreadNotificationCount: number = 0;
  sidebarCollapsed: boolean = false;
  mobileSidebarOpen: boolean = false;
  showUpdateBanner = false;
  latestAppVersion = '';
  private ngUnsubscribe = new Subject<void>();
  private pollingIntervalSubscription: Subscription | undefined;
  selectedChild: ChildAccess | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private authStateService: AuthStateService,
    private studentService: StudentService,
    private teacherService: TeacherService,
    private adminService: AdminService,
    private notificationService: NotificationService,
    private schoolService: SchoolService,
    public tenantService: TenantService,
    private parentPortalService: ParentPortalService,
    private childContext: ParentChildContextService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private whatsNewService: WhatsNewService,
    private appResume: AppResumeService,
  ) {}

  ngOnInit() {
    this.getDetails();
    this.whatsNewService.checkOnStartup();
    this.loadAuthenticatedSchoolBranding();
    this.handleInitialNavigation();
    this.notificationService.unreadCountState$
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(state => {
        // 'loading'/'error' intentionally leave the last known badge count on screen — a
        // failed refresh has never zeroed the badge, only a successful one updates it.
        if (state.status === 'success') {
          this.unreadNotificationCount = state.count;
          this.cdr.markForCheck();
        }
      });
    this.fetchUnreadCount();
    this.initParentChildContext();
    // Re-fetch on every navigation (catches mark-all-read from notice board)
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntil(this.ngUnsubscribe),
      )
      .subscribe(() => this.fetchUnreadCount());
    // Also poll every 60 seconds as a background fallback
    this.pollingIntervalSubscription = interval(60000)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(() => this.fetchUnreadCount());
    this.checkForAppUpdate();
    // Back after a long absence with the session confirmed (AppResumeService re-checks it on
    // tab resume / reconnect): reload the shell's own data — name, class, unread badge.
    this.appResume.resumed$
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(() => {
        this.getDetails();
        this.fetchUnreadCount();
        this.cdr.markForCheck();
      });
  }

  /** Keeps the PARENT sidebar's permission-gated items in sync with whichever child is
   *  currently selected — reactively, so switching children (from any page) updates the
   *  sidebar without a reload. Eagerly reconciles on shell load so a deep link straight into
   *  a feature page still has a correctly gated sidebar, not just after visiting My Children. */
  private initParentChildContext(): void {
    if (this.Role !== 'PARENT') return;
    this.childContext.selectedChild$.pipe(takeUntil(this.ngUnsubscribe)).subscribe(child => {
      this.selectedChild = child;
      this.cdr.markForCheck();
    });
    this.parentPortalService.getMyProfile().pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: profile => this.childContext.reconcile(profile),
      error: () => { /* sidebar simply shows no child-specific items until a page reconciles it */ },
    });
  }

  /** Gates a PARENT sidebar item on the currently selected child's permission flag. */
  childCan(permission: keyof ChildAccess): boolean {
    return !!this.selectedChild && !!this.selectedChild[permission];
  }

  private loadAuthenticatedSchoolBranding(): void {
    const schoolSlug = this.authStateService.getUser()?.schoolSlug;
    if (!schoolSlug || this.tenantService.school) return;

    this.tenantService
      .loadSchoolBySlug(schoolSlug)
      .then(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
    if (this.pollingIntervalSubscription) {
      this.pollingIntervalSubscription.unsubscribe();
    }
  }

  getDetails() {
    const user = this.authStateService.getUser();
    if (user) {
      this.Role = user.role;
      this.Id = user.userId;
      this.fetchUserDetails();
    }
  }

  fetchUserDetails() {
    if (this.Role === 'STUDENT' && this.Id) {
      this.studentService
        .getStudent(this.Id)
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe({
          next: (student) => {
            this.Name = student.name;
            this.Class = student.className;
            this.cdr.markForCheck();
          },
          error: (error) => {
            this.logger.error('Error fetching student details:', error);
          },
        });
    } else if (this.Role === 'TEACHER' && this.Id) {
      this.teacherService
        .getTeacher(this.Id)
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe({
          next: (teacher) => {
            this.Name = teacher.name;
            this.ClassTeacher = teacher.classTeacher ?? '';
            this.cdr.markForCheck();
          },
          error: (error) => {
            this.logger.error('Error fetching teacher details:', error);
          },
        });
    } else if (this.Role === 'ADMIN' && this.Id) {
      this.adminService
        .getAdminById(this.Id)
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe({
          next: (admin) => {
            this.Name = admin.name;
            this.cdr.markForCheck();
          },
          error: (error) => {
            this.logger.error('Error fetching admin details:', error);
          },
        });
    }
  }

  handleInitialNavigation(): void {
    if (this.Role === 'ADMIN' && this.subscriptionStatus === 'EXPIRED') {
      this.router.navigate(['/dashboard/school-settings'], {
        queryParams: { tab: 'subscription' },
      });
      return;
    }
    const url = this.router.url.split('?')[0];
    const isBareDashboard = url === '/dashboard' || url === '/dashboard/';
    if (!isBareDashboard) return;
    if (this.Role === 'STUDENT') {
      this.router.navigate(['/dashboard/student-dashboard']);
    } else if (this.Role === 'TEACHER') {
      this.router.navigate(['/dashboard/teacher-dashboard']);
    } else if (this.Role === 'ADMIN' || this.Role === 'SUB_ADMIN') {
      this.router.navigate(['/dashboard/admin-dashboard']);
    } else if (this.Role === 'PARENT') {
      this.router.navigate(['/dashboard/parent-dashboard']);
    } else if (this.Role === 'SUPER_ADMIN') {
      this.router.navigate(['/dashboard/super-admin-dashboard']);
    }
  }

  isStudent(): boolean {
    return this.Role === 'STUDENT';
  }

  isTeacher(): boolean {
    return this.Role === 'TEACHER';
  }

  isAdmin(): boolean {
    return this.Role === 'ADMIN' || this.Role === 'SUB_ADMIN';
  }

  isSuperAdmin(): boolean {
    return this.Role === 'SUPER_ADMIN';
  }

  isParent(): boolean {
    return this.Role === 'PARENT';
  }

  get subscriptionStatus(): string | null {
    return this.authStateService.getSubscriptionStatus();
  }

  /**
   * Returns true if the school's active plan includes the given feature key.
   * Paid features are denied unless the backend-provided entitlement explicitly
   * grants them. This matches AuthStateService and featureGuard.
   */
  hasFeature(key: string): boolean {
    return this.authStateService.hasFeature(key);
  }

  showSubscriptionWarning(): boolean {
    return this.authStateService.isSubscriptionWarning() && this.isAdmin();
  }

  private checkForAppUpdate(): void {
    const cap = (window as any).Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
    const mod = '@capawesome/capacitor-app-update';
    (Function('m', 'return import(m)')(mod) as Promise<any>)
      .then(({ AppUpdate, AppUpdateAvailability }: any) => {
        AppUpdate.getAppUpdateInfo()
          .then((info: any) => {
            if (
              info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
            ) {
              this.latestAppVersion = info.availableVersionName ?? '';
              this.showUpdateBanner = true;
              this.cdr.markForCheck();
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  }

  openPlayStore(): void {
    const cap = (window as any).Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
      const mod = '@capawesome/capacitor-app-update';
      (Function('m', 'return import(m)')(mod) as Promise<any>)
        .then(({ AppUpdate }: any) => {
          AppUpdate.openAppStore().catch(() => {
            window.open(
              'https://play.google.com/store/apps/details?id=in.edunexify.app',
              '_system',
            );
          });
        })
        .catch(() => {
          window.open(
            'https://play.google.com/store/apps/details?id=in.edunexify.app',
            '_system',
          );
        });
    }
  }

  dismissUpdateBanner(): void {
    this.showUpdateBanner = false;
    this.cdr.markForCheck();
  }

  logout() {
    this.schoolService.invalidateClasses();
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/home']),
      error: () => this.router.navigate(['/home']),
    });
  }

  fetchUnreadCount(): void {
    if (this.Role === 'SUPER_ADMIN') return;
    this.notificationService.refreshUnreadCount();
  }

  navigateToNoticeBoard(): void {
    this.router.navigate(['/dashboard/notice']);
  }

  getProfileInitials(): string {
    const source = (this.Name || this.Role || 'U').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.charAt(0).toUpperCase();
  }

  getRoleLabel(): string {
    const labels: Record<string, string> = {
      STUDENT: 'Student',
      TEACHER: 'Teacher',
      ADMIN: 'Admin',
      SUB_ADMIN: 'Sub Admin',
      SUPER_ADMIN: 'Super Admin',
      PARENT: 'Parent',
    };
    return labels[this.Role] ?? this.Role;
  }

  getRoleChipClass(): string {
    const classes: Record<string, string> = {
      STUDENT: 'chip-student',
      TEACHER: 'chip-teacher',
      ADMIN: 'chip-admin',
      SUB_ADMIN: 'chip-subadmin',
      SUPER_ADMIN: 'chip-superadmin',
      PARENT: 'chip-parent',
    };
    return classes[this.Role] ?? 'chip-student';
  }

  private get isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 900;
  }

  get menuIcon(): string {
    if (this.isMobile) return this.mobileSidebarOpen ? 'menu_open' : 'menu';
    return this.sidebarCollapsed ? 'menu' : 'menu_open';
  }

  toggleSidebar(): void {
    if (this.isMobile) {
      this.mobileSidebarOpen = !this.mobileSidebarOpen;
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }
    this.cdr.markForCheck();
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen = false;
    this.cdr.markForCheck();
  }

  closeSidebarOnMobile(): void {
    if (this.isMobile) {
      this.mobileSidebarOpen = false;
      this.cdr.markForCheck();
    }
  }

  navigateToMyProfile(): void {
    if (this.isStudent() && this.Id) {
      this.router.navigate(['/dashboard/student-details', this.Id]);
    }
    if (this.isTeacher() && this.Id) {
      this.router.navigate(['/dashboard/teacher-details', this.Id]);
    }
    if (this.isAdmin() && this.Id) {
      this.router.navigate(['/dashboard/admin-details', this.Id]);
    }
  }

  openWhatsNew(): void {
    this.whatsNewService.openManually();
  }
}
