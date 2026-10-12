import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonthBreakdownDetails } from './fees.component';
import { InrPipe } from '../../pipes/inr.pipe';

/** Rupees, straight from the backend checkout quote for the CURRENT selection — never re-priced here. */
export interface SelectionQuoteSummary {
  monthNames: string[];
  /** School fee for the selection, without late fee or leave charges. */
  schoolFee: number;
  lateFee: number;
  leaveCharges: number;
  convenienceFee: number;
  total: number;
}

@Component({
  selector: 'app-fee-breakdown',
  standalone: true,
  imports: [CommonModule, InrPipe],
  templateUrl: './fee-breakdown.component.html',
  styleUrl: './fee-breakdown.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeeBreakdownComponent {
  @Input() details: MonthBreakdownDetails | null = null;
  /** Rupees — the parent-facing Online Convenience Fee total (gateway recovery + Edunexify
   * transaction fee combined). Never shown as "Platform Fee" for a modern payment. */
  @Input() convenienceFeeAmount: number = 0;
  @Input() selectedMonthCount: number = 0;
  /** The quote for the whole current selection; null until it has arrived. */
  @Input() quote: SelectionQuoteSummary | null = null;

  get multiMonth(): boolean {
    return this.selectedMonthCount > 1;
  }
}
