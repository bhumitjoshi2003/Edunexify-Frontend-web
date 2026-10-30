import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SchoolSettingsComponent } from './school-settings.component';
import { SchoolFeature, SchoolService } from '../../services/school.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { TenantService } from '../../services/tenant.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { FeeWorkflowService } from '../../services/fee-workflow.service';
import { PaymentGatewayService } from '../../services/payment-gateway.service';

/** Features tab: core features read-only ("In every plan"), plan features toggleable with
 *  descriptions and dependencies, a confirmation before turning off a student/parent-facing
 *  feature, and the server's dependency explanation when a change is refused. */
describe('School Settings — Features tab', () => {
  let schoolService: any;
  let toast: jasmine.SpyObj<ToastService>;
  let confirmAnswer: boolean;

  const feature = (over: Partial<SchoolFeature>): SchoolFeature => ({
    featureKey: 'X', displayName: 'X', description: '', category: 'ACADEMICS', effectivelyOn: true, planGranted: true,
    overrideState: 'DEFAULT', isAlwaysOn: false, core: false, dependsOn: [], requiredBy: [], studentOrParentFacing: false,
    addOnEligible: false, ...over,
  });
  const features = (): SchoolFeature[] => [
    feature({ featureKey: 'ATTENDANCE', displayName: 'Attendance', description: 'Student daily attendance.', core: true, isAlwaysOn: true, category: 'ACADEMICS' }),
    feature({ featureKey: 'CLASSROOM', displayName: 'Classroom', description: 'Homework and classwork.', studentOrParentFacing: true }),
    feature({ featureKey: 'REPORT_CARDS', displayName: 'Report Cards', dependsOn: ['Exams & Results'] }),
    feature({ featureKey: 'FEE_MANAGEMENT', displayName: 'Fee Management', category: 'FINANCE', requiredBy: ['Online Payments'] }),
    feature({ featureKey: 'AUDIT_LOGS', displayName: 'Audit Logs', category: 'ADMIN', planGranted: false, effectivelyOn: false }),
    feature({ featureKey: 'AI_COPILOT', displayName: 'AI Copilot', category: 'ADMIN', planGranted: false, effectivelyOn: false, addOnEligible: true }),
  ];

  function create() {
    confirmAnswer = true;
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info', 'confirm']);
    toast.confirm.and.callFake(() => Promise.resolve(confirmAnswer));
    schoolService = {
      getSettings: () => of({ id: 1, name: 'S' } as any),
      getEntitlement: () => of(null),
      getSchoolFeatures: jasmine.createSpy('getSchoolFeatures').and.callFake(() => of(features())),
      setFeatureOverride: jasmine.createSpy('setFeatureOverride').and.returnValue(of({})),
      getPaymentConnection: () => of(null),
    };
    TestBed.configureTestingModule({
      imports: [SchoolSettingsComponent],
      providers: [
        { provide: SchoolService, useValue: schoolService },
        { provide: AuthStateService, useValue: { getUser: () => ({ role: 'ADMIN', userId: 'A1' }), hasFeature: () => true,
            setFeatureEnabled: () => {}, loadCurrentUser: () => Promise.resolve() } },
        { provide: TenantService, useValue: { getLogoUrl: (u: string) => u } },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: toast },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (k: string) => k === 'tab' ? 'features' : null } } } },
        { provide: AcademicSessionService, useValue: { getAllSessions: () => of([]) } },
        { provide: FeeWorkflowService, useValue: { getSettings: () => of(null) } },
        { provide: PaymentGatewayService, useValue: { getOverview: () => of(null) } },
      ],
    });
    const fixture = TestBed.createComponent(SchoolSettingsComponent);
    const component = fixture.componentInstance;
    component.activeTab = 'features';
    component.loadFeatures();
    fixture.detectChanges();
    return { fixture, component, el: fixture.nativeElement as HTMLElement };
  }

  const card = (el: HTMLElement, name: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('.ss-feat-card')).find(c => c.querySelector('.ss-feat-card-name')?.textContent?.trim() === name)!;

  it('shows core features read-only under "Included in every plan", with descriptions', () => {
    const { el } = create();
    expect(el.textContent).toContain('Included in every plan');
    const attendance = card(el, 'Attendance');
    expect(attendance.textContent).toContain('In every plan');
    expect(attendance.textContent).toContain('Student daily attendance.');
    expect(attendance.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('shows plan features with toggles, dependencies, "Not in plan" and add-on states', () => {
    const { el } = create();
    expect(card(el, 'Classroom').querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(card(el, 'Report Cards').textContent).toContain('Needs Exams & Results');
    expect(card(el, 'Audit Logs').textContent).toContain('Not in plan');
    expect(card(el, 'Audit Logs').querySelector('input')).toBeNull();
    expect(card(el, 'AI Copilot').textContent).toContain('Add-on');
  });

  it('asks before turning off a student/parent-facing feature, and keeps it on if cancelled', async () => {
    const { component } = create();
    confirmAnswer = false;
    const classroom = component.schoolFeatures.find(f => f.featureKey === 'CLASSROOM')!;
    await component.toggleFeatureOverride(classroom);
    expect(toast.confirm).toHaveBeenCalled();
    expect(schoolService.setFeatureOverride).not.toHaveBeenCalled();

    confirmAnswer = true;
    await component.toggleFeatureOverride(classroom);
    expect(schoolService.setFeatureOverride).toHaveBeenCalledWith('CLASSROOM', 'DISABLED');
    expect(classroom.effectivelyOn).toBeFalse();
  });

  it('turns off a staff-only feature without a confirmation', async () => {
    const { component } = create();
    await component.toggleFeatureOverride(component.schoolFeatures.find(f => f.featureKey === 'REPORT_CARDS')!);
    expect(toast.confirm).not.toHaveBeenCalled();
    expect(schoolService.setFeatureOverride).toHaveBeenCalledWith('REPORT_CARDS', 'DISABLED');
  });

  it('shows the server explanation when a dependency refuses the change, and leaves the feature on', async () => {
    const { component } = create();
    schoolService.setFeatureOverride.and.returnValue(throwError(() => ({ status: 409,
      error: { error: 'Turn off Online Payments first — it needs Fee Management.', code: 'FEATURE_DEPENDENCY' } })));
    const fees = component.schoolFeatures.find(f => f.featureKey === 'FEE_MANAGEMENT')!;
    await component.toggleFeatureOverride(fees);
    expect(toast.error).toHaveBeenCalledWith('Not changed', 'Turn off Online Payments first — it needs Fee Management.');
    expect(fees.effectivelyOn).toBeTrue();
    expect(fees.overrideState).toBe('DEFAULT');
  });

  it('never sends a change for a core feature', async () => {
    const { component } = create();
    await component.toggleFeatureOverride(component.schoolFeatures.find(f => f.featureKey === 'ATTENDANCE')!);
    expect(schoolService.setFeatureOverride).not.toHaveBeenCalled();
  });
});
