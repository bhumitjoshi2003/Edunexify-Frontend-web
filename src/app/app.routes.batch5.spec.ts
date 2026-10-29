import { Route } from '@angular/router';
import { routes } from './app.routes';
import { roleGuard } from './auth/role.guard';

/** Shared by the web and Android clients — keep the two copies identical. The ported workflows
 * keep exactly the web access rules (role and feature), enforced again by the backend. */
describe('route access for target fee generation, school setup and active sessions', () => {
  const child = (path: string): Route => {
    const shell = routes.find(r => r.path === 'dashboard')!;
    const found = shell.children!.find(r => r.path === path);
    if (!found) throw new Error(`route ${path} missing`);
    return found;
  };

  it('school setup: ADMIN only, behind the role guard', () => {
    const route = child('school-setup');
    expect(route.canActivate).toContain(roleGuard);
    expect(route.data?.['roles']).toEqual(['ADMIN']);
  });

  it('target-session fee generation: ADMIN with the fee feature', () => {
    const route = child('fee-generation-target');
    expect(route.canActivate).toContain(roleGuard);
    expect(route.data?.['roles']).toEqual(['ADMIN']);
    expect(route.data?.['featureKey']).toBe('FEE_MANAGEMENT');
  });

  it('active sessions: every real role, including SUPER_ADMIN', () => {
    expect(child('active-sessions').data?.['roles']).toEqual(['STUDENT', 'TEACHER', 'ADMIN', 'SUB_ADMIN', 'PARENT', 'SUPER_ADMIN']);
  });

  it('notification inbox: the five school roles', () => {
    expect(child('notifications').data?.['roles']).toEqual(['STUDENT', 'TEACHER', 'ADMIN', 'SUB_ADMIN', 'PARENT']);
  });
});
