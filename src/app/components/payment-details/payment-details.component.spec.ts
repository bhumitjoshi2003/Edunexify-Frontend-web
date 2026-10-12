import { AcademicSessionService } from '../../services/academic-session.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { PaymentDetailsComponent } from './payment-details.component';
import { PaymentHistoryService } from '../../services/payment-history.service';
import { SchoolService } from '../../services/school.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { PaymentHistoryDetails } from '../../interfaces/payment-response';

/** Receipt parity with web: "Total Charged" and "Amount Paid", fee-head lines, leave charges,
 * late fee, and the convenience fee only when an ONLINE_CONVENIENCE_FEE_V1 payment charged one —
 * for every pricing version, including legacy Platform Fee rows. */
describe('PaymentDetailsComponent', () => {
  let component: PaymentDetailsComponent;
  let fixture: ComponentFixture<PaymentDetailsComponent>;
  let history: jasmine.SpyObj<PaymentHistoryService>;

  function payment(overrides: Partial<PaymentHistoryDetails> = {}): PaymentHistoryDetails {
    return {
      id: 1, studentId: 'S1', studentName: 'Jordan', className: '10', session: '2026-2027',
      month: '0000100000000', amount: 741000, paymentId: 'pay_1', orderId: 'order_1',
      paymentDate: '2026-10-08T06:00:00', status: 'success', busFee: 0, tuitionFee: 0,
      annualCharges: 0, labCharges: 0, ecaProject: 0, examinationFee: 0,
      amountPaid: 741000, additionalCharges: 100, lateFees: 50, platformFee: 0,
      schoolFeePaise: 730000, onlineConvenienceFeePaise: 11000, totalPaidPaise: 741000,
      currency: 'INR', pricingVersion: 'ONLINE_CONVENIENCE_FEE_V1', schoolName: 'Springfield High',
      ...overrides,
    };
  }

  async function load(details: PaymentHistoryDetails) {
    history.getPaymentHistoryDetails.and.returnValue(of(details));
    fixture = TestBed.createComponent(PaymentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    history = jasmine.createSpyObj('PaymentHistoryService', [
      'getPaymentHistoryDetails', 'getPaymentReceiptBreakdown', 'downloadPaymentReceipt',
    ]);
    history.getPaymentReceiptBreakdown.and.returnValue(of({
      lineItemBreakdownAvailable: true,
      lineItems: [
        { feeHeadName: 'Tuition Fee', grossAmount: 6000, discountAmount: 500 },
        { feeHeadName: 'Bus Fee', grossAmount: 1300, discountAmount: 0 },
      ],
    } as any));
    const school = jasmine.createSpyObj('SchoolService', ['getSettings']);
    school.getSettings.and.returnValue(of({ academicYearStartMonth: 4 }));

    await TestBed.configureTestingModule({
      imports: [PaymentDetailsComponent],
      providers: [
        { provide: AcademicSessionService, useValue: { getAllSessions: () => of([{ id: 1, label: '2026-2027', startDate: '2026-10-01' }]) } },
        { provide: ActivatedRoute, useValue: { params: of({ paymentId: 'pay_1' }) } },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: PaymentHistoryService, useValue: history },
        { provide: SchoolService, useValue: school },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error', 'warn', 'info']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error', 'success']) },
      ],
    })
      // The parent/child switcher has its own auth dependencies and is not under test here.
      .overrideComponent(PaymentDetailsComponent, { set: { imports: [CommonModule], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();
  });

  it('shows "Total Charged" and "Amount Paid" (rupees from paise), as on web', async () => {
    const root = await load(payment());
    const total = root.querySelector('.pd-total-row')!.textContent!;
    const paid = root.querySelector('.pd-paid-row')!.textContent!;
    expect(total).toContain('Total Charged');
    expect(total).toContain('₹7,410.00');
    expect(paid).toContain('Amount Paid');
    expect(paid).toContain('₹7,410.00');
    expect(root.textContent).not.toContain('Total Paid');
  });

  it('ONLINE_CONVENIENCE_FEE_V1: fee heads, leave charges, late fee and a non-zero convenience fee', async () => {
    await load(payment());
    expect(component.feeLines()).toEqual([
      { label: 'Tuition Fee', amount: 6000 },
      { label: 'Tuition Fee Discount', amount: -500 },
      { label: 'Bus Fee', amount: 1300 },
      { label: 'Unapplied Leave Charges', amount: 100 },
      { label: 'Late Fee', amount: 50 },
      { label: 'Online Convenience Fee', amount: 110 },
    ]);
  });

  it('ONLINE_CONVENIENCE_FEE_V1 with a zero convenience fee shows no convenience row', async () => {
    await load(payment({ onlineConvenienceFeePaise: 0 }));
    expect(component.feeLines().map(l => l.label)).not.toContain('Online Convenience Fee');
  });

  it('SCHOOL_GATEWAY_V1: no convenience or platform fee row, late fee and leave charges kept', async () => {
    await load(payment({ pricingVersion: 'SCHOOL_GATEWAY_V1', onlineConvenienceFeePaise: 0 }));
    const labels = component.feeLines().map(l => l.label);
    expect(labels).toEqual(['Tuition Fee', 'Tuition Fee Discount', 'Bus Fee', 'Unapplied Leave Charges', 'Late Fee']);
  });

  it('a legacy (null pricingVersion) payment keeps its historical Platform Fee label', async () => {
    await load(payment({ pricingVersion: null, onlineConvenienceFeePaise: 0, platformFee: 25 }));
    const lines = component.feeLines();
    expect(lines[lines.length - 1]).toEqual({ label: 'Platform Fee', amount: 25 });
    expect(lines.map(l => l.label)).not.toContain('Online Convenience Fee');
  });
  it('receipt labels follow the payment session dates', async () => {
    await load(payment({ month: '110000000000' }));
    expect(component.months).toEqual(['October 2026', 'November 2026']);
  });
});
