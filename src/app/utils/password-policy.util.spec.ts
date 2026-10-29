import { FormControl } from '@angular/forms';
import { PASSWORD_MIN_LENGTH, passwordPolicyValidator, passwordPolicyViolation } from './password-policy.util';

/** Shared by the web and Android clients — keep the two copies identical. Mirrors the backend's
 * PasswordPolicyTest so both sides accept and reject the same candidates. */
describe('password policy', () => {
  it('too short', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(passwordPolicyViolation('Abcde12')).toBe('Password must be at least 8 characters long.');
    expect(passwordPolicyViolation('')).toBe('Password must be at least 8 characters long.');
    expect(passwordPolicyViolation(null)).toBe('Password must be at least 8 characters long.');
  });

  it('missing uppercase', () => {
    expect(passwordPolicyViolation('abcdefg1')).toBe('Password must contain at least one uppercase letter.');
  });

  it('missing lowercase', () => {
    expect(passwordPolicyViolation('ABCDEFG1')).toBe('Password must contain at least one lowercase letter.');
  });

  it('missing digit', () => {
    expect(passwordPolicyViolation('Abcdefgh')).toBe('Password must contain at least one digit.');
  });

  it('valid password', () => {
    expect(passwordPolicyViolation('Abcdefg1')).toBeNull();
    expect(passwordPolicyViolation('Str0ngPassword!')).toBeNull();
  });

  it('spaces are part of the password, never trimmed', () => {
    expect(passwordPolicyViolation(' Abcde1 ')).toBeNull();          // 8 only because the spaces count
    expect(passwordPolicyViolation('Abcde1 ')).toBe('Password must be at least 8 characters long.');
  });

  it('names the field in the message', () => {
    expect(passwordPolicyViolation('abc', 'New admin password')).toBe('New admin password must be at least 8 characters long.');
  });

  it('form validator: same rule, empty left to required, value never trimmed', () => {
    expect(passwordPolicyValidator(new FormControl(''))).toBeNull();
    expect(passwordPolicyValidator(new FormControl('Abcde12'))).toEqual({ passwordPolicy: 'Password must be at least 8 characters long.' });
    expect(passwordPolicyValidator(new FormControl('abcdefg1'))).toEqual({ passwordPolicy: 'Password must contain at least one uppercase letter.' });
    expect(passwordPolicyValidator(new FormControl('Abcdefg1'))).toBeNull();
    expect(passwordPolicyValidator(new FormControl(' Abcde1 '))).toBeNull();
  });
});
