import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, Output, NgZone } from '@angular/core';
import { EMPTY, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { LoggerService } from '../../services/logger.service';
import { RazorpayService, RazorpayOrderResponse, RazorpayPaymentResponse } from '../../services/razorpay.service';
import { PaymentData } from '../../interfaces/payment-data';
import { ToastService } from '../../services/toast.service';
import { StudentService } from '../../services/student.service';
import { AuthStateService } from '../../auth/auth-state.service';

declare var Razorpay: any;

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
          // The school has no active payment gateway (or online pricing isn't available): the
          // server refused to create the order. Show its message — it's written for parents.
          const body = error?.error;
          const msg = typeof body === 'string' ? body : (body?.error || body?.message);
          this.toast.warning('Online Payments Unavailable',
            msg || 'Online payment is not available for this school right now. Please contact the school office.');
        } else {
          this.toast.error('Error', 'Could not start the payment. Please try again.');
        }
        this.paymentProcessCompleted.emit();
      }
    });
  }

  verifyPayment(paymentResponse: RazorpayPaymentResponse, orderDetails: RazorpayOrderResponse) {
    this.razorpayService.verifyPayment(paymentResponse, orderDetails).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        if (result.success) {
          this.paymentSuccess.emit(paymentResponse);
        } else if (result.pending) {
          // Money taken, confirmation with Razorpay still in progress: reassure, never "failed",
          // so nobody pays twice. The server settles it automatically once Razorpay confirms.
          this.toast.info('Payment received',
            result.message || 'We\'re confirming your payment with Razorpay. It will show as paid shortly — please don\'t pay again.');
          this.paymentProcessCompleted.emit();
        } else {
          this.toast.error('Verification Failed!', 'Payment could not be verified. Please contact support.');
          this.paymentProcessCompleted.emit();
        }
      },
      error: (err) => {
        this.logger.error('Error during payment verification:', err);
        this.toast.error('Verification Error!', 'An error occurred during payment verification. Please try again or contact support.');
        this.paymentProcessCompleted.emit();
      }
    });
  }
}
