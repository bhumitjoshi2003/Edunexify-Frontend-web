import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';
import { scrollToSection } from './scroll.util';

/**
 * Footer with only what exists today: product anchors, the support address the product already uses,
 * and sign-in. Privacy Policy / Terms are intentionally absent until those pages exist — see the PR.
 */
@Component({
  selector: 'app-landing-footer',
  standalone: true,
  imports: [NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="ft">
      <div class="in">
        <div class="brand-col">
          <div class="brand"><img src="EdunexifyLogo.png" alt="" width="36" height="36" /><span>Edunexify</span></div>
          <p>A school management platform for attendance, academics, fees and communication — on the web and on Android.</p>
        </div>
        <nav aria-label="Product">
          <h3>Product</h3>
          <a href="#features" (click)="go($event, 'features')">Features</a>
          <a href="#pricing" (click)="go($event, 'pricing')">Pricing</a>
          <button type="button" (click)="bookDemo.emit()">Book a Demo</button>
        </nav>
        <nav aria-label="Support">
          <h3>Support</h3>
          <a href="mailto:support&#64;edunexify.co.in">Contact us</a>
          <a href="mailto:support&#64;edunexify.co.in">Support</a>
          <button type="button" *ngIf="!authenticated" (click)="signIn.emit()">Sign In</button>
        </nav>
        <div class="contact">
          <h3>Contact</h3>
          <a href="mailto:support&#64;edunexify.co.in">support&#64;edunexify.co.in</a>
        </div>
      </div>
      <div class="bar"><p>© {{ year }} Edunexify. All rights reserved.</p></div>
    </footer>
  `,
  styleUrl: './landing-footer.component.css',
})
export class LandingFooterComponent {
  @Input() authenticated = false;
  @Output() bookDemo = new EventEmitter<void>();
  @Output() signIn = new EventEmitter<void>();
  readonly year = new Date().getFullYear();

  go(ev: Event, id: string): void { ev.preventDefault(); scrollToSection(id); }
}
