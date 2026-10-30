import { FeeMonthFacts, feeMonthPresentation } from './fee-month-state.util';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('fee month presentation', () => {
  const facts = (over: Partial<FeeMonthFacts> = {}): FeeMonthFacts => ({
    paid: false, amountUnavailable: false, pending: null, selected: false, late: false, amountPaidRupees: 0, ...over,
  });
  const pending = (status: 'CONFIRMING' | 'NEEDS_REVIEW') => ({ paymentId: 'pay_1', months: [5], pendingSince: null, status });

  it('unpaid: Due, or Overdue when late; selectable', () => {
    expect(feeMonthPresentation(facts())).toEqual(jasmine.objectContaining({ status: 'due', chip: 'Due', selectable: true }));
    expect(feeMonthPresentation(facts({ late: true }))).toEqual(jasmine.objectContaining({ status: 'overdue', chip: 'Overdue', selectable: true }));
  });

  it('partial: never Paid, still selectable, overdue shown second', () => {
    const p = feeMonthPresentation(facts({ amountPaidRupees: 0.5, late: true }));
    expect(p).toEqual({ status: 'partial', chip: 'Partial', partial: true, secondaryOverdue: true, selectable: true });
  });

  it('paid: Paid only from the backend flag, not selectable', () => {
    expect(feeMonthPresentation(facts({ paid: true, amountPaidRupees: 5800 })))
      .toEqual({ status: 'paid', chip: 'Paid', partial: false, secondaryOverdue: false, selectable: false });
  });

  it('amount unavailable: Needs review, not selectable, overdue secondary', () => {
    const p = feeMonthPresentation(facts({ amountUnavailable: true, late: true }));
    expect(p).toEqual(jasmine.objectContaining({ status: 'unavailable', chip: 'Needs review', secondaryOverdue: true, selectable: false }));
  });

  it('a pending online payment wins over everything except Paid, and is never selectable', () => {
    expect(feeMonthPresentation(facts({ pending: pending('CONFIRMING'), selected: true, late: true })))
      .toEqual(jasmine.objectContaining({ status: 'confirming', chip: 'Confirming', selectable: false, secondaryOverdue: false }));
    expect(feeMonthPresentation(facts({ pending: pending('NEEDS_REVIEW'), amountUnavailable: true })))
      .toEqual(jasmine.objectContaining({ status: 'needs-review', chip: 'Needs review', selectable: false }));
    expect(feeMonthPresentation(facts({ pending: pending('CONFIRMING'), paid: true })).status).toBe('paid');
  });

  it('selected leads over partial and overdue', () => {
    expect(feeMonthPresentation(facts({ selected: true, late: true, amountPaidRupees: 10 })))
      .toEqual(jasmine.objectContaining({ status: 'selected', chip: 'Selected', partial: true }));
  });
});
