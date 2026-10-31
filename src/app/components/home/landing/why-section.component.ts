import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { WHY } from './landing.model';

@Component({
  selector: 'app-why-section',
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="why" aria-labelledby="why-title">
      <div class="head">
        <span class="tag">Why Edunexify</span>
        <h2 id="why-title">Why Schools Choose Edunexify</h2>
        <p class="sub">Practical reasons, not buzzwords.</p>
      </div>
      <ul class="grid">
        <li *ngFor="let w of points" class="card why">
          <span class="ico"><span class="material-icons" aria-hidden="true">{{ w.icon }}</span></span>
          <div><h3>{{ w.title }}</h3><p>{{ w.text }}</p></div>
        </li>
      </ul>
    </section>
  `,
  styleUrls: ['./section.shared.css', './why-section.component.css'],
})
export class WhySectionComponent { readonly points = WHY; }
