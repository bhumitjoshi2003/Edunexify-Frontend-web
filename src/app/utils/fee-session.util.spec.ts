import { feeMonthLabel } from './fee-session.util';
describe('fee session labels', () => {
  it('keeps academic ordinals through the calendar year boundary', () => {
    expect(feeMonthLabel('2026-10-01', 1)).toBe('October 2026');
    expect(feeMonthLabel('2026-10-01', 2)).toBe('November 2026');
    expect(feeMonthLabel('2026-10-01', 4)).toBe('January 2027');
  });
  it('shows missing session authority explicitly', () => {
    expect(feeMonthLabel(undefined, 1)).toContain('session dates unavailable');
  });
});
