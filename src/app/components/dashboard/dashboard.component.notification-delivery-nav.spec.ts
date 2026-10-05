import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { DashboardComponent } from './dashboard.component';
import { routes } from '../../app.routes';
import { roleGuard } from '../../auth/role.guard';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { StudentService } from '../../services/student.service';
import { TeacherService } from '../../services/teacher.service';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../services/notification.service';
import { SchoolService } from '../../services/school.service';
import { TenantService } from '../../services/tenant.service';
import { ParentPortalService } from '../../services/parent-portal.service';
import { ParentChildContextService } from '../../services/parent-child-context.service';
import { LoggerService } from '../../services/logger.service';
import { WhatsNewService } from '../../services/whats-new.service';

describe('Notification Delivery — SUPER_ADMIN-only access', () => {
  let fixture: ComponentFixture<DashboardComponent> | undefined;
  let authState: jasmine.SpyObj<AuthStateService>;

  function build(role: string): void {
    authState = jasmine.createSpyObj('AuthStateService', [
      'getUser', 'isLoggedIn', 'isUnauthenticated', 'loadCurrentUser', 'mustChangePassword',
      'getSubscriptionStatus', 'hasFeature', 'isSubscriptionWarning',
    ]);
    authState.getUser.and.returnValue({ role, userId: '' } as any);
    authState.isLoggedIn.and.returnValue(true);
    authState.isUnauthenticated.and.returnValue(false);
    authState.loadCurrentUser.and.returnValue(Promise.resolve());
    authState.getSubscriptionStatus.and.returnValue(null);
    authState.hasFeature.and.returnValue(false);
    authState.isSubscriptionWarning.and.returnValue(false);

    TestBed.configureTestingModule({
      imports: [DashboardComponent, RouterTestingModule],
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: AuthService, useValue: {} },
        { provide: StudentService, useValue: {} },
        { provide: TeacherService, useValue: {} },
        { provide: AdminService, useValue: {} },
        { provide: NotificationService, useValue: { unreadCountState$: of({ status: 'success', count: 0 }), refreshUnreadCount: () => {} } },
        { provide: SchoolService, useValue: {} },
        { provide: TenantService, useValue: { school: null } },
        { provide: ParentPortalService, useValue: { getMyProfile: () => of(null) } },
        { provide: ParentChildContextService, useValue: { selectedChild$: of(null), reconcile: () => {} } },
        { provide: LoggerService, useValue: { error: () => {} } },
        { provide: WhatsNewService, useValue: { checkOnStartup: () => {}, openManually: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  }

  // Not every spec builds a fixture (the route-guard check below never does), and build() can throw
  // before createComponent — so reset per spec and only destroy what this spec actually created.
  beforeEach(() => { fixture = undefined; });
  afterEach(() => fixture?.destroy());

  it('shows the "Notification Delivery" nav link for SUPER_ADMIN', () => {
    build('SUPER_ADMIN');
    const link = fixture!.nativeElement.querySelector('a[routerLink="/dashboard/notification-deliveries"]');
    expect(link).toBeTruthy();
    expect(link!.textContent).toContain('Notification Delivery');
  });

  for (const role of ['ADMIN', 'SUB_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']) {
    it(`never shows the Notification Delivery nav link for ${role}`, () => {
      build(role);
      expect(fixture!.nativeElement.querySelector('a[routerLink="/dashboard/notification-deliveries"]'))
        .withContext(`notification-deliveries link for ${role}`).toBeNull();
    });
  }

  it('the notification-deliveries route is guarded to SUPER_ADMIN only', () => {
    const dashboard = routes.find(r => r.path === 'dashboard')!;
    const route = dashboard.children!.find(r => r.path === 'notification-deliveries')!;
    expect(route.canActivate).toContain(roleGuard);
    expect(route.data!['roles']).toEqual(['SUPER_ADMIN']);
  });
});
