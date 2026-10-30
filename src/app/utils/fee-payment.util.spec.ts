import { CheckoutQuote } from '../interfaces/checkout-quote';
import { emptyPaymentData, isPayable, monthSelectionString, paymentDataFromQuote, toCreateOrderRequest } from './fee-payment.util';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('fee payment draft', () => {
  const quote = (over: Partial<CheckoutQuote> = {}): CheckoutQuote => ({
    studentId: 'S1', session: '2026-2027', months: [5, 4],
    schoolFeePaise: 1159250, additionalChargesPaise: 5000, lateFeePaise: 4250,
    onlineConvenienceFeePaise: 17400, totalPayablePaise: 1176650, currency: 'INR', unresolvedMonths: [],
    ...over,
  });
  const context = { studentId: 'S1', studentName: 'Asha', className: '5', session: '2026-2027', months: [5, 4], busFeeRupees: 1600 };

  it('month selection string is a 12-bit mask; out-of-range months are ignored', () => {
    expect(monthSelectionString([4, 5])).toBe('000110000000');
    expect(monthSelectionString([1, 12])).toBe('100000000001');
    expect(monthSelectionString([0, 13, 2.5])).toBe('000000000000');
  });

  it('copies every amount from the quote in paise, unchanged', () => {
    const data = paymentDataFromQuote(quote(), context);
    expect(data.months).toEqual([4, 5]);
    expect(data.monthSelectionString).toBe('000110000000');
    expect(data.totalPayablePaise).toBe(1176650);
    expect(data.schoolFeePaise).toBe(1159250);
    expect(data.additionalChargesPaise).toBe(5000);
    expect(data.lateFeePaise).toBe(4250);
    expect(data.onlineConvenienceFeePaise).toBe(17400);
  });

  it('legacy receipt buckets are whole rupees for display only', () => {
    const data = paymentDataFromQuote(quote(), context);
    expect(data.legacyReceipt.tuitionFeeRupees).toBe(11500);
    expect(data.legacyReceipt.busFeeRupees).toBe(1600);
    expect(paymentDataFromQuote(quote({ schoolFeePaise: 9250, additionalChargesPaise: 0, lateFeePaise: 0 }),
      { ...context, busFeeRupees: 10.5 }).legacyReceipt).toEqual(jasmine.objectContaining({ tuitionFeeRupees: 93, busFeeRupees: 11 }));
  });

  it('a leave charge comes only from the quote, never from a leave count', () => {
    // Nothing about leave counts is accepted: the quote is the monetary authority.
    const data = paymentDataFromQuote(quote({ additionalChargesPaise: 2500 }), context);
    expect(data.additionalChargesPaise).toBe(2500);
    expect(Object.keys(context)).not.toContain('leaveCount');
  });

  it('missing leave/late fields in an older quote are zero', () => {
    const legacy = quote() as any;
    delete legacy.additionalChargesPaise;
    delete legacy.lateFeePaise;
    const data = paymentDataFromQuote(legacy, context);
    expect(data.additionalChargesPaise).toBe(0);
    expect(data.lateFeePaise).toBe(0);
    expect(data.legacyReceipt.tuitionFeeRupees).toBe(11593);
  });

  it('is payable only with a student, months and a positive integer paise total', () => {
    expect(isPayable(emptyPaymentData())).toBeFalse();
    expect(isPayable(null)).toBeFalse();
    const data = paymentDataFromQuote(quote(), context);
    expect(isPayable(data)).toBeTrue();
    expect(isPayable({ ...data, totalPayablePaise: 0 })).toBeFalse();
    expect(isPayable({ ...data, totalPayablePaise: 1 })).toBeTrue();
    expect(isPayable({ ...data, totalPayablePaise: 99.5 })).toBeFalse();
    expect(isPayable({ ...data, months: [] })).toBeFalse();
  });

  it('the order request keeps paise as paise and rupee buckets as rupees — no 100x scaling either way', () => {
    const request = toCreateOrderRequest(paymentDataFromQuote(quote(), context));
    expect(request).toEqual({
      totalAmount: 1176650,
      studentId: 'S1', studentName: 'Asha', className: '5', session: '2026-2027',
      monthSelectionString: '000110000000',
      totalTuitionFee: 11500, totalBusFee: 1600,
      totalAnnualCharges: 0, totalLabCharges: 0, totalEcaProject: 0, totalExaminationFee: 0,
      additionalCharges: 5000, lateFees: 4250, platformFee: 17400,
    });
  });

  it('a one-paisa and a ₹1 boundary stay exact', () => {
    expect(toCreateOrderRequest(paymentDataFromQuote(quote({ totalPayablePaise: 1 }), context)).totalAmount).toBe(1);
    expect(toCreateOrderRequest(paymentDataFromQuote(quote({ totalPayablePaise: 100 }), context)).totalAmount).toBe(100);
  });
});
