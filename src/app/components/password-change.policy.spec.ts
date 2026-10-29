import { FormBuilder } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { StudentDetailsComponent } from './student-details/student-details.component';
import { TeacherDetailsComponent } from './teacher-details/teacher-details.component';
import { AdminDetailsComponent } from './admin-details/admin-details.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';

/** Shared by the web and Android clients — keep the two copies identical. Every user-chosen
 * password screen applies the backend's rule (utils/password-policy.util.ts) and sends the
 * password exactly as typed. */
describe('password screens use the shared password rule', () => {
  const weak: [string, string][] = [
    ['Abcde12', 'New password must be at least 8 characters long.'],
    ['abcdefg1', 'New password must contain at least one uppercase letter.'],
    ['ABCDEFG1', 'New password must contain at least one lowercase letter.'],
    ['Abcdefgh', 'New password must contain at least one digit.'],
  ];

  for (const [name, type] of [
    ['student details', StudentDetailsComponent],
    ['teacher details', TeacherDetailsComponent],
    ['admin details', AdminDetailsComponent],
  ] as [string, any][]) {
    describe(`${name} change-password dialog`, () => {
      let c: any;
      let authService: any;
      let toast: any;

      beforeEach(() => {
        // Only the dialog's own state is needed; no constructor dependencies are exercised.
        c = Object.create(type.prototype);
        authService = { changePassword: jasmine.createSpy('changePassword').and.returnValue(of('ok')) };
        toast = jasmine.createSpyObj('ToastService', ['error', 'success']);
        Object.assign(c, {
          authService, toast, ngUnsubscribe: new Subject<void>(), logger: { error: () => {} },
          cpShowOldField: false, cpOldPw: '', closePasswordModal: () => {},
        });
      });

      for (const [password, message] of weak) {
        it(`rejects "${password}" without calling the server`, () => {
          c.cpNewPw = password;
          c.cpConfirmPw = password;
          c.submitPasswordChange();
          expect(toast.error).toHaveBeenCalledWith('Error', message);
          expect(authService.changePassword).not.toHaveBeenCalled();
        });
      }

      it('accepts a valid password and sends it exactly as typed (spaces kept)', () => {
        c.cpNewPw = ' Abcde1 ';
        c.cpConfirmPw = ' Abcde1 ';
        c.submitPasswordChange();
        expect(authService.changePassword).toHaveBeenCalledWith(jasmine.objectContaining({ newPassword: ' Abcde1 ' }));
      });
    });
  }

  describe('reset-password page', () => {
    let c: ResetPasswordComponent;
    let authService: any;

    beforeEach(() => {
      authService = { resetPassword: jasmine.createSpy('resetPassword').and.returnValue(of({ message: 'ok' })) };
      const toast = jasmine.createSpyObj('ToastService', ['confirm', 'warning', 'error']);
      toast.confirm.and.returnValue(Promise.resolve(true));
      c = new ResetPasswordComponent(new FormBuilder(), {} as any, jasmine.createSpyObj('Router', ['navigate']), authService,
        jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']), toast);
      c.resetToken = 'token-1';
    });

    for (const [password] of weak) {
      it(`rejects "${password}" and does not submit`, () => {
        c.resetForm.setValue({ newPassword: password, confirmPassword: password });
        expect(c.resetForm.controls['newPassword'].hasError('passwordPolicy')).toBeTrue();
        c.onSubmit();
        expect(authService.resetPassword).not.toHaveBeenCalled();
      });
    }

    it('accepts a valid password and submits it exactly as typed (spaces kept)', () => {
      c.resetForm.setValue({ newPassword: ' Abcde1 ', confirmPassword: ' Abcde1 ' });
      expect(c.resetForm.valid).toBeTrue();
      c.onSubmit();
      expect(authService.resetPassword).toHaveBeenCalledWith('token-1', ' Abcde1 ');
    });
  });
});
