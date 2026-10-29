import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthInterceptor, SIGNED_OUT_MESSAGE, SIGNED_OUT_TITLE } from './auth.interceptor';
import { AuthStateService } from './auth-state.service';
import { ToastService } from '../services/toast.service';
import { environment } from '../../environments/environment';

/** Shared by the web and Android clients — keep the two copies identical. A user whose session the
 * server ends is told why, once; a network blip or outage never shows it. */
describe('AuthInterceptor — "signed out" message', () => {
  let http: HttpTestingController;
  let httpClient: HttpClient;
  let authState: AuthStateService;
  let toast: jasmine.SpyObj<ToastService>;
  const base = environment.apiUrl;
  const originalPath = window.location.pathname + window.location.search;

  beforeEach(() => {
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info', 'confirm']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: ToastService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    authState = TestBed.inject(AuthStateService);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    http.verify();
    window.history.replaceState(null, '', originalPath);
  });

  function signIn(): void {
    authState.setUser({ userId: 'T1', role: 'TEACHER', name: null, className: null, schoolSlug: null, featureKeys: null,
      planTier: null, planVersion: null, subscriptionStatus: null, trialEndsAt: null, expiresAt: null,
      graceEndsAt: null, permissionKeys: null } as any);
  }

  function refreshFailsWith(status: number, path = '/dashboard/timetable'): void {
    window.history.pushState(null, '', path);
    httpClient.get(`${base}/some-protected-endpoint`, { withCredentials: true }).subscribe({ error: () => {} });
    http.expectOne(`${base}/some-protected-endpoint`).flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    const refresh = http.expectOne(`${base}/auth/refresh-token`);
    if (status === 0) refresh.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    else refresh.flush('rejected', { status, statusText: 'x' });
  }

  it('a session the server ended (refresh rejected) tells the signed-in user once', () => {
    signIn();
    refreshFailsWith(401);
    expect(toast.warning).toHaveBeenCalledOnceWith(SIGNED_OUT_TITLE, SIGNED_OUT_MESSAGE);
    expect(SIGNED_OUT_MESSAGE).toBe("You've been signed out. Please sign in again.");
  });

  it('a 403 refresh rejection is also a real sign-out', () => {
    signIn();
    refreshFailsWith(403);
    expect(toast.warning).toHaveBeenCalledOnceWith(SIGNED_OUT_TITLE, SIGNED_OUT_MESSAGE);
  });

  it('offline / network failure never shows it', () => {
    signIn();
    refreshFailsWith(0);
    expect(toast.warning).not.toHaveBeenCalled();
    expect(authState.isLoggedIn()).toBeTrue();
  });

  it('a server outage (503) never shows it', () => {
    signIn();
    refreshFailsWith(503);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('an anonymous visitor is never told they were signed out', () => {
    refreshFailsWith(401);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('a public page (reset password) never shows it', () => {
    signIn();
    refreshFailsWith(401, '/reset-password');
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('several requests failing together still show it once', () => {
    signIn();
    window.history.pushState(null, '', '/dashboard/timetable');
    httpClient.get(`${base}/a`, { withCredentials: true }).subscribe({ error: () => {} });
    httpClient.get(`${base}/b`, { withCredentials: true }).subscribe({ error: () => {} });
    http.expectOne(`${base}/a`).flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${base}/b`).flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${base}/auth/refresh-token`).flush('rejected', { status: 401, statusText: 'Unauthorized' });
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });
});
