import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { DeviceFrameComponent } from './device-frame.component';
import { SHOWCASE } from './landing.model';

/**
 * "See Edunexify in action". Desktop: tabs + one framed screen. Mobile: the same frames become a
 * swipeable scroll-snap row (CSS only — one DOM). Screens come from landing.model.ts; until a real
 * screenshot is supplied a slot shows a clearly-labelled placeholder.
 */
@Component({
  selector: 'app-product-showcase',
  standalone: true,
  imports: [NgFor, DeviceFrameComponent],
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
                [attr.aria-selected]="i === active" [attr.id]="'tab-' + s.id" [attr.aria-controls]="'panel-' + s.id"
                [attr.tabindex]="i === active ? 0 : -1" (click)="active = i" (keydown)="onKey($event)">
          {{ s.title }}
        </button>
      </div>

      <div class="track">
        <div *ngFor="let s of shots; let i = index" class="slide" [class.on]="i === active" role="tabpanel"
             [attr.id]="'panel-' + s.id" [attr.aria-labelledby]="'tab-' + s.id">
          <app-device-frame [shot]="s" kind="browser" />
          <p class="cap"><strong>{{ s.title }}</strong> — {{ s.caption }}</p>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./section.shared.css', './product-showcase.component.css'],
})
export class ProductShowcaseComponent {
  readonly shots = SHOWCASE;
  active = 0;

  onKey(ev: KeyboardEvent): void {
    const n = this.shots.length;
    if (ev.key === 'ArrowRight') this.active = (this.active + 1) % n;
    else if (ev.key === 'ArrowLeft') this.active = (this.active - 1 + n) % n;
    else return;
    ev.preventDefault();
    queueMicrotask(() => document.getElementById('tab-' + this.shots[this.active].id)?.focus());
  }
}
