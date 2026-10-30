import { NgZone } from '@angular/core';
import { of } from 'rxjs';
import { SchoolSettingsComponent } from './school-settings.component';
import { RazorpayCheckoutUnavailableError } from '../../services/razorpay-checkout.service';

/** Shared by the web and Android clients — keep the two copies identical. The subscription checkout
 * uses the shared Razorpay loader: a failed load is reported and the next attempt retries. */
describe('SchoolSettingsComponent — subscription checkout loader', () => {
  let schoolService: any;
  let toast: any;
  let checkout: any;
  let opened: any[];
  let c: SchoolSettingsComponent;
  const plan = { id: 4, name: 'Pro', monthlyPricePaise: 99900, annualPricePaise: 999000 } as any;
  const flush = () => new Promise((r) => setTimeout(r));

  function FakeRazorpay(this: any, options: any) { opened.push(options); return { open: jasmine.createSpy('open') }; }

  beforeEach(() => {
    opened = [];
    schoolService = {
      createUpgradeOrder: jasmine.createSpy().and.returnValue(of({ razorpayKey: 'rzp_test', amount: 99900, orderId: 'order_U1' })),
      verifyUpgradePayment: jasmine.createSpy().and.returnValue(of({ status: 'ACTIVE' })),
      getEntitlement: jasmine.createSpy().and.returnValue(of(null)),
      getSubscriptionHistory: jasmine.createSpy().and.returnValue(of([])),
    };
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);
    checkout = { load: jasmine.createSpy('load') };
    c = new SchoolSettingsComponent(
      schoolService, {} as any, {} as any, { markForCheck: () => {} } as any, jasmine.createSpyObj('LoggerService', ['error']),
      toast, { snapshot: { queryParamMap: { get: () => null } } } as any, {} as any, {} as any,
      checkout, new NgZone({ enableLongStackTrace: false }));
    c.billingCycle = 'MONTHLY' as any;
  });

  it('script fails to load: explains, releases the plan button, and a retry loads again and opens checkout', async () => {
    checkout.load.and.returnValue(Promise.reject(new RazorpayCheckoutUnavailableError('timeout')));
    c.startUpgrade(plan);
    await flush();
    expect(toast.error).toHaveBeenCalledWith('Error', 'Failed to load payment gateway. Please try again.');
    expect(c.upgradingPlanId).toBeNull();
    expect(opened.length).toBe(0);

    checkout.load.and.returnValue(Promise.resolve(FakeRazorpay as any));
    c.startUpgrade(plan);
    await flush();
    expect(checkout.load).toHaveBeenCalledTimes(2);
    expect(opened.length).toBe(1);
    expect(opened[0].order_id).toBe('order_U1');
    expect(opened[0].amount).toBe(99900);
    expect(c.upgradingPlanId).toBe(4);
  });

  it('the subscription flow is unchanged once checkout opens: dismiss releases, payment verifies', async () => {
    checkout.load.and.returnValue(Promise.resolve(FakeRazorpay as any));
    c.startUpgrade(plan);
    await flush();
    opened[0].modal.ondismiss();
    expect(c.upgradingPlanId).toBeNull();

    c.startUpgrade(plan);
    await flush();
    opened[1].handler({ razorpay_payment_id: 'pay_U1', razorpay_order_id: 'order_U1', razorpay_signature: 'sig' });
    expect(schoolService.verifyUpgradePayment).toHaveBeenCalledWith(jasmine.objectContaining({ razorpay_payment_id: 'pay_U1', planId: '4' }));
    expect(toast.success).toHaveBeenCalledWith('Upgraded!', jasmine.any(String));
  });

  it('a Razorpay constructor that throws is reported and releases the button', async () => {
    checkout.load.and.returnValue(Promise.resolve((() => { throw new Error('bad'); }) as any));
    c.startUpgrade(plan);
    await flush();
    expect(toast.error).toHaveBeenCalledWith('Error', 'Could not open the payment window. Please try again.');
    expect(c.upgradingPlanId).toBeNull();
  });
});
