import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { TESTIMONIALS } from './landing.model';

/**
 * Social proof. Real testimonials render automatically once TESTIMONIALS (landing.model.ts) is filled
 * in — each with school logo, name, role and quote. Until then this is an honest "built around real
 * school workflows" section: no invented quotes, customers or numbers.
 */
@Component({
  selector: 'app-proof-section',
  standalone: true,
  imports: [NgFor, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="proof" aria-labelledby="proof-title">
      <ng-container *ngIf="quotes.length; else honest">
        <div class="head"><span class="tag">Trusted by schools</span><h2 id="proof-title">What schools say</h2></div>
        <div class="quotes">
          <figure *ngFor="let q of quotes" class="card q">
            <blockquote>“{{ q.quote }}”</blockquote>
            <figcaption>
              <img *ngIf="q.logoSrc" [src]="q.logoSrc" [alt]="q.school + ' logo'" loading="lazy" width="40" height="40" />
              <div><strong>{{ q.name }}</strong><span>{{ q.role }}, {{ q.school }}</span></div>
            </figcaption>
          </figure>
        </div>
      </ng-container>

      <ng-template #honest>
        <div class="honest card">
          <div class="txt">
            <span class="tag">Built for schools</span>
            <h2 id="proof-title">Built Around Real School Workflows</h2>
            <p class="sub">Edunexify is shaped by the practical work of school offices, classrooms and families — marking attendance, entering marks, tracking fees and keeping parents informed — not by a generic business template.</p>
            <button type="button" class="btn btn-primary" (click)="bookDemo.emit()">See it with your own workflow</button>
          </div>
          <ul>
            <li><span class="material-icons" aria-hidden="true">edit_calendar</span><div><strong>Day-to-day first</strong><span>Daily tasks like attendance and notices are built to be quick.</span></div></li>
            <li><span class="material-icons" aria-hidden="true">sync</span><div><strong>Records that connect</strong><span>Attendance, results and fees live in one connected system.</span></div></li>
            <li><span class="material-icons" aria-hidden="true">support_agent</span><div><strong>Guided by people</strong><span>A walkthrough and guided onboarding, not just a login.</span></div></li>
          </ul>
        </div>
      </ng-template>
    </section>
  `,
  styleUrls: ['./section.shared.css', './proof-section.component.css'],
})
export class ProofSectionComponent {
  @Output() bookDemo = new EventEmitter<void>();
  readonly quotes = TESTIMONIALS;
}
