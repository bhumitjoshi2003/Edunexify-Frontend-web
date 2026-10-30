import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthStateService } from '../../auth/auth-state.service';
import { ParentChildContextService } from '../../services/parent-child-context.service';
import { RouteBackBarComponent } from './route-back-bar.component';

@Component({ standalone: true, template: '' })
class Blank {}

@Component({ standalone: true, imports: [RouteBackBarComponent, RouterOutlet],
  template: `<app-route-back-bar></app-route-back-bar><router-outlet></router-outlet>` })
class Shell {}

describe('RouteBackBarComponent', () => {
  let fixture: ComponentFixture<Shell>;
  let router: Router;
  let role = 'ADMIN';
  let userId = 'A1';
  const child$ = new BehaviorSubject<{ studentId: string } | null>(null);

  const go = async (url: string) => {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('a.pb');
  };

  beforeEach(async () => {
    role = 'ADMIN'; userId = 'A1'; child$.next(null);
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([{
          path: 'dashboard', component: Blank,
          children: [
            { path: 'student-list', component: Blank },
            { path: 'teacher-substitutions', component: Blank },
            { path: 'admin-dashboard', component: Blank },
            { path: 'student-details/:studentId', component: Blank },
            { path: 'payment-history-details/:paymentId', component: Blank },
          ],
        }]),
        { provide: AuthStateService, useValue: { getUser: () => ({ role, userId }) } },
        { provide: ParentChildContextService, useValue: { selectedChild$: child$.asObservable() } },
      ],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
  });

  it('shows no back control on dashboards or top-level sidebar pages', async () => {
    expect(await go('/dashboard/admin-dashboard')).toBeNull();
    expect(await go('/dashboard/student-list')).toBeNull();
    expect(await go('/dashboard/teacher-substitutions')).toBeNull();
  });

  it('shows the parent\'s name on a nested page and links to it', async () => {
    const a = await go('/dashboard/student-details/S1');
    expect(a?.textContent).toContain('Students');
    expect(a?.getAttribute('href')).toBe('/dashboard/student-list');
  });

  it('updates as the user moves between top-level and nested pages', async () => {
    expect(await go('/dashboard/student-details/S1')).not.toBeNull();
    expect(await go('/dashboard/student-list')).toBeNull();
  });

  it('hides it on the signed-in person\'s own profile', async () => {
    role = 'STUDENT'; userId = 'S1';
    expect(await go('/dashboard/student-details/S1')).toBeNull();
  });

  it('uses the selected child for a parent\'s receipt', async () => {
    role = 'PARENT'; child$.next({ studentId: 'S9' });
    const a = await go('/dashboard/payment-history-details/55');
    expect(a?.getAttribute('href')).toBe('/dashboard/payment-history/S9');
  });
});
