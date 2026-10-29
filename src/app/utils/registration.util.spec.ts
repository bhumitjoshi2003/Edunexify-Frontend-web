import { registrationCredentialsDialog, registrationTabFromQuery } from './registration.util';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('registration entry and credentials', () => {
  it('?type=teacher opens the teacher form; anything else the student form', () => {
    expect(registrationTabFromQuery('teacher')).toBe('teacher');
    expect(registrationTabFromQuery(' Teacher ')).toBe('teacher');
    expect(registrationTabFromQuery('student')).toBe('student');
    expect(registrationTabFromQuery(null)).toBe('student');
    expect(registrationTabFromQuery('admin')).toBe('student');
  });

  it('credentials stay until acknowledged: one button, no cancel', () => {
    const dialog = registrationCredentialsDialog('student', 'stu_42');
    expect(dialog.cancelText).toBeUndefined();
    expect(dialog.confirmText).toBe('Done');
    expect(dialog.title).toBe('Student Registered!');
    expect(dialog.message).toContain('Edunexify Student ID: stu_42');
    expect(dialog.message).toContain('19900523');
    expect(dialog.message).toContain('create a new password during their first login');
  });

  it('teacher credentials, including a later joining date', () => {
    const dialog = registrationCredentialsDialog('teacher', 'emp_7', true);
    expect(dialog.title).toBe('Teacher Registered!');
    expect(dialog.message).toContain('Edunexify Employee ID: emp_7');
    expect(dialog.message).toContain('The login activates on the joining date.');
    expect(registrationCredentialsDialog('teacher', 'emp_7').message).not.toContain('joining date');
  });
});
