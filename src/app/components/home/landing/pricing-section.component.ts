import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { PlanDetail } from '../../../services/school.service';
import { PLAN_BEST_FOR } from './landing.model';

/**
 * Pricing. Prices, student/staff limits, AI availability and the capability lists are all read from
 * the live plan data (getPublicPlans) — nothing about entitlements or money is stated in this file.
 * The price helpers are unchanged from the previous homepage.
 */
@Component({
  selector: 'app-pricing-section',
  standalone: true,
  imports: [NgFor, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="pricing" aria-labelledby="price-title">
      <div class="head">
        <span class="tag">Pricing</span>
        <h2 id="price-title">Plans for Every School</h2>
        <p class="sub">Choose the plan that fits your school. Every plan includes web and Android access.</p>
        <div class="toggle" role="group" aria-label="Billing period">
          <button type="button" [class.on]="billingCycle === 'monthly'" [attr.aria-pressed]="billingCycle === 'monthly'" (click)="setCycle('monthly')">Monthly</button>
          <button type="button" [class.on]="billingCycle === 'annual'" [attr.aria-pressed]="billingCycle === 'annual'" (click)="setCycle('annual')">Annual <em>Save ~17%</em></button>
        </div>
      </div>

      <p class="state" *ngIf="loading" role="status">Loading plans…</p>

      <div class="plans" *ngIf="!loading && plans.length > 0">
        <article *ngFor="let plan of plans" class="plan" [class.pop]="isPopularPlan(plan.tier)">
          <span class="badge" *ngIf="isPopularPlan(plan.tier)">Most Popular</span>
          <h3>{{ plan.name }}</h3>
          <p class="best"><span>Best for</span> {{ bestFor(plan) }}</p>

          <div class="price">
            <ng-container *ngIf="!planIsContactSales(plan); else contact">
              <strong>{{ planPrice(plan) }}</strong><span>{{ planPriceSuffix(plan) }}</span>
            </ng-container>
            <ng-template #contact><strong class="cu">Contact Us</strong></ng-template>
          </div>

          <ul class="limits">
            <li><span class="material-icons" aria-hidden="true">groups</span>{{ planStudentLabel(plan) }}</li>
            <li *ngIf="plan.maxStaff"><span class="material-icons" aria-hidden="true">badge</span>Up to {{ plan.maxStaff.toLocaleString('en-IN') }} staff</li>
            <li [class.off]="!hasAi(plan)"><span class="material-icons" aria-hidden="true">{{ hasAi(plan) ? 'auto_awesome' : 'remove_circle_outline' }}</span>AI Copilot {{ hasAi(plan) ? 'included' : 'not included' }}</li>
          </ul>

          <p class="cap-h">Key capabilities</p>
          <ul class="caps">
            <li *ngFor="let f of keyFeatures(plan)">{{ f }}</li>
            <li class="more" *ngIf="moreCount(plan) > 0">+ {{ moreCount(plan) }} more</li>
          </ul>

          <button type="button" class="btn" [class.btn-primary]="isPopularPlan(plan.tier)" [class.btn-ghost]="!isPopularPlan(plan.tier)" (click)="bookDemo.emit()">
            {{ planIsContactSales(plan) ? 'Contact Sales' : 'Book a Demo' }}
          </button>
        </article>
      </div>

      <details class="compare" *ngIf="!loading && plans.length > 0">
        <summary>Compare all features</summary>
        <div class="tw" tabindex="0" role="region" aria-label="Feature comparison by plan">
          <table>
            <thead><tr><th scope="col">Feature</th><th scope="col" *ngFor="let p of plans">{{ p.name }}</th></tr></thead>
            <tbody>
              <tr *ngFor="let f of masterFeatureList">
                <th scope="row">{{ f.displayName }}</th>
                <td *ngFor="let p of plans"><span *ngIf="planHasFeature(p, f.featureKey); else no" class="yes" aria-label="Included">✓</span><ng-template #no><span class="no" aria-label="Not included">—</span></ng-template></td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <p class="state" *ngIf="!loading && plans.length === 0">
        Unable to load plans right now.
        <button type="button" class="link" (click)="retry.emit()">Try again</button> or
        <button type="button" class="link" (click)="bookDemo.emit()">book a demo</button> and we’ll walk you through pricing.
      </p>
    </section>
  `,
  styleUrls: ['./section.shared.css', './pricing-section.component.css'],
})
export class PricingSectionComponent {
  @Input() set plans(v: PlanDetail[]) { this._plans = v ?? []; this._master = null; }
  get plans(): PlanDetail[] { return this._plans; }
  @Input() loading = false;
  @Output() bookDemo = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();

  billingCycle: 'monthly' | 'annual' = 'monthly';
  private _plans: PlanDetail[] = [];
  private _master: { featureKey: string; displayName: string }[] | null = null;

  setCycle(c: 'monthly' | 'annual'): void { this.billingCycle = c; }

  // ── unchanged from the previous homepage ────────────────────
  isPopularPlan(tier: string): boolean { return tier?.toUpperCase() === 'ACADEMY'; }

  planPrice(plan: PlanDetail): string {
    const paise = this.billingCycle === 'annual' ? plan.annualPricePaise : plan.monthlyPricePaise;
    if (!paise || paise <= 0) return 'Contact Us';
    return '₹' + (paise / 100).toLocaleString('en-IN');
  }
  planPriceSuffix(plan: PlanDetail): string {
    const paise = this.billingCycle === 'annual' ? plan.annualPricePaise : plan.monthlyPricePaise;
    if (!paise || paise <= 0) return '';
    return this.billingCycle === 'annual' ? '/yr' : '/mo';
  }
  planIsContactSales(plan: PlanDetail): boolean {
    const paise = this.billingCycle === 'annual' ? plan.annualPricePaise : plan.monthlyPricePaise;
    return !paise || paise <= 0;
  }
  planStudentLabel(plan: PlanDetail): string {
    return plan.maxStudents ? `Up to ${plan.maxStudents.toLocaleString('en-IN')} students` : 'Unlimited students';
  }
  planHasFeature(plan: PlanDetail, featureKey: string): boolean { return plan.features.some(f => f.featureKey === featureKey); }

  get masterFeatureList(): { featureKey: string; displayName: string }[] {
    if (this._master) return this._master;
    const seen = new Map<string, string>();
    for (const plan of this._plans) for (const f of plan.features) if (!seen.has(f.featureKey)) seen.set(f.featureKey, f.displayName);
    this._master = Array.from(seen.entries()).map(([featureKey, displayName]) => ({ featureKey, displayName })).sort((a, b) => a.displayName.localeCompare(b.displayName));
    return this._master;
  }

  // ── new presentation helpers (data comes from the plan) ─────
  bestFor(plan: PlanDetail): string { return PLAN_BEST_FOR[plan.tier?.toUpperCase()] ?? ''; }
  hasAi(plan: PlanDetail): boolean { return this.planHasFeature(plan, 'AI_COPILOT'); }
  private included(plan: PlanDetail): string[] { return this.masterFeatureList.filter(f => this.planHasFeature(plan, f.featureKey)).map(f => f.displayName); }
  keyFeatures(plan: PlanDetail): string[] { return this.included(plan).slice(0, 6); }
  moreCount(plan: PlanDetail): number { return Math.max(0, this.included(plan).length - 6); }
}
