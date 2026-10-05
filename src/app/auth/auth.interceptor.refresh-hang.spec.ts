import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClient, HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthInterceptor } from './auth.interceptor';
import { AuthStateService } from './auth-state.service';
import { STARTUP_HTTP_TIMEOUT_MS } from '../core/startup.constants';
import { environment } from '../../environments/environment';

/**
 * A refresh that never answers (started just before a mobile browser froze the tab) or that is
 * abandoned mid-flight must never leave the requests queued behind it waiting forever.
 */
describe('AuthInterceptor — a refresh that never completes', () => {
  const REFRESH = `${environment.apiUrl}/auth/refresh-token`;
  const A = `${environment.apiUrl}/students/1`;
  const B = `${environment.apiUrl}/notifications/unread-count`;
  const unauthorized = { status: 401, statusText: 'Unauthorized' };

  let http: HttpTestingController;
  let client: HttpClient;
  let authState: AuthStateService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    authState = TestBed.inject(AuthStateService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(authState, 'clearUser').and.callThrough();
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('redirectUrl');
  });

  it('times out as a transient failure: every queued request is released, nobody is signed out', fakeAsync(() => {
    const outcomes: string[] = [];
    client.get(A).subscribe({ next: () => outcomes.push('A ok'), error: () => outcomes.push('A failed') });
    client.get(B).subscribe({ next: () => outcomes.push('B ok'), error: () => outcomes.push('B failed') });
    http.expectOne(A).flush('expired', unauthorized);
    http.expectOne(B).flush('expired', unauthorized);
    const refresh = http.expectOne(REFRESH);   // exactly one refresh for both

    tick(STARTUP_HTTP_TIMEOUT_MS);

    expect(refresh.cancelled).toBeTrue();
    expect(outcomes.sort()).toEqual(['A failed', 'B failed']);
    expect(authState.clearUser).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('abandoned by the request that started it: the requests queued behind it fail instead of hanging', () => {
    const outcomes: string[] = [];
    const first = client.get(A).subscribe();
    client.get(B).subscribe({ next: () => outcomes.push('B ok'), error: () => outcomes.push('B failed') });
    http.expectOne(A).flush('expired', unauthorized);
    http.expectOne(B).flush('expired', unauthorized);
    const refresh = http.expectOne(REFRESH);

    first.unsubscribe();   // e.g. an outer timeout() or a destroyed component

    expect(refresh.cancelled).toBeTrue();
    expect(outcomes).toEqual(['B failed']);

    // and the next request starts a fresh refresh rather than queueing behind the dead one
    client.get(A).subscribe({ error: () => outcomes.push('A failed') });
    http.expectOne(A).flush('expired', unauthorized);
    http.expectOne(REFRESH).flush('revoked', unauthorized);
    expect(outcomes).toEqual(['B failed', 'A failed']);
  });

  it('a 403 on the retried request after a successful refresh is that request\'s error — not a logout', () => {
    let failure: unknown;
    client.get(A).subscribe({ error: e => failure = e });
    http.expectOne(A).flush('expired', unauthorized);
    http.expectOne(REFRESH).flush({ userId: 'T1', role: 'TEACHER' });
    http.expectOne(A).flush({ code: 'FEATURE_NOT_AVAILABLE' }, { status: 403, statusText: 'Forbidden' });

    expect((failure as { status?: number }).status).toBe(403);
    expect(authState.clearUser).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalledWith(['/home']);
  });
});
