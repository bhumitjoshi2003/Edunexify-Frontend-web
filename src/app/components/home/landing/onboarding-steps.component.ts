import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { STEPS } from './landing.model';

@Component({
  selector: 'app-onboarding-steps',
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="steps" aria-labelledby="steps-title">
      <div class="head">
        <span class="tag">Getting started</span>
        <h2 id="steps-title">Up &amp; Running in 3 Steps</h2>
        <p class="sub">Easy migration and guided setup — so your team is not left to figure it out alone.</p>
      </div>
      <ol class="line">
        <li *ngFor="let s of steps">
          <span class="num" aria-hidden="true">{{ s.n }}</span>
          <div class="card body">
            <span class="ico"><span class="material-icons" aria-hidden="true">{{ s.icon }}</span></span>
            <h3>{{ s.title }}</h3>
            <p>{{ s.text }}</p>
          </div>
        </li>
      </ol>
    </section>
  `,
  styleUrls: ['./section.shared.css', './onboarding-steps.component.css'],
})
export class OnboardingStepsComponent { readonly steps = STEPS; }
