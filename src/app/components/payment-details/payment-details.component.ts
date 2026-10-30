import { AcademicSessionService } from '../../services/academic-session.service';
import { AcademicSession } from '../../interfaces/academic-session';
import { feeMonthLabel } from '../../utils/fee-session.util';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentHistoryService } from '../../services/payment-history.service';
import { PaymentHistoryDetails } from '../../interfaces/payment-response';
import { CommonModule } from '@angular/common';
import saveAs from 'file-saver';
import { Subject, take, takeUntil, catchError, of } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';
import { FeesCalculationService } from '../../services/fees-calculation.service';
import { ParentChildContextComponent } from '../parent-child-context/parent-child-context.component';
import { ChildAccess } from '../../interfaces/parent-portal';

export interface ReceiptFeeLine {
  name: string;
  amount: number;
}

@Component({
  selector: 'app-payment-details',
  templateUrl: './payment-details.component.html',
  imports: [CommonModule, ParentChildContextComponent],
  styleUrls: ['./payment-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private request$ = new Subject<void>();
  sessions: AcademicSession[] = [];
  paymentId: string = '';
  paymentDetails: PaymentHistoryDetails | null = null;
  loading: boolean = true;
  isGeneratingPdf: boolean = false;
  error: string = '';
  months: string[] = [];
  /** Built from the backend's authoritative per-fee-head payment breakdown — never from the
   * deprecated fixed buckets (tuitionFee/annualCharges/labCharges/ecaProject/examinationFee)
   * on PaymentHistoryDetails, which are display-legacy only now. */
  feeLineItems: ReceiptFeeLine[] = [];
  breakdownUnavailable: boolean = false;
  /** Android shares the receipt through the Capacitor Share plugin, which has no meaning in a
   * browser. The web equivalent is the Web Share API, with a clipboard copy as the fallback;
   * when the browser offers neither (older desktop browsers, insecure contexts) the Share
   * button is hidden rather than shown as a dead control. */
  canShare: boolean = false;
  private useWebShare: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentHistoryService: PaymentHistoryService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private schoolService: SchoolService,
    private feesCalc: FeesCalculationService,
    private sessionsApi: AcademicSessionService,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.useWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    this.canShare = this.useWebShare ||
      (typeof navigator !== 'undefined' && !!navigator.clipboard && typeof navigator.clipboard.writeText === 'function');

    this.sessionsApi.getAllSessions().pipe(take(1), takeUntil(this.destroy$)).subscribe({
      next: sessions => { this.sessions = sessions; this.getMonths(); this.cdr.markForCheck(); },
      error: e => this.logger.error('Session dates unavailable', e),
    });
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.paymentId = params['paymentId'];
      this.fetchPaymentDetails();
    });
  }

  fetchPaymentDetails(): void {
    this.request$.next();
    this.paymentDetails = null;
    this.months = [];
    this.feeLineItems = [];
    this.loading = true;
    this.error = '';

    this.paymentHistoryService.getPaymentHistoryDetails(this.paymentId).pipe(takeUntil(this.request$), takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.paymentDetails = data;
        this.loading = false;
        this.getMonths();
        this.cdr.markForCheck();
        this.fetchFeeBreakdown();
      },
      error: (err) => {
        this.error = 'Failed to fetch payment details.';
        this.logger.error('Error fetching payment details:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /** Builds feeLineItems from the backend's authoritative per-fee-head payment breakdown.
   * Never fabricates a breakdown: falls back to a single trusted-total row when line items
   * aren't available for every covered month, or to nothing (breakdownUnavailable=true, no
   * invented rows) when even the total can't be resolved — see PaymentLineItemBreakdown's
   * javadoc for the exact contract this mirrors. */
  private fetchFeeBreakdown(): void {
    this.paymentHistoryService.getPaymentReceiptBreakdown(this.paymentId)
      .pipe(
        takeUntil(this.request$),
        takeUntil(this.destroy$),
        catchError((error) => {
          this.logger.error('Error fetching payment fee breakdown:', error);
          return of(null);
        })
      )
      .subscribe((breakdown) => {
        if (breakdown?.lineItemBreakdownAvailable) {
          const lines: ReceiptFeeLine[] = [];
          for (const li of breakdown.lineItems) {
            lines.push({ name: li.feeHeadName, amount: li.grossAmount });
            if (li.discountAmount) {
              lines.push({ name: `${li.feeHeadName} Discount`, amount: -li.discountAmount });
            }
          }
          this.feeLineItems = lines;
          this.breakdownUnavailable = false;
        } else if (breakdown?.totalSchoolFeeDue != null) {
          this.feeLineItems = [{ name: 'School Fee (breakdown unavailable)', amount: breakdown.totalSchoolFeeDue }];
          this.breakdownUnavailable = true;
        } else {
          this.feeLineItems = [];
          this.breakdownUnavailable = true;
        }
        this.cdr.markForCheck();
      });
  }

  /** Bit i is academic ordinal i+1, labeled from the payment's own session dates. */
  getMonths(): void {
    if (this.paymentDetails && this.paymentDetails.month) {
      const monthString = this.paymentDetails.month;
      this.months = [];
      for (let i = 0; i < monthString.length; i++) {
        if (monthString[i] === '1') {
          this.months.push(feeMonthLabel(this.sessions.find(s => s.label === this.paymentDetails?.session)?.startDate, i + 1));
        }
      }
    } else {
      this.months = [];
    }
  }

  /** ₹, from the backend's authoritative per-fee-head breakdown (feeLineItems) plus the two
   * remaining live-computed charges (late fee, platform fee) — never the deprecated fixed
   * buckets (tuitionFee/busFee/annualCharges/labCharges/ecaProject/examinationFee) on
   * PaymentHistoryDetails, which no longer reflect the real fee-head composition. */
  feeLines(): { label: string; amount: number }[] {
    if (!this.paymentDetails) return [];
    const d = this.paymentDetails;
    const lines: { label: string; amount: number }[] = this.feeLineItems.map(li => ({ label: li.name, amount: li.amount }));
    if (d.additionalCharges > 0) lines.push({ label: 'Unapplied Leave Charges', amount: d.additionalCharges });
    if (d.lateFees > 0) lines.push({ label: 'Late Fee', amount: d.lateFees });
    // Modern (ONLINE_CONVENIENCE_FEE_V1) payments never populate platformFee — show the
    // Online Convenience Fee instead. A legacy pre-refactor row keeps its historical Platform
    // Fee label; never falsify history by relabeling it.
    if (d.pricingVersion === 'ONLINE_CONVENIENCE_FEE_V1' && d.onlineConvenienceFeePaise > 0) {
      lines.push({ label: 'Online Convenience Fee', amount: d.onlineConvenienceFeePaise / 100 });
    } else if (d.platformFee > 0) {
      lines.push({ label: 'Platform Fee', amount: d.platformFee });
    }
    return lines;
  }

  /** Payment.amount/amountPaid are paise-native on the backend (matching Razorpay's own
   * convention) — see PaymentHistoryDetails' own doc comment. Every other field on the
   * receipt (feeLineItems, lateFees, platformFee, additionalCharges) is already a plain
   * rupee figure and must not be divided again. */
  totalChargedRupees(): number {
    return this.paymentDetails ? this.paymentDetails.amount / 100 : 0;
  }

  amountPaidRupees(): number {
    return this.paymentDetails ? this.paymentDetails.amountPaid / 100 : 0;
  }

  /** Fetches the backend's own canonical receipt PDF — the same document the office treats as
   * the official record — and saves it via file-saver. Never re-renders the receipt
   * client-side, so this can never drift from what the school considers authoritative. */
  downloadReceipt(paymentId: string): void {
    if (this.isGeneratingPdf) return;
    this.isGeneratingPdf = true;
    this.error = '';
    this.paymentHistoryService.downloadPaymentReceipt(paymentId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: Blob) => {
        const filename = `receipt_${paymentId}.pdf`;
        saveAs(data, filename);
        this.isGeneratingPdf = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = 'Failed to download receipt.';
        this.logger.error('Download error:', err);
        this.isGeneratingPdf = false;
        this.cdr.markForCheck();
      },
    });
  }

  /** Web counterpart of Android's native share sheet: the Web Share API where the browser has
   * it, otherwise a clipboard copy of the same receipt summary text. */
  async shareReceipt(): Promise<void> {
    if (!this.paymentDetails) return;
    const d = this.paymentDetails;
    const lines = this.feeLines().map(l => `  ${l.label}: ₹${l.amount.toFixed(2)}`).join('\n')
      || (this.breakdownUnavailable ? '  Detailed breakdown unavailable' : '');
    const text = `🏫 ${d.schoolName || 'School'} — Fee Receipt\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Student : ${d.studentName} (${d.studentId})\n` +
      `Class   : ${d.className}\n` +
      `Session : ${d.session}\n` +
      `Months  : ${this.months.join(', ') || '—'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${lines}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Total Paid : ₹${this.amountPaidRupees().toFixed(2)}\n` +
      `Date       : ${new Date(d.paymentDate).toLocaleString('en-IN')}\n` +
      `Payment ID : ${d.paymentId}\n` +
      `Status     : ${d.status.toUpperCase()}`;

    try {
      if (this.useWebShare) {
        await navigator.share({ title: 'Fee Receipt', text });
      } else {
        await navigator.clipboard.writeText(text);
        this.toast.success('Copied', 'Receipt details copied to clipboard.');
      }
    } catch (e: any) {
      // A user dismissing the share sheet rejects with AbortError — not an error worth showing.
      if (e?.name !== 'AbortError') {
        this.toast.error('Error', this.useWebShare ? 'Could not open the share sheet.' : 'Could not copy the receipt details.');
        this.logger.error('Receipt share error:', e);
      }
    }
  }

  /** This page shows one specific payment record — there's nothing to "switch" it to for a
   *  different child, so picking another child here takes the parent to that child's payment
   *  history list instead, which is the sensible destination. */
  onChildTabSelected(child: ChildAccess): void {
    this.router.navigate(['/dashboard/payment-history', child.studentId]);
  }
}
