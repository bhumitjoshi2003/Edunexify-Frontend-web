import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { DeviceFrameComponent } from './device-frame.component';
import { COPILOT_POINTS, COPILOT_SHOT } from './landing.model';

/** Labels taken verbatim from the real Copilot panel (welcome text and suggested prompts). */
const REAL_PROMPTS = ['Review fee reminder batch', 'Review attendance reminder batch', 'What can you help me with?'];

@Component({
  selector: 'app-ai-copilot-section',
  standalone: true,
  imports: [NgFor, NgIf, DeviceFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ai" id="copilot" aria-labelledby="ai-title">
      <div class="in">
        <div class="copy">
          <span class="tag">AI Copilot</span>
          <h2 id="ai-title">Your School, Now With an AI Copilot</h2>
          <p class="sub">A practical assistant inside Edunexify. It helps people find answers and prepare routine follow-ups — and it only ever works within the access their role and school allow.</p>
          <ul>
            <li *ngFor="let p of points"><span class="material-icons" aria-hidden="true">{{ p.icon }}</span>{{ p.text }}</li>
          </ul>
          <button type="button" class="btn" (click)="bookDemo.emit()">See the Copilot in a demo</button>
        </div>

        <div class="visual">
          <app-device-frame *ngIf="shot.src; else panel" [shot]="shot" kind="browser" />
          <ng-template #panel>
            <div class="cp" role="img" aria-label="The Edunexify Copilot panel, with its suggested actions">
              <div class="cp-head">
                <span class="cp-logo"><img src="EdunexifyLogo.png" alt="" width="30" height="30" /></span>
                <div><strong>Edunexify Copilot</strong><small><i></i>Ready to help</small></div>
              </div>
              <div class="cp-body">
                <span class="spark material-icons" aria-hidden="true">auto_awesome</span>
                <p class="hello">Ask me anything about school data or Edunexify features.</p>
                <div class="chips"><span *ngFor="let q of prompts">{{ q }}</span></div>
              </div>
              <div class="cp-input" aria-hidden="true">Ask Edunexify Copilot…</div>
            </div>
          </ng-template>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./section.shared.css', './ai-copilot-section.component.css'],
})
export class AiCopilotSectionComponent {
  @Output() bookDemo = new EventEmitter<void>();
  readonly points = COPILOT_POINTS;
  readonly shot = COPILOT_SHOT;
  readonly prompts = REAL_PROMPTS;
}
