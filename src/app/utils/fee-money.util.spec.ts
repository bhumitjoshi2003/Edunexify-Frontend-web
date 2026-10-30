import { optionalRupeesToPaise, paiseToRupees, remainingDuePaise, rupeesToPaise } from './fee-money.util';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('fee money units', () => {
  it('converts at the rupee/paise boundary exactly once', () => {
    expect(paiseToRupees(5887)).toBe(58.87);
    expect(paiseToRupees(1)).toBe(0.01);
    expect(paiseToRupees(0)).toBe(0);
    expect(rupeesToPaise(58.87)).toBe(5887);
    expect(rupeesToPaise(0.01)).toBe(1);
    expect(rupeesToPaise(1)).toBe(100);
  });

  it('absorbs floating-point noise in fractional rupees', () => {
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise(1.005 * 1000)).toBe(100500);
    expect(rupeesToPaise(100.5)).toBe(10050);
  });

  it('a missing rupee value is null, never 0', () => {
    expect(optionalRupeesToPaise(null)).toBeNull();
    expect(optionalRupeesToPaise(undefined)).toBeNull();
    expect(optionalRupeesToPaise(NaN)).toBeNull();
    expect(optionalRupeesToPaise(0)).toBe(0);
  });

  it('remaining due is computed in integer paise and never negative', () => {
    expect(remainingDuePaise(100.5, 0, 100)).toBe(50);
    expect(remainingDuePaise(5000, 800, 2000)).toBe(380000);
    expect(remainingDuePaise(5000, 800, 9000)).toBe(0);
    expect(remainingDuePaise(5000, null, null)).toBe(500000);
    expect(remainingDuePaise(0.1, 0.2, 0)).toBe(30);
  });
});
