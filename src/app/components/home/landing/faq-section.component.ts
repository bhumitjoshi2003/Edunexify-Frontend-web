import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { NgFor } from '@angular/common';
import { FAQS } from './landing.model';

@Component({
  selector: 'app-faq-section',
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="faq" aria-labelledby="faq-title">
      <div class="head">
        <span class="tag">FAQ</span>
        <h2 id="faq-title">Questions schools ask us</h2>
        <p class="sub">Straight answers. Anything else? We’ll cover it in your demo.</p>
      </div>
      <div class="list">
        <details *ngFor="let f of faqs" class="item" name="landing-faq">
          <summary>{{ f.q }}</summary>
          <p>{{ f.a }}</p>
        </details>
      </div>
      <p class="more">Still have questions? <button type="button" class="link" (click)="bookDemo.emit()">Book a demo</button> or write to
        <a href="mailto:support@edunexify.co.in">support&#64;edunexify.co.in</a>.</p>
    </section>
  `,
  styleUrls: ['./section.shared.css', './faq-section.component.css'],
})
export class FaqSectionComponent {
  @Output() bookDemo = new EventEmitter<void>();
  readonly faqs = FAQS;
}
