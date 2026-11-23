import { HomeComponent } from './home.component';

/**
 * Back history: a signed-in visit to /home redirects onwards and replaces /home, so Back from the
 * dashboard never returns to the sign-in page (and, on Android, the app can leave at the dashboard).
 */
describe('HomeComponent — redirect history', () => {
  it('replaces /home when a signed-in user is sent on to their page', () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    const c: any = Object.create(HomeComponent.prototype);
    Object.assign(c, {
      router: { navigateByUrl },
      authStateService: { isLoggedIn: () => true, mustChangePassword: () => false },
      tenantService: { slug: null },
      loadPlans: () => {},
    });
    c.ngOnInit();
    expect(navigateByUrl).toHaveBeenCalledTimes(1);
    expect(navigateByUrl.calls.mostRecent().args[1]).toEqual({ replaceUrl: true });
  });

  it('leaves history alone when nobody is signed in', () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl');
    const c: any = Object.create(HomeComponent.prototype);
    Object.assign(c, { router: { navigateByUrl }, authStateService: { isLoggedIn: () => false }, tenantService: { slug: null }, loadPlans: () => {} });
    c.ngOnInit();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
