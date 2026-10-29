import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';
import { AuthService } from '../auth/auth.service';
import { AuthStateService } from '../auth/auth-state.service';

/** Shared by the web and Android clients — keep the two copies identical. Same backend contracts
 * on both: the refresh-token cookie identifies this session. */
describe('SessionService and logout-all', () => {
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/auth`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists sessions with credentials', () => {
    let result: any;
    TestBed.inject(SessionService).list().subscribe(r => (result = r));
    const req = http.expectOne(`${base}/sessions`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush([{ id: 1, current: true }]);
    expect(result).toEqual([{ id: 1, current: true }]);
  });

  it('revokes one session by id and revokes others', () => {
    const service = TestBed.inject(SessionService);
    service.revoke(7).subscribe();
    const one = http.expectOne(`${base}/sessions/7/revoke`);
    expect(one.request.method).toBe('POST');
    one.flush('Session revoked.');
    service.revokeOthers().subscribe();
    http.expectOne(`${base}/sessions/revoke-others`).flush({ revokedCount: 2 });
  });

  it('logout-all clears local auth state only after the server confirmed it', () => {
    const state = TestBed.inject(AuthStateService);
    state.setUser({ userId: 'U1', role: 'TEACHER' } as any);
    TestBed.inject(AuthService).logoutAll().subscribe();
    expect(state.isAuthenticated()).toBeTrue();
    http.expectOne(`${base}/logout-all`).flush({ revokedCount: 3 });
    expect(state.isUnauthenticated()).toBeTrue();
    expect(state.getUser()).toBeNull();
  });

  it('logout-all failing on the network leaves this device signed in', () => {
    const state = TestBed.inject(AuthStateService);
    state.setUser({ userId: 'U1', role: 'TEACHER' } as any);
    TestBed.inject(AuthService).logoutAll().subscribe({ error: () => {} });
    http.expectOne(`${base}/logout-all`).error(new ProgressEvent('error'), { status: 0 });
    expect(state.isAuthenticated()).toBeTrue();
  });
});
