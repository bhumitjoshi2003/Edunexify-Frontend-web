import { of, throwError } from 'rxjs';
import { SignOutService } from './sign-out.service';

describe('SignOutService (web)', () => {
  let auth: any;
  let school: any;
  let router: any;
  let service: SignOutService;

  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['logout', 'logoutAll']);
    school = jasmine.createSpyObj('SchoolService', ['invalidateClasses']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    service = new SignOutService(auth, school, router);
  });

  it('sign out: clears cached classes, ends this session and goes to sign-in, even if the call fails', async () => {
    auth.logout.and.returnValue(throwError(() => ({ status: 0 })));
    await service.signOut();
    expect(school.invalidateClasses).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('everywhere: calls logout-all, then leaves for sign-in', async () => {
    auth.logoutAll.and.returnValue(of({ revokedCount: 2 }));
    await service.signOutEverywhere();
    expect(auth.logoutAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('everywhere: a failed logout-all rejects and stays put', async () => {
    auth.logoutAll.and.returnValue(throwError(() => ({ status: 0 })));
    await expectAsync(service.signOutEverywhere()).toBeRejected();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
