import { localPendingPayment, reconcilePendingConfirmations } from './pending-payment.util';
import { PendingConfirmation } from '../interfaces/pending-confirmation';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('pending payment reconciliation', () => {
  const server = (paymentId: string, months: number[], status: 'CONFIRMING' | 'NEEDS_REVIEW' = 'CONFIRMING'): PendingConfirmation =>
    ({ paymentId, months, pendingSince: '2026-10-09T10:00:00', status });

  it('remembers the payment ID and months; a blank ID is null, not ""', () => {
    expect(localPendingPayment(' pay_1 ', [5, 4, 5])).toEqual({ paymentId: 'pay_1', months: [4, 5] });
    expect(localPendingPayment('', [6])).toEqual({ paymentId: null, months: [6] });
    expect(localPendingPayment(null, [6])).toEqual({ paymentId: null, months: [6] });
    expect(localPendingPayment('pay_1', [])).toBeNull();
  });

  it('keeps the local payment visible while the server does not list it (e.g. a failed refresh)', () => {
    const local = localPendingPayment('pay_1', [4, 5]);
    const result = reconcilePendingConfirmations([], local, new Set());
    expect(result.local).toEqual(local);
    expect(result.confirmations).toEqual([{ paymentId: 'pay_1', months: [4, 5], pendingSince: null, status: 'CONFIRMING' }]);
  });

  it('the server state governs once it lists the payment — including NEEDS_REVIEW', () => {
    const result = reconcilePendingConfirmations([server('pay_1', [4, 5], 'NEEDS_REVIEW')], localPendingPayment('pay_1', [4, 5]), new Set());
    expect(result.local).toBeNull();
    expect(result.confirmations).toEqual([server('pay_1', [4, 5], 'NEEDS_REVIEW')]);
  });

  it('released once its months are paid', () => {
    const result = reconcilePendingConfirmations([], localPendingPayment('pay_1', [4, 5]), new Set([4, 5]));
    expect(result.local).toBeNull();
    expect(result.confirmations).toEqual([]);
  });

  it('only the months not yet paid or covered by another server entry stay locked', () => {
    const result = reconcilePendingConfirmations([server('pay_2', [5])], localPendingPayment(null, [4, 5, 6]), new Set([6]));
    expect(result.confirmations.length).toBe(2);
    expect(result.confirmations[1]).toEqual({ paymentId: '', months: [4], pendingSince: null, status: 'CONFIRMING' });
    expect(result.local).not.toBeNull();
  });

  it('with no local payment, the server list is passed through unchanged', () => {
    const list = [server('pay_3', [7])];
    const result = reconcilePendingConfirmations(list, null, new Set());
    expect(result.confirmations).toEqual(list);
    expect(result.confirmations).not.toBe(list);
  });
});
