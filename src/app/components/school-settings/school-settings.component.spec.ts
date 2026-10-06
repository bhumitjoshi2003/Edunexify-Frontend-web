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
import { SchoolPaymentGateway, SchoolPaymentGatewayOverview } from '../../interfaces/payment-gateway';
import { throwError } from 'rxjs';

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
      { snapshot: { queryParamMap: { get: () => null } } } as any, {} as any, {} as any, {} as any
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

describe('School Settings — Payments tab (school-owned Razorpay gateway)', () => {
  let fixture: ComponentFixture<SchoolSettingsComponent>;
  let gatewayService: any;
  let toast: any;
  let overview: SchoolPaymentGatewayOverview;

  const settings = (): SchoolSettings => ({
    id: 1, name: 'Test School', slug: 'test-school',
    address: null, city: null, state: null, pincode: null, phone: null, email: null,
    website: null, logoUrl: null, themeColor: null, contactPersonName: null, boardType: null,
    plan: null, maxStudents: null, expiryDate: null, active: true, razorpayConfigured: false,
    academicYearStartMonth: 4, workingDays: 'MONDAY', periodsPerDay: 8, gradingSystem: 'CBSE',
  });

  const gateway = (over: Partial<SchoolPaymentGateway> = {}): SchoolPaymentGateway => ({
    id: 7, schoolId: 1, schoolName: 'Test School', provider: 'RAZORPAY', maskedKeyId: 'rzp_live_••••3456',
    liveMode: true, status: 'ACTIVE', submittedBy: 'admin1', submittedAt: '2026-10-01T10:00:00',
    verifiedAt: '2026-10-01T10:00:00', activatedAt: '2026-10-02T10:00:00', activatedBy: 'sa',
    retiredAt: null, rejectedAt: null, statusReason: null, lastWebhookAt: new Date().toISOString(),
    webhookUrl: 'https://edunexify.co.in/api/webhooks/razorpay/tok123', ...over,
  });

  const baseOverview = (over: Partial<SchoolPaymentGatewayOverview> = {}): SchoolPaymentGatewayOverview => ({
    route: 'UNAVAILABLE', platformFallbackUntil: null, requireLiveKeys: true, encryptionConfigured: true,
    requiredWebhookEvents: ['payment.captured', 'refund.processed', 'refund.failed'], gateways: [], ...over,
  });

  beforeEach(async () => {
    overview = baseOverview();
    gatewayService = {
      getOverview: jasmine.createSpy().and.callFake(() => of(overview)),
      submit: jasmine.createSpy().and.returnValue(of(gateway({ status: 'PENDING' }))),
    };
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
    await TestBed.configureTestingModule({
      imports: [SchoolSettingsComponent],
      providers: [
        { provide: SchoolService, useValue: {
          getSettings: () => of(settings()),
          getEntitlement: () => of(null),
        } },
        { provide: AuthStateService, useValue: { getUser: () => ({ role: 'ADMIN' }) } },
        { provide: TenantService, useValue: { getLogoUrl: (u: string) => u } },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: toast },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (k: string) => k === 'tab' ? 'razorpay' : null } } } },
        { provide: AcademicSessionService, useValue: { getAllSessions: () => of([]) } },
        { provide: FeeWorkflowService, useValue: { getSettings: () => of(null) } },
        { provide: PaymentGatewayService, useValue: gatewayService },
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SchoolSettingsComponent);
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('no longer has the old direct Razorpay key form or school-service call', () => {
    fixture.detectChanges();
    const instance = fixture.componentInstance as any;
    expect(instance.saveRazorpayKeys).toBeUndefined();
    expect(instance.razorpayKeyId).toBeUndefined();
    expect(instance.razorpayKeySecret).toBeUndefined();
    expect(text()).not.toContain('Using platform default keys');
  });

  it('shows online payment as unavailable when no gateway is active and there is no fallback', () => {
    fixture.detectChanges();
    expect(text()).toContain('Online payment is not available yet');
    expect(fixture.nativeElement.querySelector('[data-testid="gateway-row"]')).toBeNull();
  });

  it('shows the active gateway masked, with LIVE badge, last valid webhook, webhook URL and required events', () => {
    overview = baseOverview({ route: 'SCHOOL_GATEWAY', gateways: [gateway()] });
    fixture.detectChanges();
    const t = text();
    expect(t).toContain('Online payments go to your Razorpay account');
    expect(t).toContain('no online convenience fee');
    expect(t).toContain('rzp_live_••••3456');
    expect(t).toContain('ACTIVE');
    expect(t).toContain('LIVE');
    expect(t).toContain('Last valid webhook');
    expect(fixture.nativeElement.querySelector('[data-testid="gateway-webhook-url"]').textContent)
      .toContain('/api/webhooks/razorpay/tok123');
    expect(t).toContain('payment.captured');
    expect(t).toContain('refund.processed');
    expect(t).toContain('refund.failed');
  });

  it('flags an active gateway that has never received a valid webhook', () => {
    overview = baseOverview({ route: 'SCHOOL_GATEWAY', gateways: [gateway({ lastWebhookAt: null })] });
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('[data-testid="gateway-webhook-status"]') as HTMLElement;
    expect(status.textContent).toContain('No valid webhook received yet');
    expect(status.classList).toContain('ss-gw-warn-text');
  });

  it('shows a pending gateway as waiting for approval and the temporary fallback date', () => {
    overview = baseOverview({ route: 'PLATFORM_FALLBACK', platformFallbackUntil: '2026-11-15',
      gateways: [gateway({ status: 'PENDING', activatedAt: null, lastWebhookAt: null })] });
    fixture.detectChanges();
    expect(text()).toContain('Waiting for Edunexify approval');
    expect(text()).toContain('15 Nov 2026');
  });

  it('describes onboarding in the real order: choose secret → submit → URL generated → create webhook → approval', () => {
    fixture.detectChanges();
    const steps = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="gateway-steps"] li') as NodeListOf<HTMLElement>)
      .map(li => li.textContent ?? '');
    expect(steps.length).toBe(5);
    expect(steps[0]).toContain('Choose a webhook secret');
    expect(steps[1]).toContain('submit');
    expect(steps[2]).toContain('webhook URL');
    expect(steps[3]).toContain('same webhook secret');
    expect(steps[4]).toContain('approves');
    // Before submitting there is no URL yet, so no webhook instructions are shown.
    expect(fixture.nativeElement.querySelector('[data-testid="gateway-webhook-url"]')).toBeNull();
    // The webhook-secret field asks the admin to choose one, not to copy one from an existing webhook.
    const secretInput = fixture.nativeElement.querySelector('#gwWebhookSecret') as HTMLInputElement;
    expect(secretInput.placeholder).toContain('same value in Razorpay');
  });

  it('after submission, the pending gateway shows the generated URL as the next step with the same secret and events', () => {
    overview = baseOverview({ gateways: [gateway({ status: 'PENDING', activatedAt: null, lastWebhookAt: null })] });
    fixture.detectChanges();
    expect(text()).toContain('Next step: create the Razorpay webhook');
    const instructions = fixture.nativeElement.querySelector('[data-testid="gateway-webhook-instructions"]') as HTMLElement;
    expect(instructions.textContent).toContain('generated when you submitted');
    expect(instructions.textContent).toContain('same webhook secret you submitted');
    expect(fixture.nativeElement.querySelector('[data-testid="gateway-webhook-url"]').textContent).toContain('/api/webhooks/razorpay/tok123');
    expect(instructions.textContent).toContain('payment.captured');
    expect(instructions.textContent).toContain('refund.processed');
    expect(instructions.textContent).toContain('refund.failed');
  });

  it('never renders any secret field values returned by mistake', () => {
    overview = baseOverview({ route: 'SCHOOL_GATEWAY',
      gateways: [{ ...gateway(), keySecret: 'SHOULD_NOT_RENDER', webhookSecret: 'NOR_THIS' } as any] });
    fixture.detectChanges();
    expect(text()).not.toContain('SHOULD_NOT_RENDER');
    expect(text()).not.toContain('NOR_THIS');
  });

  it('rejects a test key client-side when live keys are required, without calling the API', () => {
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.gatewayForm = { keyId: 'rzp_test_AbCdEf123456', keySecret: 'x'.repeat(20), webhookSecret: 'whsecret1', currentPassword: 'pw' };
    c.submitGateway();
    expect(gatewayService.submit).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('requires every field including the current password', () => {
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.gatewayForm = { keyId: 'rzp_live_AbCdEf123456', keySecret: 'x'.repeat(20), webhookSecret: 'whsecret1', currentPassword: '' };
    c.submitGateway();
    expect(gatewayService.submit).not.toHaveBeenCalled();
  });

  it('submits trimmed values, clears every secret afterwards and reloads the status', () => {
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.gatewayForm = { keyId: ' rzp_live_AbCdEf123456 ', keySecret: ' ' + 'x'.repeat(20) + ' ', webhookSecret: 'whsecret1', currentPassword: 'pw' };
    c.submitGateway();
    expect(gatewayService.submit).toHaveBeenCalledWith({
      keyId: 'rzp_live_AbCdEf123456', keySecret: 'x'.repeat(20), webhookSecret: 'whsecret1', currentPassword: 'pw',
    });
    expect(c.gatewayForm).toEqual({ keyId: '', keySecret: '', webhookSecret: '', currentPassword: '' });
    expect(gatewayService.getOverview).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the server message on failure and still clears the secrets', () => {
    gatewayService.submit.and.returnValue(throwError(() => ({ status: 400, error: { message: 'Razorpay rejected this Key ID and Key Secret.' } })));
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.gatewayForm = { keyId: 'rzp_live_AbCdEf123456', keySecret: 'x'.repeat(20), webhookSecret: 'whsecret1', currentPassword: 'pw' };
    c.submitGateway();
    expect(toast.error).toHaveBeenCalledWith('Not submitted', 'Razorpay rejected this Key ID and Key Secret.');
    expect(c.gatewayForm.keyId).toBe('rzp_live_AbCdEf123456');
    expect(c.gatewayForm.keySecret).toBe('');
    expect(c.gatewayForm.webhookSecret).toBe('');
    expect(c.gatewayForm.currentPassword).toBe('');
    expect(c.submittingGateway).toBeFalse();
  });

  it('hides the form when server-side encryption is not configured', () => {
    overview = baseOverview({ encryptionConfigured: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#gwKeySecret')).toBeNull();
    expect(text()).toContain('temporarily unavailable');
  });
});
