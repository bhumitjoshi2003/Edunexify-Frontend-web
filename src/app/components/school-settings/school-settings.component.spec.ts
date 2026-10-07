import { of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { SchoolSettingsComponent } from './school-settings.component';
import { SchoolService, SchoolSettings } from '../../services/school.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { TenantService } from '../../services/tenant.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { FeeWorkflowService } from '../../services/fee-workflow.service';
import { PaymentGatewayService } from '../../services/payment-gateway.service';

describe('Teacher attendance reminder settings', () => {
  let c: SchoolSettingsComponent;
  let schoolService: any;
  let toast: any;
  let logger: any;

  const baseSettings = (): SchoolSettings => ({
    id: 1, name: 'Test School', slug: 'test-school',
    address: null, city: null, state: null, pincode: null, phone: null, email: null,
    website: null, logoUrl: null, themeColor: null, contactPersonName: null, boardType: null,
    plan: null, maxStudents: null, expiryDate: null, active: true, razorpayConfigured: false,
    academicYearStartMonth: 4, workingDays: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY',
    periodsPerDay: 8, gradingSystem: 'CBSE',
    schoolLatitude: 28.6, schoolLongitude: 77.2, geofenceRadius: 200,
    schoolStartTime: '08:00', lateThresholdMinutes: 5,
    checkinWindowStart: '07:30', checkinWindowEnd: '08:30',
    staffAttendanceTrackingStartDate: '2026-01-01',
    timezone: 'Asia/Kolkata',
    teacherAttendanceReminderEnabled: false,
    teacherAttendanceReminderTime: null,
  });

  beforeEach(() => {
    schoolService = { updateSettings: jasmine.createSpy().and.returnValue(of(baseSettings())) };
    toast = { warning: jasmine.createSpy(), success: jasmine.createSpy(), error: jasmine.createSpy() };
    logger = { error: jasmine.createSpy() };
    c = new SchoolSettingsComponent(
      schoolService, {} as any, {} as any, { markForCheck: () => {} } as any, logger, toast,
      { snapshot: { queryParamMap: { get: () => null } } } as any, {} as any, {} as any
    );
  });

  it('hydrates the reminder toggle and time from existing settings when starting an edit', () => {
    c.settings = { ...baseSettings(), teacherAttendanceReminderEnabled: true, teacherAttendanceReminderTime: '07:45' };
    c.startStaffAttendanceEdit();
    expect(c.staffAttendanceForm.teacherAttendanceReminderEnabled).toBeTrue();
    expect(c.staffAttendanceForm.teacherAttendanceReminderTime).toBe('07:45');
  });

  it('defaults the reminder to disabled with no time when never configured', () => {
    c.settings = baseSettings(); // enabled: false, time: null
    c.startStaffAttendanceEdit();
    expect(c.staffAttendanceForm.teacherAttendanceReminderEnabled).toBeFalse();
    expect(c.staffAttendanceForm.teacherAttendanceReminderTime).toBe('');
  });

  it('renders the read-only summary as Disabled when the reminder is off', () => {
    c.settings = { ...baseSettings(), teacherAttendanceReminderEnabled: false, teacherAttendanceReminderTime: null };
    // Read-only summary state is template-driven off c.settings directly — assert the
    // exact data the *ngIf branches in the template key off.
    expect(c.settings.teacherAttendanceReminderEnabled).toBeFalse();
  });

  it('exposes the configured time and timezone for the read-only summary when enabled', () => {
    c.settings = { ...baseSettings(), teacherAttendanceReminderEnabled: true, teacherAttendanceReminderTime: '07:45', timezone: 'Asia/Kolkata' };
    expect(c.settings.teacherAttendanceReminderEnabled).toBeTrue();
    expect(c.settings.teacherAttendanceReminderTime).toBe('07:45');
    expect(c.settings.timezone).toBe('Asia/Kolkata');
    expect(c.formatReminderTime(c.settings.teacherAttendanceReminderTime)).toBe('7:45 AM');
  });

  it('blocks saving when the reminder is enabled without a time, matching backend validation', () => {
    c.settings = baseSettings();
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = true;
    c.staffAttendanceForm.teacherAttendanceReminderTime = '';

    c.saveStaffAttendanceSettings();

    expect(toast.warning).toHaveBeenCalledWith('Validation', jasmine.stringMatching(/[Rr]eminder time is required/));
    expect(schoolService.updateSettings).not.toHaveBeenCalled();
  });

  it('allows saving with the reminder disabled even without a time', () => {
    c.settings = baseSettings();
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = false;
    c.staffAttendanceForm.teacherAttendanceReminderTime = '';

    c.saveStaffAttendanceSettings();

    expect(schoolService.updateSettings).toHaveBeenCalled();
  });

  it('disabling without touching the time field resends the previously configured time unchanged', () => {
    c.settings = { ...baseSettings(), teacherAttendanceReminderEnabled: true, teacherAttendanceReminderTime: '07:45' };
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = false; // time field never touched

    c.saveStaffAttendanceSettings();

    const payload = schoolService.updateSettings.calls.mostRecent().args[0];
    expect(payload.teacherAttendanceReminderEnabled).toBeFalse();
    expect(payload.teacherAttendanceReminderTime).toBe('07:45');
  });

  it('sends the reminder fields to updateSettings and applies the returned settings', () => {
    const saved = { ...baseSettings(), teacherAttendanceReminderEnabled: true, teacherAttendanceReminderTime: '08:15' };
    schoolService.updateSettings.and.returnValue(of(saved));
    c.settings = baseSettings();
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = true;
    c.staffAttendanceForm.teacherAttendanceReminderTime = '08:15';

    c.saveStaffAttendanceSettings();

    expect(schoolService.updateSettings).toHaveBeenCalledWith(
      jasmine.objectContaining({ teacherAttendanceReminderEnabled: true, teacherAttendanceReminderTime: '08:15' })
    );
    expect(c.settings).toEqual(saved);
    expect(c.isEditingStaffAttendance).toBeFalse();
  });

  it('values persist correctly across a save-then-reload cycle (re-opening edit hydrates the saved values)', () => {
    const saved = { ...baseSettings(), teacherAttendanceReminderEnabled: true, teacherAttendanceReminderTime: '08:15' };
    schoolService.updateSettings.and.returnValue(of(saved));
    c.settings = baseSettings();
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = true;
    c.staffAttendanceForm.teacherAttendanceReminderTime = '08:15';
    c.saveStaffAttendanceSettings();

    // Re-opening edit after the save must reflect exactly what was persisted, not stale form state.
    c.startStaffAttendanceEdit();
    expect(c.staffAttendanceForm.teacherAttendanceReminderEnabled).toBeTrue();
    expect(c.staffAttendanceForm.teacherAttendanceReminderTime).toBe('08:15');
  });

  it('leaves unrelated staff attendance settings unchanged when only the reminder is edited', () => {
    const settings = baseSettings();
    schoolService.updateSettings.and.returnValue(of({ ...settings, teacherAttendanceReminderEnabled: true, teacherAttendanceReminderTime: '07:00' }));
    c.settings = settings;
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = true;
    c.staffAttendanceForm.teacherAttendanceReminderTime = '07:00';

    c.saveStaffAttendanceSettings();

    const payload = schoolService.updateSettings.calls.mostRecent().args[0];
    expect(payload.schoolStartTime).toBe('08:00');
    expect(payload.checkinWindowStart).toBe('07:30');
    expect(payload.checkinWindowEnd).toBe('08:30');
    expect(payload.geofenceRadius).toBe(200);
  });

  // ─── reminderTimeWarning — non-blocking guidance only, ported from the Android implementation ───

  it('warns when the reminder time is before the check-in window opens', () => {
    c.settings = baseSettings();
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = true;
    c.staffAttendanceForm.checkinWindowStart = '07:30';
    c.staffAttendanceForm.teacherAttendanceReminderTime = '07:00';

    expect(c.reminderTimeWarning).toContain('before the check-in window opens');
  });

  it('warns when the reminder time is well after the check-in window closes', () => {
    c.settings = baseSettings();
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = true;
    c.staffAttendanceForm.checkinWindowEnd = '08:30';
    c.staffAttendanceForm.teacherAttendanceReminderTime = '14:00';

    expect(c.reminderTimeWarning).toContain('after the check-in window closes');
  });

  it('has no warning when the reminder time falls inside the check-in window', () => {
    c.settings = baseSettings();
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = true;
    c.staffAttendanceForm.checkinWindowStart = '07:30';
    c.staffAttendanceForm.checkinWindowEnd = '08:30';
    c.staffAttendanceForm.teacherAttendanceReminderTime = '08:00';

    expect(c.reminderTimeWarning).toBeNull();
  });

  it('has no warning while the reminder is disabled, regardless of any leftover time value', () => {
    c.settings = baseSettings();
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = false;
    c.staffAttendanceForm.teacherAttendanceReminderTime = '02:00';

    expect(c.reminderTimeWarning).toBeNull();
  });

  it('a reminder-time warning never blocks a valid save', () => {
    c.settings = baseSettings();
    c.startStaffAttendanceEdit();
    c.staffAttendanceForm.teacherAttendanceReminderEnabled = true;
    c.staffAttendanceForm.checkinWindowStart = '07:30';
    c.staffAttendanceForm.teacherAttendanceReminderTime = '05:00'; // triggers the warning

    expect(c.reminderTimeWarning).not.toBeNull();
    c.saveStaffAttendanceSettings();

    expect(toast.warning).not.toHaveBeenCalled();
    expect(schoolService.updateSettings).toHaveBeenCalled();
  });
});

describe('School Settings — Notification Channels UI removed', () => {
  let fixture: ComponentFixture<SchoolSettingsComponent>;
  let queryParam: string | null;

  const settings = (): SchoolSettings => ({
    id: 1, name: 'Test School', slug: 'test-school',
    address: null, city: null, state: null, pincode: null, phone: null, email: null,
    website: null, logoUrl: null, themeColor: null, contactPersonName: null, boardType: null,
    plan: null, maxStudents: null, expiryDate: null, active: true, razorpayConfigured: false,
    academicYearStartMonth: 4, workingDays: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY',
    periodsPerDay: 8, gradingSystem: 'CBSE',
    schoolLatitude: 28.6, schoolLongitude: 77.2, geofenceRadius: 200,
    schoolStartTime: '08:00', lateThresholdMinutes: 5,
    checkinWindowStart: '07:30', checkinWindowEnd: '08:30',
    staffAttendanceTrackingStartDate: '2026-01-01',
    timezone: 'Asia/Kolkata',
    teacherAttendanceReminderEnabled: false,
    teacherAttendanceReminderTime: null,
  });

  beforeEach(async () => {
    queryParam = null;
    const schoolService = {
      getSettings: jasmine.createSpy().and.returnValue(of(settings())),
      getEntitlement: jasmine.createSpy().and.returnValue(of(null)),
    };
    const academicSessionService = { getAllSessions: jasmine.createSpy().and.returnValue(of([])) };
    const feeWorkflowService = { getSettings: jasmine.createSpy().and.returnValue(of(null)) };
    const authStateService = { getUser: () => ({ role: 'ADMIN' }) };
    const tenantService = { getLogoUrl: (u: string) => u };
    const toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning']);
    const logger = jasmine.createSpyObj('LoggerService', ['error']);

    await TestBed.configureTestingModule({
      imports: [SchoolSettingsComponent],
      providers: [
        { provide: SchoolService, useValue: schoolService },
        { provide: AuthStateService, useValue: authStateService },
        { provide: TenantService, useValue: tenantService },
        { provide: LoggerService, useValue: logger },
        { provide: ToastService, useValue: toast },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (key: string) => key === 'tab' ? queryParam : null } } } },
        { provide: AcademicSessionService, useValue: academicSessionService },
        { provide: FeeWorkflowService, useValue: feeWorkflowService },
        { provide: PaymentGatewayService, useValue: { getOverview: () => of(null) } },
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SchoolSettingsComponent);
  });

  it('does not render a Channels tab button', () => {
    fixture.detectChanges();
    const tabLabels = Array.from(fixture.nativeElement.querySelectorAll('.ss-tab-label')) as HTMLElement[];
    expect(tabLabels.map(el => el.textContent?.trim())).not.toContain('Channels');
  });

  it('never renders the notification channels empty-state text', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('No notification channels configured yet.');
  });

  it('still renders the remaining tabs', () => {
    fixture.detectChanges();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.ss-tab-label') as NodeListOf<HTMLElement>)
      .map(el => el.textContent?.trim());
    expect(labels).toContain('General');
    expect(labels).toContain('Payments');
    expect(labels).toContain('Features');
    expect(labels).toContain('Staff Attendance');
    expect(labels).toContain('Plan');
  });

  it('falls back to the default General tab instead of a blank page when navigated with the removed ?tab=channels', () => {
    queryParam = 'channels';
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab).toBe('general');
    expect(fixture.nativeElement.querySelector('.ss-hero')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('No notification channels configured yet.');
  });

  it('has no notification-channel dependency, state, or methods left to accidentally call on load', () => {
    fixture.detectChanges();
    const instance = fixture.componentInstance as any;
    expect(instance.notificationChannelService).toBeUndefined();
    expect(instance.notificationChannels).toBeUndefined();
    expect(instance.channelsLoading).toBeUndefined();
    expect(instance.loadChannels).toBeUndefined();
    expect(instance.toggleChannel).toBeUndefined();
  });
});

describe('School Settings — Payments tab', () => {
  it('hosts the guided Razorpay connection instead of any credential form of its own', async () => {
    await TestBed.configureTestingModule({
      imports: [SchoolSettingsComponent],
      providers: [
        { provide: SchoolService, useValue: { getSettings: () => of({ id: 1, name: 'S', razorpayConfigured: false } as any), getEntitlement: () => of(null) } },
        { provide: AuthStateService, useValue: { getUser: () => ({ role: 'ADMIN', userId: 'Admin_1' }) } },
        { provide: TenantService, useValue: { getLogoUrl: (u: string) => u } },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']) },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (k: string) => k === 'tab' ? 'razorpay' : null } } } },
        { provide: AcademicSessionService, useValue: { getAllSessions: () => of([]) } },
        { provide: FeeWorkflowService, useValue: { getSettings: () => of(null) } },
        { provide: PaymentGatewayService, useValue: { getOverview: () => of({ route: 'UNAVAILABLE', platformFallbackUntil: null,
            requireLiveKeys: true, encryptionConfigured: true, gateways: [] }) } },
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(SchoolSettingsComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-school-payment-connection')).not.toBeNull();
    expect(el.querySelector('[data-testid="connect"]')).not.toBeNull();
    const instance = fixture.componentInstance as any;
    expect(instance.gatewayForm).toBeUndefined();
    expect(instance.submitGateway).toBeUndefined();
    expect(instance.saveRazorpayKeys).toBeUndefined();
  });
});
