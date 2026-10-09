import { manualRetryLaterCopy, paymentConflict, retryLaterCopy, serverTime } from './payment-conflict.util';

describe('payment-conflict util', () => {
  it('reads a pending 409 (CONFIRMING by default, NEEDS_REVIEW when the server says so)', () => {
    expect(paymentConflict({ status: 409, error: { error: 'm', pending: true, paymentId: 'pay_1' } }))
      .toEqual({ kind: 'pending', status: 'CONFIRMING', paymentId: 'pay_1', message: 'm' });
    expect(paymentConflict({ status: 409, error: { pending: true, status: 'NEEDS_REVIEW' } }))
      .toEqual(jasmine.objectContaining({ kind: 'pending', status: 'NEEDS_REVIEW', paymentId: null }));
  });

  it('reads a retryAfter 409 and shows the server time as IST, never re-zoned to the device', () => {
    const c = paymentConflict({ status: 409, error: { error: 'x', retryAfter: '2026-10-09T18:05:00' } });
    expect(c.kind).toBe('retry-later');
    expect(c.message).toContain('wait until 18:05 IST');
    expect(serverTime('2026-10-09T07:30:59.5')).toBe('07:30 IST');
    expect(serverTime('nonsense')).toBeNull();
    expect(retryLaterCopy('nonsense')).toContain('wait a few minutes');
  });

  it('anything else keeps the server message (or none)', () => {
    expect(paymentConflict({ status: 409, error: { error: 'No online route' } })).toEqual({ kind: 'other', message: 'No online route' });
    expect(paymentConflict({ status: 409, error: 'plain text' })).toEqual({ kind: 'other', message: 'plain text' });
    expect(paymentConflict({ status: 409 })).toEqual({ kind: 'other', message: null });
  });

  it('the manual-payment wording for an open online checkout also labels the time IST', () => {
    expect(manualRetryLaterCopy('2026-10-09T10:15:00')).toContain('Wait until 10:15 IST, or check with the parent');
    expect(manualRetryLaterCopy('x')).toContain('Wait a few minutes');
  });
});
