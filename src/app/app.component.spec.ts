import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';
import { AuthStateService } from './auth/auth-state.service';
import { environment } from '../environments/environment';
import { baselineTestProviders } from '../testing/baseline-test-providers';

/**
 * AppComponent is the root gate between the normal app (<router-outlet>) and the
 * startup-recovery experience (<app-startup-recovery>) — see app.component.html's @switch on
 * AuthStateService.status$. This is what turns an unresolved/hung startup check into a
 * renderable STATE instead of an indefinite white screen.
 */
describe('AppComponent', () => {
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/auth/me`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [...baselineTestProviders()],
      imports: [AppComponent, HttpClientTestingModule, RouterTestingModule],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'ias' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('ias');
  });

  it('renders the loading variant (not a blank screen) while auth status is still CHECKING', () => {
    // AppComponent itself never calls loadCurrentUser() — that is APP_INITIALIZER's job (see
    // app.config.ts), decoupled here. AuthStateService's default status is CHECKING until
    // something calls it, which is exactly the state this test exercises: nothing has resolved
    // yet, and the root shell must still render something other than a blank screen.
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-startup-recovery')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).toBeNull();
  });

  it('renders the router outlet once the session check resolves to AUTHENTICATED', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const authState = TestBed.inject(AuthStateService);
    fixture.detectChanges();

    const p = authState.loadCurrentUser();
    http.expectOne(base).flush({
      userId: 'T1', role: 'TEACHER', name: null, className: null, schoolSlug: null,
      featureKeys: null, planTier: null, planVersion: null, subscriptionStatus: null,
      trialEndsAt: null, expiresAt: null, graceEndsAt: null, permissionKeys: null,
    });
    await p;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('app-startup-recovery')).toBeNull();
  });

  it('renders the router outlet (login flow) once the session check resolves to UNAUTHENTICATED', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const authState = TestBed.inject(AuthStateService);
    fixture.detectChanges();

    const p = authState.loadCurrentUser();
    http.expectOne(base).flush('nope', { status: 401, statusText: 'Unauthorized' });
    await p;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('renders the unavailable variant (never a blank screen) when the backend is unreachable', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const authState = TestBed.inject(AuthStateService);
    fixture.detectChanges();

    const p = authState.loadCurrentUser();
    http.expectOne(base).flush('unavailable', { status: 503, statusText: 'Service Unavailable' });
    await p;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-startup-recovery')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).toBeNull();
  });

  it('keeps the toast container mounted regardless of startup state', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-toast-container')).not.toBeNull();
  });
});
