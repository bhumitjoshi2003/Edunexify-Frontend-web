import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeeBreakdownComponent, SelectionQuoteSummary } from './fee-breakdown.component';
import { MonthBreakdownDetails } from './fees.component';

/** The payment summary must never let one month's fee heads read as the whole multi-month charge,
 * and every amount uses the same Indian-grouped rupee format. */
describe('FeeBreakdownComponent', () => {
  let fixture: ComponentFixture<FeeBreakdownComponent>;
  const december: MonthBreakdownDetails = {
    studentId: 'stu_2', studentClass: '1', studentName: 'Gkgf', monthName: 'December 2026',
    additionalCharges: 0, lateFee: 0,
    feeLineItems: [{ name: 'Tuition', amount: 35000 }, { name: 'Bus Fee', amount: 2 }],
    breakdownUnavailable: false,
  } as any;
  const twoMonths: SelectionQuoteSummary = {
    monthNames: ['November 2026', 'December 2026'], schoolFee: 70004, lateFee: 0, leaveCharges: 0, convenienceFee: 0, total: 70004,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FeeBreakdownComponent] }).compileComponents();
    fixture = TestBed.createComponent(FeeBreakdownComponent);
  });

  function render(inputs: Record<string, unknown>): HTMLElement {
    Object.entries(inputs).forEach(([k, v]) => fixture.componentRef.setInput(k, v));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const text = (root: HTMLElement, id: string) =>
    (root.querySelector(`[data-testid="${id}"]`) as HTMLElement | null)?.innerText?.replace(/\s+/g, ' ').trim() ?? null;

  it('two months: says so, totals the whole selection first, and labels the fee heads as one month only', () => {
    const root = render({ details: december, selectedMonthCount: 2, quote: twoMonths });

    expect(text(root, 'breakdown-title')).toBe('2 months selected');
    expect(text(root, 'breakdown-month-list')).toBe('November 2026 · December 2026');
    expect(text(root, 'selection-summary')).toContain('School fee — 2 months ₹70,004');
    expect(text(root, 'selection-total')).toBe('Total payable — 2 months ₹70,004');
    const detail = text(root, 'month-detail')!;
    expect(detail.toLowerCase()).toContain('fee heads · december 2026 only');
    expect(detail).toContain('The total above covers all of them');
    expect(detail).toContain('Tuition ₹35,000');
    expect(detail).toContain('Bus Fee ₹2');
  });

  it('two months, quote still loading: no total is shown yet', () => {
    const root = render({ details: december, selectedMonthCount: 2, quote: null });
    expect(text(root, 'selection-total')).toBeNull();
    expect(root.textContent).toContain('Calculating the total for 2 months');
  });

  it('one month: the fee heads and the quote total, all with Indian grouping', () => {
    const root = render({ details: { ...december, feeLineItems: [{ name: 'Tuition', amount: 135000 }] },
      selectedMonthCount: 1, quote: { ...twoMonths, monthNames: ['December 2026'], total: 135002 } });
    expect(text(root, 'breakdown-title')).toBe('December 2026');
    expect(root.textContent).toContain('₹1,35,000');
    expect(text(root, 'selection-total')).toBe('Total payable ₹1,35,002');
    expect(root.textContent).not.toContain('₹135000');
  });

  it('late fee, leave charges and a convenience fee appear in the multi-month summary only when non-zero', () => {
    const root = render({ details: december, selectedMonthCount: 2,
      quote: { ...twoMonths, lateFee: 42.5, leaveCharges: 25, convenienceFee: 0, total: 70071.5 } });
    const summary = text(root, 'selection-summary')!;
    expect(summary).toMatch(/Late Fee Overdue ₹42\.50/i);
    expect(summary).toMatch(/Unapplied Leave Charges Deduction ₹25/i);
    expect(summary).not.toContain('Convenience');
    expect(text(root, 'selection-total')).toBe('Total payable — 2 months ₹70,071.50');
  });
});
