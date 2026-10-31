import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-final-cta',
  standalone: true,
  imports: [NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cta" aria-labelledby="cta-title">
      <div class="in">
        <h2 id="cta-title">See How Edunexify Can Work for Your School</h2>
        <p>Book a personalized walkthrough based on your school size, classes and operational needs.</p>
        <div class="btns">
          <button type="button" class="primary" (click)="bookDemo.emit()">Book Your Free Demo</button>
          <button type="button" class="ghost" *ngIf="!authenticated" (click)="signIn.emit()">Sign In</button>
        </div>
      </div>
    </section>
  `,
  styleUrl: './final-cta.component.css',
})
export class FinalCtaComponent {
  @Input() authenticated = false;
  @Output() bookDemo = new EventEmitter<void>();
  @Output() signIn = new EventEmitter<void>();
}
