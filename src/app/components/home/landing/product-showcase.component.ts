import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { ShowcaseCarouselComponent } from './showcase-carousel.component';
import { SHOWCASE } from './landing.model';

/**
 * "See Edunexify in action". Category tabs (a swipeable chip row on mobile) above one framed
 * gallery of real screenshots; categories with several screenshots play as a slideshow. Only the
 * active category is rendered, so the other screenshots are not downloaded until they are opened.
 * Screens come from landing.model.ts.
 */
@Component({
  selector: 'app-product-showcase',
  standalone: true,
  imports: [NgFor, ShowcaseCarouselComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="product" aria-labelledby="show-title">
      <div class="head">
        <span class="tag">The product</span>
        <h2 id="show-title">See Edunexify in Action</h2>
        <p class="sub">A look at the screens your staff, parents and students will use every day.</p>
      </div>

      <div class="tabs" role="tablist" aria-label="Product screens">
        <button *ngFor="let s of shots; let i = index" type="button" role="tab" class="tab" [class.on]="i === active"
                [attr.aria-selected]="i === active" [attr.id]="'tab-' + s.id" aria-controls="showcase-panel"
                [attr.tabindex]="i === active ? 0 : -1" (click)="select(i)" (keydown)="onKey($event)">
          {{ s.title }}
        </button>
      </div>

      <div class="track" id="showcase-panel" role="tabpanel" [attr.aria-labelledby]="'tab-' + shots[active].id">
        <app-showcase-carousel [category]="shots[active]" />
        <p class="cap"><strong>{{ shots[active].title }}</strong> — {{ shots[active].caption }}</p>
      </div>
    </section>
  `,
  styleUrls: ['./section.shared.css', './product-showcase.component.css'],
})
export class ProductShowcaseComponent {
  readonly shots = SHOWCASE;
  active = 0;

  select(i: number): void {
    this.active = i;
    // On mobile the tabs scroll sideways; keep the chosen one in view without moving the page.
    queueMicrotask(() => document.getElementById('tab-' + this.shots[i].id)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
  }

  onKey(ev: KeyboardEvent): void {
    const n = this.shots.length;
    if (ev.key === 'ArrowRight') this.select((this.active + 1) % n);
    else if (ev.key === 'ArrowLeft') this.select((this.active - 1 + n) % n);
    else return;
    ev.preventDefault();
    queueMicrotask(() => document.getElementById('tab-' + this.shots[this.active].id)?.focus());
  }
}
