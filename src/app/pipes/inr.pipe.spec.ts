import { formatInr, formatInrPaise, InrPaisePipe, InrPipe } from './inr.pipe';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('InrPipe', () => {
  it('uses Indian grouping for whole rupees', () => {
    expect(formatInr(0)).toBe('₹0');
    expect(formatInr(1)).toBe('₹1');
    expect(formatInr(100)).toBe('₹100');
    expect(formatInr(35000)).toBe('₹35,000');
    expect(formatInr(123456)).toBe('₹1,23,456');
    expect(formatInr(135000)).toBe('₹1,35,000');
  });

  it('keeps paise to two places when they exist', () => {
    expect(formatInr(0.5)).toBe('₹0.50');
    expect(formatInr(1.5)).toBe('₹1.50');
    expect(formatInr(100.5)).toBe('₹100.50');
    expect(formatInr(1234.05)).toBe('₹1,234.05');
  });

  it('a negative amount (a discount line) keeps its sign', () => {
    expect(formatInr(-500)).toBe('-₹500');
    expect(formatInr(-0.5)).toBe('-₹0.50');
  });

  it('shows a dash for a missing amount, never ₹0', () => {
    expect(formatInr(null)).toBe('—');
    expect(formatInr(undefined)).toBe('—');
    expect(new InrPipe().transform(NaN)).toBe('—');
  });
});

describe('InrPaisePipe', () => {
  it('formats integer paise without rounding paise away', () => {
    expect(formatInrPaise(0)).toBe('₹0');
    expect(formatInrPaise(100)).toBe('₹1');
    expect(formatInrPaise(50)).toBe('₹0.50');
    expect(formatInrPaise(10050)).toBe('₹100.50');
    expect(formatInrPaise(13500000)).toBe('₹1,35,000');
    expect(new InrPaisePipe().transform(588700)).toBe('₹5,887');
  });

  it('shows a dash for a missing amount', () => {
    expect(formatInrPaise(null)).toBe('—');
    expect(new InrPaisePipe().transform(undefined)).toBe('—');
  });
});
