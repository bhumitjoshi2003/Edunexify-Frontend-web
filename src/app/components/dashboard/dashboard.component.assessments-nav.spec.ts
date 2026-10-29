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
import { NotificationStateService } from '../../services/notification-state.service';
import { SchoolService } from '../../services/school.service';
import { TenantService } from '../../services/tenant.service';
import { ParentPortalService } from '../../services/parent-portal.service';
import { ParentChildContextService } from '../../services/parent-child-context.service';
import { LoggerService } from '../../services/logger.service';
import { WhatsNewService } from '../../services/whats-new.service';

describe('Assessments — role access', () => {
  let selectedChild: any = null;
  let fixture: ComponentFixture<DashboardComponent>;
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
        { provide: NotificationStateService, useValue: { unreadState$: of({ status: 'success', count: 0 }), refreshUnread: () => {}, allRead: () => {} } },
        { provide: SchoolService, useValue: {} },
        { provide: TenantService, useValue: { school: null } },
        { provide: ParentPortalService, useValue: { getMyProfile: () => of(null) } },
        { provide: ParentChildContextService, useValue: { selectedChild$: of(selectedChild), reconcile: () => {} } },
        { provide: LoggerService, useValue: { error: () => {} } },
        { provide: WhatsNewService, useValue: { checkOnStartup: () => {}, openManually: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  }

  afterEach(() => { fixture?.destroy(); selectedChild = null; });

  const link = (href: string) => fixture.nativeElement.querySelector(`a[routerLink="${href}"]`);

  it('TEACHER sees the Assessments management link, not the student page', () => {
    build('TEACHER');
    expect(link('/dashboard/manage-assessments')).toBeTruthy();
    expect(link('/dashboard/assessments')).toBeNull();
  });

  it('ADMIN sees the Assessments management link', () => {
    build('ADMIN');
    expect(link('/dashboard/manage-assessments')).toBeTruthy();
    expect(link('/dashboard/assessments')).toBeNull();
  });

  it('STUDENT sees the Assessment Calendar link, not the management page', () => {
    build('STUDENT');
    expect(link('/dashboard/assessments')).toBeTruthy();
    expect(link('/dashboard/manage-assessments')).toBeNull();
  });

  for (const role of ['SUB_ADMIN', 'PARENT', 'SUPER_ADMIN']) {
    it(`${role} sees neither assessments link (fail closed)`, () => {
      build(role);
      expect(link('/dashboard/manage-assessments')).withContext(role).toBeNull();
      expect(link('/dashboard/assessments')).withContext(role).toBeNull();
    });
  }

  it('PARENT with a selected child gets the read-only page for that child', () => {
    selectedChild = { studentId: 'stu_3', studentName: 'Kabir', className: '10', sectionName: 'A' };
    build('PARENT');
    const a = link('/dashboard/assessments');
    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toContain('studentId=stu_3');
  });

  it('routes are guarded: management is TEACHER/ADMIN-only and the calendar STUDENT + PARENT (read-only)', () => {
    const dashboard = routes.find(r => r.path === 'dashboard')!;
    const manage = dashboard.children!.find(r => r.path === 'manage-assessments')!;
    const student = dashboard.children!.find(r => r.path === 'assessments')!;
    expect(manage.canActivate).toContain(roleGuard);
    expect(manage.data!['roles']).toEqual(['TEACHER', 'ADMIN']);
    expect(student.canActivate).toContain(roleGuard);
    expect(student.data!['roles']).toEqual(['STUDENT', 'PARENT']);
  });
});
