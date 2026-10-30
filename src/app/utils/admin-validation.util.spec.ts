import { adminProfileError, normalizeAdminProfile } from './admin-validation.util';
describe('Admin profile validation', () => {
 const input = { name: ' Admin ', email: ' A@EXAMPLE.COM ', phoneNumber: '9876543210', dob: '1990-01-01', gender: ' male ' };
 it('normalizes optional and required profile strings', () => { expect(normalizeAdminProfile(input)).toEqual({ name: 'Admin', email: 'a@example.com', phoneNumber: '9876543210', dob: '1990-01-01', gender: 'Male' }); expect(adminProfileError(input)).toBeNull(); });
 for (const patch of [{ name: '  ' }, { email: 'bad' }, { phoneNumber: '123' }, { dob: '1899-12-31' }, { dob: '2099-01-01' }, { dob: 'not-a-date' }, { dob: '1990-02-30' }, { gender: 'unknown' }]) {
  it('rejects invalid ' + Object.keys(patch)[0] + ':' + Object.values(patch)[0], () => { expect(adminProfileError({ ...input, ...patch })).not.toBeNull(); });
 }
});
