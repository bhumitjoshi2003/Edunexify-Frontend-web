import { of, throwError } from 'rxjs';
import { NotificationNavigationService } from './notification-navigation.service';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('NotificationNavigationService', () => {
  let router: any;
  let role: string;
  let parentPortal: any;
  let childContext: any;
  let toast: any;
  let service: NotificationNavigationService;

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    role = 'TEACHER';
    const auth = { getUserRole: () => role };
    parentPortal = jasmine.createSpyObj('ParentPortalService', ['getMyProfile']);
    parentPortal.getMyProfile.and.returnValue(of({ children: [{ studentId: 'stu_A', studentName: 'Asha' }] }));
    childContext = jasmine.createSpyObj('ParentChildContextService', ['select']);
    toast = jasmine.createSpyObj('ToastService', ['warning']);
    service = new NotificationNavigationService(router, auth as any, parentPortal, childContext, toast);
  });

  it('maps historical teacher-leave notifications to the supported route', async () => {
    expect(await service.navigate({ actionRoute: '/dashboard/my-leave' })).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/apply-teacher-leave'], { queryParams: {} });
  });

  it('keeps the query string of a safe dashboard route', async () => {
    await service.navigate({ actionRoute: '/dashboard/view-leaves?status=PENDING' });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/view-leaves'], { queryParams: { status: 'PENDING' } });
  });

  for (const bad of ['https://evil.example/dashboard/fees', '/dashboard/../admin', '/home', 'javascript:alert(1)', '//evil.example/dashboard/x']) {
    it(`refuses an unsafe action target: ${bad}`, async () => {
      expect(await service.navigate({ actionRoute: bad })).toBeFalse();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith('Unable to open notification', 'This notification link is not valid.');
    });
  }

  it('a notification without an action does nothing', async () => {
    expect(await service.navigate({ actionRoute: null })).toBeFalse();
    expect(await service.navigate({ actionRoute: '   ' })).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('parent: selects the referenced child and opens that child\'s fees', async () => {
    role = 'PARENT';
    await service.navigate({ actionRoute: '/dashboard/fees', sourceEntityType: 'STUDENT', sourceEntityId: 'stu_A' });
    expect(childContext.select).toHaveBeenCalledWith(jasmine.objectContaining({ studentId: 'stu_A' }));
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/fees/stu_A'], { queryParams: { studentId: 'stu_A' } });
  });

  it('parent: a child referenced in action metadata is resolved the same way', async () => {
    role = 'PARENT';
    await service.navigate({ actionRoute: '/dashboard/payment-history', actionMetadata: JSON.stringify({ studentId: 'stu_A' }) });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/payment-history/stu_A'], { queryParams: { studentId: 'stu_A' } });
  });

  it('parent: a child the parent can no longer access is refused, never opened', async () => {
    role = 'PARENT';
    expect(await service.navigate({ actionRoute: '/dashboard/fees', sourceEntityType: 'STUDENT', sourceEntityId: 'stu_GONE' })).toBeFalse();
    expect(childContext.select).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Access no longer available', jasmine.any(String));
  });

  it('parent: if access can\'t be checked, nothing is opened', async () => {
    role = 'PARENT';
    parentPortal.getMyProfile.and.returnValue(throwError(() => new Error('offline')));
    expect(await service.navigate({ actionRoute: '/dashboard/fees', sourceEntityType: 'STUDENT', sourceEntityId: 'stu_A' })).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('malformed action metadata is ignored, not fatal', async () => {
    expect(await service.navigate({ actionRoute: '/dashboard/notice', actionMetadata: '{not json' })).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/notice'], { queryParams: {} });
  });

  it('a destination that fails to open is reported', async () => {
    router.navigate.and.rejectWith(new Error('no route'));
    expect(await service.navigate({ actionRoute: '/dashboard/removed-page' })).toBeFalse();
    expect(toast.warning).toHaveBeenCalledWith('Unable to open notification', 'The destination may no longer be available.');
  });
});
