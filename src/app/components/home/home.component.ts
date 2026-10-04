import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { Router } from '@angular/router';
import { LoggerService } from '../../services/logger.service';
import { DemoService } from '../../services/demo.service';
import { ToastService } from '../../services/toast.service';
import { TenantService } from '../../services/tenant.service';
import { SchoolService, PlanDetail } from '../../services/school.service';
import { consumeIntendedRoute, clearIntendedRoute } from '../../auth/redirect-url.util';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { Subject, takeUntil, timeout, TimeoutError } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  authenticated  = false;
  showLoginForm  = false;
  showForgotForm = false;
  showDemoForm   = false;
  logoLoadFailed = false;

  userId   = '';
  password = '';
  hidePassword = true;

  forgotUserId  = '';
  forgotEmail   = '';
  sendingReset  = false;

  // Plans
  plans: PlanDetail[] = [];
  plansLoading = false;
  billingCycle: 'monthly' | 'annual' = 'monthly';
  private _masterFeatureList: { featureKey: string; displayName: string }[] | null = null;

  demo = {
    schoolName:  '',
    contactName: '',
    email:       '',
    phone:       '',
    students:    '',
    city:        '',
    message:     ''
  };

  constructor(
    private authService: AuthService,
    private authStateService: AuthStateService,
    private router: Router,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private demoService: DemoService,
    private toast: ToastService,
    public tenantService: TenantService,
    private schoolService: SchoolService
  ) { }

  ngOnInit() {
    // Bootstrap/AuthStateService is the authoritative source of truth for whether a session
    // exists — this component only ever reacts to an ALREADY-settled isLoggedIn(), it never
    // itself decides or repairs auth state. Honors a saved redirectUrl (set by a guard, or by
    // AuthInterceptor before an authoritative logout) so a user who ends up here mid-session —
    // then recovers, whether by logging back in or simply because a later check confirms the
    // session was fine all along — returns to the page they were using, not always /dashboard.
    if (this.authStateService.isLoggedIn()) {
      this.authenticated = true;
      this.router.navigateByUrl(consumeIntendedRoute());
    }
    this.loadPlans();
  }

  loadPlans(): void {
    this.plansLoading = true;
    this._masterFeatureList = null;
    this.schoolService.getPublicPlans().pipe(takeUntil(this.destroy$)).subscribe({
      next: (plans) => {
        this.plans = plans;
        this._masterFeatureList = null; // recompute on next access
        this.plansLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        // Silently ignore — fallback message shown in the template
        this.plansLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Plan display helpers ───────────────────────────────────
  planEmoji(tier: string): string {
    switch (tier?.toUpperCase()) {
      case 'CAMPUS':    return '🏫';
      case 'ACADEMY':   return '🎓';
      case 'INSTITUTE': return '🏛️';
      default:          return '📦';
    }
  }

  isPopularPlan(tier: string): boolean {
    return tier?.toUpperCase() === 'ACADEMY';
  }

  planPrice(plan: PlanDetail): string {
    const paise = this.billingCycle === 'annual' ? plan.annualPricePaise : plan.monthlyPricePaise;
    if (!paise || paise <= 0) return 'Contact Us';
    const rupees = paise / 100;
    return '₹' + rupees.toLocaleString('en-IN');
  }

  planPriceSuffix(plan: PlanDetail): string {
    const paise = this.billingCycle === 'annual' ? plan.annualPricePaise : plan.monthlyPricePaise;
    if (!paise || paise <= 0) return '';
    return this.billingCycle === 'annual' ? '/yr' : '/mo';
  }

  planIsContactSales(plan: PlanDetail): boolean {
    const paise = this.billingCycle === 'annual' ? plan.annualPricePaise : plan.monthlyPricePaise;
    return !paise || paise <= 0;
  }

  planStudentLabel(plan: PlanDetail): string {
    return plan.maxStudents ? `Up to ${plan.maxStudents.toLocaleString('en-IN')} students` : 'Unlimited students';
  }

  /**
   * Union of all features across all plans, sorted by displayName.
   * Memoized — recomputed only when plans reload.
   */
  get masterFeatureList(): { featureKey: string; displayName: string }[] {
    if (this._masterFeatureList) return this._masterFeatureList;
    const seen = new Map<string, string>(); // featureKey → displayName
    for (const plan of this.plans) {
      for (const f of plan.features) {
        if (!seen.has(f.featureKey)) seen.set(f.featureKey, f.displayName);
      }
    }
    this._masterFeatureList = Array.from(seen.entries())
      .map(([featureKey, displayName]) => ({ featureKey, displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return this._masterFeatureList;
  }

  planHasFeature(plan: PlanDetail, featureKey: string): boolean {
    return plan.features.some(f => f.featureKey === featureKey);
  }

  /**
   * Returns exactly CAP features per card: yes-features first (green), then
   * no-features (grey). Guarantees at least MIN_NO grey rows when missing
   * features exist — so higher-tier plans are visibly distinguishable.
   */
  sortedFeaturesForPlan(plan: PlanDetail): { featureKey: string; displayName: string; has: boolean }[] {
    const CAP = 9;
    const MIN_NO = 2; // always show at least 2 grey rows if any features are missing

    const master = this.masterFeatureList;
    const yes = master.filter(f =>  this.planHasFeature(plan, f.featureKey)).map(f => ({ ...f, has: true }));
    const no  = master.filter(f => !this.planHasFeature(plan, f.featureKey)).map(f => ({ ...f, has: false }));

    // Reserve guaranteed no-slots, then fill yes up to the remaining space,
    // then top up no-slots with whatever remains.
    const guaranteedNo = no.length > 0 ? Math.min(no.length, MIN_NO) : 0;
    const actualYes    = Math.min(yes.length, CAP - guaranteedNo);
    const actualNo     = Math.min(no.length,  CAP - actualYes);

    return [...yes.slice(0, actualYes), ...no.slice(0, actualNo)];
  }

  // ── Login ─────────────────────────────────────────────────
  login() {
    this.showLoginForm = true;
    this.cdr.markForCheck();
  }

  cancelLogin() {
    this.showLoginForm = false;
    this.userId = '';
    this.password = '';
    this.cdr.markForCheck();
  }

  submitLogin() {
    if (!this.userId.trim() || !this.password.trim()) {
      this.toast.warning('Missing Information', 'Please enter your User ID and Password.');
      return;
    }

    const brandedSlug = this.tenantService.slug;
    this.authService.login(this.userId, this.password, brandedSlug).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        // Safety net: user is on a branded school page but logged in with a different school's credentials.
        if (brandedSlug && response.schoolSlug && response.schoolSlug !== brandedSlug) {
          this.authService.logout().pipe(takeUntil(this.destroy$)).subscribe();
          this.toast.error('Wrong School', 'This account does not belong to this school. Please use the correct login page for your school.');
          return;
        }

        this.authStateService.setUser(response);

        // First-login (or admin-reset) accounts land on the mandatory password-change
        // page instead of the dashboard — enforced server-side too (JwtAuthFilter).
        const targetPath = response.mustChangePassword ? '/change-initial-password' : '/dashboard';

        // School user → ensure they're on their school subdomain.
        // SUPER_ADMIN has no schoolSlug and stays on the root domain.
        if (response.schoolSlug) {
          clearIntendedRoute();
          if (response.schoolSlug === this.tenantService.slug || this.tenantService.isLocalDev) {
            // Already on the correct subdomain — navigate locally, no reload needed.
            this.authenticated = true;
            this.showLoginForm = false;
            this.cdr.markForCheck();
            this.router.navigateByUrl(targetPath);
          } else {
            // On root domain — redirect to their school subdomain.
            window.location.href = this.tenantService.buildSchoolUrl(response.schoolSlug, targetPath);
          }
          return;
        }

        this.authenticated = true;
        this.showLoginForm = false;
        this.cdr.markForCheck();

        if (response.mustChangePassword) {
          this.router.navigateByUrl(targetPath);
          return;
        }

        this.router.navigateByUrl(consumeIntendedRoute());
      },
      error: (error) => {
        let text: string;
        if (error.status === 0) {
          text = 'Cannot reach the server. Please check your internet connection.';
        } else if (error.status === 403) {
          text = typeof error.error === 'string' && error.error.length < 200
            ? error.error
            : 'Access denied. Please contact support.';
        } else {
          text = 'Incorrect User ID or Password.';
        }
        this.toast.error('Login Failed', text);
        this.logger.error('Login error:', error);
      }
    });
  }

  logout() {
    this.authService.logout().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.authenticated = false; this.cdr.markForCheck(); },
      error: () => { this.authenticated = false; this.cdr.markForCheck(); }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  onLogoError(): void {
    this.logoLoadFailed = true;
    this.cdr.markForCheck();
  }

  changeSchool(): void {
    const slug = this.tenantService.slug;
    if (slug) {
      window.location.href = window.location.origin.replace(`${slug}.`, '');
    }
  }

  // ── Forgot Password ──────────────────────────────────────
  forgotPassword() {
    this.showLoginForm  = false;
    this.forgotUserId   = '';
    this.forgotEmail    = '';
    this.sendingReset   = false;
    this.showForgotForm = true;
    this.cdr.markForCheck();
  }

  cancelForgot() {
    this.showForgotForm = false;
    this.cdr.markForCheck();
  }

  submitForgot() {
    const uid   = this.forgotUserId.trim();
    const email = this.forgotEmail.trim();
    if (!uid || !email) {
      this.toast.warning('Required', 'Please enter both your User ID and registered email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.toast.warning('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    this.sendingReset = true;
    this.cdr.markForCheck();

    this.authService.requestPasswordReset(uid, email).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        this.sendingReset   = false;
        this.showForgotForm = false;
        this.cdr.markForCheck();
        this.toast.confirm({
          icon: 'success',
          title: 'Check Your Email',
          html: `<p>If the User ID and email match an account, a password reset link has been sent to <strong>${email}</strong>. Check your inbox (and spam folder) and follow the link to set your new password.</p>`,
          confirmText: 'Got it!'
        });
      },
      error: (error: any) => {
        this.sendingReset = false;
        this.cdr.markForCheck();
        this.toast.error('Could Not Send Link', error?.error || 'Please verify your User ID and registered email, then try again.');
      }
    });
  }

  // ── Demo Booking ──────────────────────────────────────────
  openDemo() {
    this.showDemoForm = true;
    this.cdr.markForCheck();
  }

  closeDemo() {
    this.showDemoForm = false;
    this.cdr.markForCheck();
  }

  submitDemo() {
    const { schoolName, contactName, email, phone } = this.demo;
    if (!schoolName.trim() || !contactName.trim() || !email.trim() || !phone.trim()) {
      this.toast.warning('Required Fields', 'Please fill in School Name, Contact Name, Email and Phone.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      this.toast.warning('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    this.demoService.submitRequest({
      schoolName:       this.demo.schoolName.trim(),
      contactName:      this.demo.contactName.trim(),
      email:            this.demo.email.trim(),
      phone:            this.demo.phone.trim(),
      numberOfStudents: this.demo.students.trim() || undefined,
      city:             this.demo.city.trim()     || undefined,
      message:          this.demo.message.trim()  || undefined
    }).pipe(timeout(20000), takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showDemoForm = false;
        this.demo = { schoolName: '', contactName: '', email: '', phone: '', students: '', city: '', message: '' };
        this.cdr.markForCheck();
        this.toast.confirm({
          icon: 'success',
          title: 'Demo Request Received!',
          html: '<p>Thank you! Our team will reach out within <strong>24 hours</strong> to schedule your personalised demo.</p>',
          confirmText: 'Awesome, Thanks!'
        });
      },
      error: (err) => {
        this.logger.error('Demo request failed:', err);
        const isTimeout = err instanceof TimeoutError;
        this.toast.error(
          isTimeout ? 'Request Timed Out' : 'Submission Failed',
          isTimeout
            ? 'The server took too long to respond. Please check your connection and try again.'
            : 'Could not send your request. Please try again or contact us directly.'
        );
      }
    });
  }
}
