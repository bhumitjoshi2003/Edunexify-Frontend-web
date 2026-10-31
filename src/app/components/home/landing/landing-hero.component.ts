import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { DeviceFrameComponent } from './device-frame.component';
import { HERO_SHOT } from './landing.model';

/** Real module names (the sidebar of the product) — shown when no hero screenshot has been supplied. */
const MODULES = [
  { icon: 'event_available', name: 'Attendance' }, { icon: 'schedule', name: 'Timetable' },
  { icon: 'quiz', name: 'Assessments' }, { icon: 'grade', name: 'Exams & Results' },
  { icon: 'workspace_premium', name: 'Report Cards' }, { icon: 'account_balance_wallet', name: 'Fees' },
  { icon: 'campaign', name: 'Notices' }, { icon: 'family_restroom', name: 'Parent Portal' },
];

@Component({
  selector: 'app-landing-hero',
  standalone: true,
  imports: [NgIf, NgFor, DeviceFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero" id="top" aria-labelledby="hero-title">
      <div class="hero-in">
        <div class="copy">
          <p class="badge"><span class="dot" aria-hidden="true"></span>Built for Indian schools · Web + Android</p>
          <h1 id="hero-title">Run Your Entire School From <span class="accent">One Smart Platform</span></h1>
          <p class="lead">Attendance, academics, fees, communication, exams and parent engagement — connected in one secure platform built for modern schools.</p>
          <div class="cta" *ngIf="!authenticated">
            <button type="button" class="primary" (click)="bookDemo.emit()">
              Book a Free Demo
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            <button type="button" class="secondary" (click)="signIn.emit()">Sign In to Your Portal</button>
          </div>
          <p class="note">A personalised walkthrough, based on your school.</p>
        </div>

        <div class="visual" aria-hidden="false">
          <app-device-frame *ngIf="shot.src; else brand" [shot]="shot" kind="browser" [eager]="true" />
          <ng-template #brand>
            <div class="panel" role="img" aria-label="Edunexify modules: attendance, timetable, assessments, exams, report cards, fees, notices and parent portal">
              <div class="panel-bar" aria-hidden="true"><span></span><span></span><span></span><em>edunexify.co.in</em></div>
              <div class="panel-body">
                <aside aria-hidden="true">
                  <img src="EdunexifyLogo.png" alt="" width="40" height="40" />
                  <i></i><i></i><i></i><i></i><i></i>
                </aside>
                <div class="panel-main">
                  <p class="panel-title">One school, connected</p>
                  <ul>
                    <li *ngFor="let m of modules"><span class="material-icons" aria-hidden="true">{{ m.icon }}</span>{{ m.name }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </ng-template>
        </div>
      </div>
    </section>
  `,
  styleUrl: './landing-hero.component.css',
})
export class LandingHeroComponent {
  @Input() authenticated = false;
  @Output() bookDemo = new EventEmitter<void>();
  @Output() signIn = new EventEmitter<void>();
  readonly shot = HERO_SHOT;
  readonly modules = MODULES;
}
