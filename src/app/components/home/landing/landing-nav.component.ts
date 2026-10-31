import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';
import { scrollToSection } from './scroll.util';

@Component({
  selector: 'app-landing-nav',
  standalone: true,
  imports: [NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="nav" [class.scrolled]="scrolled">
      <div class="nav-in">
        <a class="brand" href="#top" (click)="$event.preventDefault(); top()" aria-label="Edunexify home">
          <img src="EdunexifyLogo.png" alt="" width="36" height="36" />
          <span>Edunexify</span>
        </a>

        <nav class="links" aria-label="Primary">
          <a href="#features" (click)="go($event, 'features')">Features</a>
          <a href="#why" (click)="go($event, 'why')">Why Edunexify</a>
          <a href="#pricing" (click)="go($event, 'pricing')">Pricing</a>
          <a href="#faq" (click)="go($event, 'faq')">FAQ</a>
        </nav>

        <div class="actions">
          <ng-container *ngIf="!authenticated; else out">
            <button type="button" class="signin" (click)="signIn.emit()">Sign In</button>
            <button type="button" class="demo" (click)="bookDemo.emit()">Book a Demo</button>
          </ng-container>
          <ng-template #out><button type="button" class="signin" (click)="signOut.emit()">Sign Out</button></ng-template>
          <button type="button" class="burger" [attr.aria-expanded]="open" aria-controls="lp-mobile-menu"
                  [attr.aria-label]="open ? 'Close menu' : 'Open menu'" (click)="toggle()">
            <span class="material-icons" aria-hidden="true">{{ open ? 'close' : 'menu' }}</span>
          </button>
        </div>
      </div>

      <div class="mobile" id="lp-mobile-menu" *ngIf="open">
        <a href="#features" (click)="go($event, 'features')">Features</a>
        <a href="#why" (click)="go($event, 'why')">Why Edunexify</a>
        <a href="#pricing" (click)="go($event, 'pricing')">Pricing</a>
        <a href="#faq" (click)="go($event, 'faq')">FAQ</a>
        <ng-container *ngIf="!authenticated">
          <button type="button" class="m-demo" (click)="open = false; bookDemo.emit()">Book a Demo</button>
          <button type="button" class="m-signin" (click)="open = false; signIn.emit()">Sign In</button>
        </ng-container>
      </div>
    </header>
  `,
  styleUrl: './landing-nav.component.css',
})
export class LandingNavComponent {
  @Input() authenticated = false;
  @Output() bookDemo = new EventEmitter<void>();
  @Output() signIn = new EventEmitter<void>();
  @Output() signOut = new EventEmitter<void>();

  open = false;
  scrolled = false;

  constructor(private cdr: ChangeDetectorRef) {}

  @HostListener('window:scroll')
  onScroll(): void {
    const next = (typeof window !== 'undefined' ? window.scrollY : 0) > 8;
    if (next !== this.scrolled) { this.scrolled = next; this.cdr.markForCheck(); }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.open) { this.open = false; this.cdr.markForCheck(); } }

  toggle(): void { this.open = !this.open; }

  go(event: Event, id: string): void {
    event.preventDefault();
    this.open = false;
    scrollToSection(id);
  }

  top(): void {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}
