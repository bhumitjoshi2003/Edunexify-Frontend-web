import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output, NgZone } from '@angular/core';
import { EMPTY, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { LoggerService } from '../../services/logger.service';
import { RazorpayService, RazorpayOrderResponse, RazorpayPaymentResponse } from '../../services/razorpay.service';
import { PaymentData } from '../../interfaces/payment-data';
import { ToastService } from '../../services/toast.service';
import { StudentService } from '../../services/student.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { PaymentConflict, paymentConflict } from '../../utils/payment-conflict.util';

declare var Razorpay: any;

/** Razorpay Checkout closes itself after this long — safely inside the server's 15-minute
 * open-checkout window, so an abandoned checkout can't be paid after the server treats it as stale. */
export const CHECKOUT_TIMEOUT_SECONDS = 600;

@Component({
  selector: 'app-payment',
  imports: [],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private razorpayService: RazorpayService,
    private studentService: StudentService,
    private ngZone: NgZone,
    private logger: LoggerService,
    private toast: ToastService,
    private authState: AuthStateService
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @Input() paymentData: PaymentData = {
    totalAmount: 0,
    monthSelectionString: "000000000000",
    totalTuitionFee: 0,
    totalAnnualCharges: 0,
    totalLabCharges: 0,
    totalEcaProject: 0,
    totalBusFee: 0,
    totalExaminationFee: 0,
    studentId: "",
    studentName: "",
    className: "",
    session: "",
    paidManually: false,
    amountPaid: 0,
    additionalCharges: 0,
    lateFees: 0,
    platformFee: 0
  };

  @Input() disabled: boolean = false;
  @Output() paymentSuccess = new EventEmitter<RazorpayPaymentResponse>();
  @Output() paymentProcessingStarted = new EventEmitter<void>();
  @Output() paymentProcessCompleted = new EventEmitter<void>();
  /** Money was taken but is still being confirmed (or verification couldn't be reached): the
   * page must reload its server state and stop offering these months. Emits the payment id. */
  @Output() paymentPending = new EventEmitter<string>();
  /** The server refused a new order (409) because of an earlier payment for these months. */
  @Output() paymentConflict = new EventEmitter<PaymentConflict>();

  studentDetails: { name: string; email?: string; phoneNumber?: string } | null = null;

  async initiatePayment(): Promise<void> {
    if (!this.paymentData || !this.paymentData.studentId) {
      this.toast.warning('Payment Error', 'Payment data or student ID is missing.');
      this.paymentProcessCompleted.emit();
      return;
    }
    if (this.authState.getUserRole() === 'PARENT') {
      const confirmed = await this.toast.confirm({
        title: `Pay fees for ${this.paymentData.studentName}?`,
        message: `You are about to pay ₹${this.paymentData.totalAmount.toLocaleString('en-IN')} for ${this.paymentData.studentName} (${this.paymentData.studentId}).`,
        confirmText: 'Continue to payment', cancelText: 'Cancel', danger: false, icon: 'info'
      });
      if (!confirmed) return;
    }
    this.paymentProcessingStarted.emit();
    this.loadStudentDetails(this.paymentData.studentId);
  }

  loadStudentDetails(studentId: string): void {
    this.studentService.getStudent(studentId).pipe(
      takeUntil(this.destroy$),
      switchMap((student) => {
        this.studentDetails = student;
        if (!this.paymentData) {
          this.toast.warning('Payment Error', 'Payment data or student details are missing.');
          this.paymentProcessCompleted.emit();
          return EMPTY;
        }
        // Use a copy to avoid mutating the @Input across multiple payment attempts. paymentData
        // is rupee-domain throughout the UI (see PaymentData) — totalAmount and additionalCharges
        // are the only two fields the backend actually validates from this request, so both (and
        // only both) are converted to paise here, at the HTTP boundary.
        const orderData: PaymentData = {
          ...this.paymentData,
          totalAmount: this.paymentData.totalAmount * 100,
          additionalCharges: this.paymentData.additionalCharges * 100
        };
        return this.razorpayService.createOrder(orderData);
      })
    ).subscribe({
      next: (response: RazorpayOrderResponse) => {
        const options = {
          key: response.razorpayKey,
          amount: response.amount,
          currency: 'INR',
          // Server-chosen from trusted school data — never a client-supplied name.
          name: response.checkoutName || 'Edunexify',
          description: 'Edunexify Fee Payment',
          order_id: response.orderId,
          prefill: {
            name: this.studentDetails?.name || '',
            email: this.studentDetails?.email || '',
            contact: this.studentDetails?.phoneNumber || ''
          },
          theme: { color: '#4fbdbd' },
          timeout: CHECKOUT_TIMEOUT_SECONDS,
          method: { netbanking: true, card: true, upi: true, wallet: false },
          handler: (paymentResponse: RazorpayPaymentResponse) => {
            this.verifyPayment(paymentResponse, response);
          },
          modal: {
            ondismiss: () => {
              this.ngZone.run(() => this.paymentProcessCompleted.emit());
              this.toast.warning('Payment Cancelled!', 'Please try again if you wish to proceed.');
            }
          }
        };
        const rzp = new Razorpay(options);
        rzp.open();
      },
      error: (error) => {
        this.logger.error('Error starting payment:', error);
        if (error?.status === 409) {
          const conflict = paymentConflict(error);
          if (conflict.kind === 'pending') {
            // An earlier payment for these months was taken and isn't recorded yet: never a retry prompt.
            this.toast.warning(conflict.status === 'NEEDS_REVIEW' ? 'Payment needs review' : 'Payment being confirmed',
              conflict.message + (conflict.paymentId ? ` Payment ID: ${conflict.paymentId}` : ''));
            this.paymentConflict.emit(conflict);
          } else if (conflict.kind === 'retry-later') {
            this.toast.warning('Payment already started', conflict.message);
            this.paymentConflict.emit(conflict);
          } else {
            // The school has no active payment gateway (or online pricing isn't available): the
            // server refused to create the order. Show its message — it's written for parents.
            this.toast.warning('Online Payments Unavailable',
              conflict.message || 'Online payment is not available for this school right now. Please contact the school office.');
          }
        } else {
          this.toast.error('Error', 'Could not start the payment. Please try again.');
        }
        this.paymentProcessCompleted.emit();
      }
    });
  }

  verifyPayment(paymentResponse: RazorpayPaymentResponse, orderDetails: RazorpayOrderResponse) {
    const paymentId = paymentResponse.razorpay_payment_id;
    this.razorpayService.verifyPayment(paymentResponse, orderDetails).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        if (result.success) {
          this.paymentSuccess.emit(paymentResponse);
        } else if (result.pending) {
          // Money taken, confirmation with Razorpay still in progress: reassure, never "failed",
          // so nobody pays twice. The server settles it automatically once Razorpay confirms.
          const id = result.paymentId || paymentId;
          this.toast.info('Payment received',
            (result.message || 'We\'re confirming your payment with Razorpay. It will show as paid shortly — please don\'t pay again.')
            + (id ? ` Payment ID: ${id}` : ''));
          this.paymentPending.emit(id);
          this.paymentProcessCompleted.emit();
        } else {
          // Refused: the server's message names the payment ID for the school office.
          this.toast.error('Payment not confirmed', result.message
            || `Payment could not be verified. Please contact the school office with Payment ID ${paymentId}.`);
          this.paymentProcessCompleted.emit();
        }
      },
      error: (err) => {
        // Checkout already succeeded, so money may have been taken even though the server couldn't
        // be reached: never invite a second payment.
        this.logger.error('Error during payment verification:', err);
        this.toast.warning('Payment being confirmed',
          'We couldn\'t confirm your payment yet. It may already have been received — please don\'t pay again. '
          + 'It will be confirmed automatically; contact the school office if it isn\'t shown as paid soon.'
          + (paymentId ? ` Payment ID: ${paymentId}` : ''));
        this.paymentPending.emit(paymentId);
        this.paymentProcessCompleted.emit();
      }
    });
  }
}
