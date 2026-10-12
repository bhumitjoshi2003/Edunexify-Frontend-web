import { formatInr, InrPipe } from './inr.pipe';

describe('InrPipe', () => {
  it('uses Indian grouping for whole rupees', () => {
    expect(formatInr(35000)).toBe('₹35,000');
    expect(formatInr(35002)).toBe('₹35,002');
    expect(formatInr(123456)).toBe('₹1,23,456');
    expect(formatInr(0)).toBe('₹0');
  });

  it('keeps paise to two places when they exist', () => {
    expect(formatInr(1.5)).toBe('₹1.50');
    expect(formatInr(1234.05)).toBe('₹1,234.05');
  });

  it('shows a dash for a missing amount, never ₹0', () => {
    expect(formatInr(null)).toBe('—');
    expect(formatInr(undefined)).toBe('—');
    expect(new InrPipe().transform(NaN)).toBe('—');
  });
});
