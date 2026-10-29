import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { baselineTestProviders } from '../../../testing/baseline-test-providers';
import { environment } from '../../../environments/environment';
import { HomeComponent } from './home.component';
import { ToastService } from '../../services/toast.service';

/** Sign In: one submission -> one login request, and a rate-limit (429) is never shown as bad credentials. */
describe('HomeComponent — sign in', () => {
  const LOGIN = `${environment.apiUrl}/auth/login`;
  let http: HttpTestingController;
  let toast: jasmine.SpyObj<ToastService>;
  let router: Router;

  const user = { userId: 'SA1', role: 'SUPER_ADMIN', name: 'Admin', schoolSlug: null, featureKeys: [], permissionKeys: [], mustChangePassword: false };

  function setup(template?: string) {
    toast = jasmine.createSpyObj('ToastService', ['warning', 'error', 'success', 'info', 'confirm']);
    TestBed.configureTestingModule({
      providers: [...baselineTestProviders(), { provide: ToastService, useValue: toast }],
    });
    if (template !== undefined) TestBed.overrideComponent(HomeComponent, { set: { template } });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(HomeComponent);
    const component = fixture.componentInstance;
    component.userId = 'SA1';
    component.password = 'Secret123';
    return { fixture, component };
  }

  afterEach(() => http.verify());

  it('sends exactly one login request for repeated submits and unlocks after success', () => {
    const { component } = setup('');
    component.submitLogin();
    component.submitLogin();
    component.submitLogin();
    const req = http.expectOne(LOGIN);
    expect(component.signingIn).toBeTrue();
    req.flush(user);
    expect(component.signingIn).toBeFalse();
    expect(router.navigateByUrl).toHaveBeenCalled();
  });

  it('unlocks after a failed login so the user can try again', () => {
    const { component } = setup('');
    component.submitLogin();
    http.expectOne(LOGIN).flush('Invalid credentials', { status: 400, statusText: 'Bad Request' });
    expect(component.signingIn).toBeFalse();
    component.submitLogin();
    http.expectOne(LOGIN).flush(user);
  });

  it('shows the backend rate-limit message for 429 instead of "Incorrect User ID or Password."', () => {
    const { component } = setup('');
    component.submitLogin();
    http.expectOne(LOGIN).flush('Too many login attempts. Try again in 5 minutes.', { status: 429, statusText: 'Too Many Requests' });
    expect(toast.error).toHaveBeenCalledOnceWith('Login Failed', 'Too many login attempts. Try again in 5 minutes.');
  });

  it('keeps the non-enumerating message for ordinary bad credentials', () => {
    const { component } = setup('');
    component.submitLogin();
    http.expectOne(LOGIN).flush('Invalid credentials', { status: 400, statusText: 'Bad Request' });
    expect(toast.error).toHaveBeenCalledOnceWith('Login Failed', 'Incorrect User ID or Password.');
  });

  it('disables the real Sign In button and shows a loading label while signing in', () => {
    const { fixture, component } = setup();
    component.showLoginForm = true;
    fixture.detectChanges();
    http.match(r => !r.url.endsWith('/auth/login')).forEach(r => r.flush([]));
    const button = [...fixture.nativeElement.querySelectorAll('button.lp-submit-btn')]
      .find((b: HTMLButtonElement) => /sign in/i.test(b.textContent ?? '')) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent?.trim()).toBe('Signing in…');
    button.click();
    http.expectOne(LOGIN).flush(user);
    fixture.detectChanges();
    expect(component.signingIn).toBeFalse();
    expect(component.showLoginForm).toBeFalse(); // signed in: the sheet (and its button) is gone
  });
});
