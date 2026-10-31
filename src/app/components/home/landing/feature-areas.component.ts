import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { FEATURE_AREAS } from './landing.model';

/** Capabilities grouped into six product areas, each with a benefit sentence — not a wall of cards. */
@Component({
  selector: 'app-feature-areas',
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="features" aria-labelledby="feat-title">
      <div class="head">
        <span class="tag">Core features</span>
        <h2 id="feat-title">Everything your school runs on, in one place</h2>
        <p class="sub">Six connected product areas, designed around how schools actually work.</p>
      </div>
      <div class="grid">
        <article *ngFor="let a of areas" class="card area" [attr.data-accent]="a.accent">
          <span class="ico"><span class="material-icons" aria-hidden="true">{{ a.icon }}</span></span>
          <h3>{{ a.title }}</h3>
          <p class="benefit">{{ a.benefit }}</p>
          <ul><li *ngFor="let p of a.points">{{ p }}</li></ul>
        </article>
      </div>
    </section>
  `,
  styleUrls: ['./section.shared.css', './feature-areas.component.css'],
})
export class FeatureAreasComponent { readonly areas = FEATURE_AREAS; }
