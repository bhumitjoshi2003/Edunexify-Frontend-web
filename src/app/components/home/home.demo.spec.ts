import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { HomeComponent } from './home.component';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { DemoService } from '../../services/demo.service';
import { LoggerService } from '../../services/logger.service';
import { TenantService } from '../../services/tenant.service';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';

describe('Home demo booking', () => {
  let c: HomeComponent;
  let service: jasmine.SpyObj<DemoService>;
  let toast: jasmine.SpyObj<ToastService>;
  let pending: Subject<any>;

  beforeEach(() => {
    pending = new Subject();
    service = jasmine.createSpyObj('DemoService', ['submitRequest']);
    service.submitRequest.and.returnValue(pending);
    toast = jasmine.createSpyObj('ToastService', ['warning', 'error', 'confirm']);
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: AuthStateService, useValue: { isLoggedIn: () => false } },
        { provide: Router, useValue: {} },
        { provide: LoggerService, useValue: { error: () => {} } },
        { provide: DemoService, useValue: service },
        { provide: TenantService, useValue: { isBranded: false } },
        { provide: ToastService, useValue: toast },
        { provide: SchoolService, useValue: { getPublicPlans: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(HomeComponent);
    c = fixture.componentInstance;
    c.openDemo();
    c.demo = { schoolName: ' School ', contactName: ' Principal ', email: ' office@school.test ', phone: ' 9999999999 ', students: 350, city: ' City ', message: ' Please call ' };
    fixture.detectChanges();
  });

  it('submits from the real number input without throwing and disables repeated clicks', fakeAsync(() => {
    const fixture = TestBed.createComponent(HomeComponent);
    const component = fixture.componentInstance;
    component.showDemoForm = true;
    component.demo = { ...c.demo };
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="number"]');
    input.value = '450';
    input.dispatchEvent(new Event('input'));
    tick();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.lp-submit-teal');
    button.click();
    component.submitDemo();
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    expect(service.submitRequest).toHaveBeenCalledOnceWith({ schoolName: 'School', contactName: 'Principal', email: 'office@school.test', phone: '9999999999', numberOfStudents: '450', city: 'City', message: 'Please call' });
    pending.next({ notificationSent: true });
    pending.complete();
    expect(component.sendingDemo).toBeFalse();
    expect(component.showDemoForm).toBeFalse();
    expect(toast.confirm).toHaveBeenCalled();
  }));

  it('allows an empty student count and reports a saved request with failed email separately', () => {
    c.demo.students = null;
    c.submitDemo();
    expect(service.submitRequest.calls.mostRecent().args[0].numberOfStudents).toBeUndefined();
    pending.next({ notificationSent: false });
    pending.complete();
    expect(c.sendingDemo).toBeFalse();
    expect(c.showDemoForm).toBeFalse();
    expect(toast.warning).toHaveBeenCalledWith('Request Saved', jasmine.stringContaining('You do not need to submit again'));
    expect(toast.confirm).not.toHaveBeenCalled();
  });

  it('retains the form on network failure and permits retry', () => {
    c.submitDemo();
    pending.error({ status: 0 });
    expect(c.sendingDemo).toBeFalse();
    expect(c.showDemoForm).toBeTrue();
    expect(c.demo.schoolName).toBe(' School ');
    expect(toast.error).toHaveBeenCalled();
  });

  it('does not resend automatically after an uncertain timeout', fakeAsync(() => {
    c.submitDemo();
    tick(20001);
    expect(c.sendingDemo).toBeFalse();
    expect(service.submitRequest).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Request Timed Out', jasmine.stringContaining('before submitting again'));
  }));

  it('rejects missing required fields and invalid email without a network request', () => {
    c.demo.schoolName = ' ';
    c.submitDemo();
    c.demo.schoolName = 'School';
    c.demo.email = 'invalid';
    c.submitDemo();
    expect(service.submitRequest).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending submission when the component is destroyed', () => {
    c.submitDemo();
    c.ngOnDestroy();
    expect(c.sendingDemo).toBeFalse();
    pending.next({ notificationSent: true });
    expect(toast.confirm).not.toHaveBeenCalled();
  });
});
