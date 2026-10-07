import { NgZone } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PaymentComponent } from './payment.component';

describe('PaymentComponent — order creation failures', () => {
  let razorpayService: any;
  let toast: any;
  let c: PaymentComponent;

  beforeEach(() => {
    razorpayService = { createOrder: jasmine.createSpy() };
    toast = jasmine.createSpyObj('ToastService', ['warning', 'error', 'success']);
    const studentService = { getStudent: () => of({ name: 'Asha' }) };
    const logger = jasmine.createSpyObj('LoggerService', ['error']);
    c = new PaymentComponent(razorpayService, studentService as any, new NgZone({ enableLongStackTrace: false }), logger, toast,
      { getUserRole: () => 'STUDENT' } as any);
    c.paymentData = { studentId: 'S1', totalAmount: 5800, additionalCharges: 0 } as any;
  });

  it('shows the server explanation when the school has no online payment route (409)', () => {
    razorpayService.createOrder.and.returnValue(throwError(() => ({
      status: 409, error: { error: 'Online fee payment is not available for this school yet. Please pay at the school office.' },
    })));
    const done = spyOn(c.paymentProcessCompleted, 'emit');
    c.loadStudentDetails('S1');
    expect(toast.warning).toHaveBeenCalledWith('Online Payments Unavailable',
      'Online fee payment is not available for this school yet. Please pay at the school office.');
    expect(toast.error).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalled();
  });

  it('falls back to a generic error for other failures', () => {
    razorpayService.createOrder.and.returnValue(throwError(() => ({ status: 500 })));
    c.loadStudentDetails('S1');
    expect(toast.error).toHaveBeenCalledWith('Error', 'Could not start the payment. Please try again.');
  });

  it('sends paise to the backend and never a client-recomputed fee', () => {
    razorpayService.createOrder.and.returnValue(throwError(() => ({ status: 500 })));
    c.loadStudentDetails('S1');
    expect(razorpayService.createOrder).toHaveBeenCalledWith(jasmine.objectContaining({ totalAmount: 580000, additionalCharges: 0 }));
  });

  describe('checkout branding', () => {
    let opened: any[];
    let original: any;

    beforeEach(() => {
      opened = [];
      original = (window as any).Razorpay;
      (window as any).Razorpay = function (options: any) { opened.push(options); return { open: () => {} }; };
    });

    afterEach(() => { (window as any).Razorpay = original; });

    const order = (over: any = {}) => ({ razorpayKey: 'rzp_live_schoolA', orderId: 'order_X', amount: 580000, ...over });

    it('a school-owned fee checkout shows the school name the server returned', () => {
      razorpayService.createOrder.and.returnValue(of(order({ checkoutName: 'Green Valley Public School' })));
      c.loadStudentDetails('S1');
      expect(opened.length).toBe(1);
      expect(opened[0].name).toBe('Green Valley Public School');
      expect(opened[0].key).toBe('rzp_live_schoolA');
    });

    it('ignores any client-side name in paymentData and keeps Edunexify branding when the server sends none', () => {
      c.paymentData = { ...c.paymentData, checkoutName: 'Spoofed Name', schoolName: 'Spoofed School' } as any;
      razorpayService.createOrder.and.returnValue(of(order()));
      c.loadStudentDetails('S1');
      expect(opened[0].name).toBe('Edunexify');
    });
  });

  describe('verification result', () => {
    const rzpResponse = { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'sig' };
    const order = { razorpayKey: 'rzp_live_x', orderId: 'order_1', amount: 580000 } as any;

    beforeEach(() => {
      razorpayService.verifyPayment = jasmine.createSpy();
      toast.info = jasmine.createSpy();
    });

    it('a payment Razorpay has not confirmed yet is reported as received, never as failed', () => {
      razorpayService.verifyPayment.and.returnValue(of({ success: false, pending: true,
        message: 'Payment received. We\'re confirming it with Razorpay — it will show as paid shortly. Please don\'t pay again.' }));
      const success = spyOn(c.paymentSuccess, 'emit');
      const done = spyOn(c.paymentProcessCompleted, 'emit');

      c.verifyPayment(rzpResponse, order);

      expect(toast.info).toHaveBeenCalledWith('Payment received', jasmine.stringMatching(/don't pay again/));
      expect(toast.error).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalled();
    });

    it('a confirmed payment still reports success', () => {
      razorpayService.verifyPayment.and.returnValue(of({ success: true }));
      const success = spyOn(c.paymentSuccess, 'emit');
      c.verifyPayment(rzpResponse, order);
      expect(success).toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });

    it('a refused payment still reports a verification failure', () => {
      razorpayService.verifyPayment.and.returnValue(of({ success: false, message: 'We couldn\'t confirm this payment' }));
      c.verifyPayment(rzpResponse, order);
      expect(toast.error).toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });
  });
});
