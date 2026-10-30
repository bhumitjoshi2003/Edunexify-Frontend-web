import { Subject } from 'rxjs';
import { NgForm } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { ToastService } from '../../services/toast.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterAdminComponent } from './register-admin.component';
import { baselineTestProviders } from '../../../testing/baseline-test-providers';

describe('RegisterAdminComponent', () => {
  let component: RegisterAdminComponent;
  let fixture: ComponentFixture<RegisterAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [...baselineTestProviders()],
      imports: [RegisterAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function valid() { component.adminData = { adminId: ' A1 ', name: ' Admin ', email: ' A@EXAMPLE.COM ', phoneNumber: '9876543210', dob: '1990-01-01', gender: 'Male', schoolId: 1 }; }
  const form = { invalid: false } as NgForm;
  it('blocks duplicate registration until the pending request finishes', () => {
    valid(); const pending = new Subject<any>(); const create = spyOn(TestBed.inject(AdminService), 'createAdmin').and.returnValue(pending);
    component.onSubmit(form); component.onSubmit(form); expect(create).toHaveBeenCalledTimes(1); expect(component.submitting).toBeTrue();
    expect(create.calls.mostRecent().args[0].email).toBe('a@example.com');
    pending.error({ error: { message: 'Email address is already in use.' } }); expect(component.submitting).toBeFalse();
  });
  it('shows backend domain errors without reporting success', () => {
    valid(); const pending = new Subject<any>(); spyOn(TestBed.inject(AdminService), 'createAdmin').and.returnValue(pending);
    const toast = TestBed.inject(ToastService); const error = spyOn(toast, 'error'); const success = spyOn(toast, 'success');
    component.onSubmit(form); pending.error({ error: 'Admin ID is already in use.' });
    expect(error).toHaveBeenCalledWith('Error', 'Admin ID is already in use.'); expect(success).not.toHaveBeenCalled();
  });
  it('does not submit whitespace-only names or future birth dates', () => {
    valid(); const create = spyOn(TestBed.inject(AdminService), 'createAdmin'); component.adminData.name = '  '; component.onSubmit(form);
    valid(); component.adminData.dob = '2099-01-01'; component.onSubmit(form); expect(create).not.toHaveBeenCalled();
  });
  it('acknowledges setup instructions only after creation succeeds', () => {
    valid(); const pending = new Subject<any>(); spyOn(TestBed.inject(AdminService), 'createAdmin').and.returnValue(pending);
    const success = spyOn(TestBed.inject(ToastService), 'success'); component.onSubmit(form); expect(success).not.toHaveBeenCalled();
    pending.next({ adminId: 'A1' }); pending.complete(); expect(success.calls.mostRecent().args[1]).toContain('setup link'); expect(component.submitting).toBeFalse();
  });
  it('unsubscribes from a pending create when destroyed', () => {
    valid(); const pending = new Subject<any>(); spyOn(TestBed.inject(AdminService), 'createAdmin').and.returnValue(pending);
    component.onSubmit(form); component.ngOnDestroy(); expect(pending.observed).toBeFalse();
  });
});
