import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { TRUST } from './landing.model';

/** Credibility strip: honest, checkable product facts only — no customer counts or claims. */
@Component({
  selector: 'app-landing-trust',
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="trust" aria-label="Why schools can rely on Edunexify">
      <ul>
        <li *ngFor="let t of items">
          <span class="ic material-icons" aria-hidden="true">{{ t.icon }}</span>
          <div><strong>{{ t.title }}</strong><span>{{ t.text }}</span></div>
        </li>
      </ul>
    </section>
  `,
  styles: [`
    :host { display: block; background: #fff; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    ul { max-width: 1200px; margin: 0 auto; padding: 28px 24px; list-style: none; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 24px; }
    li { display: flex; gap: 12px; align-items: flex-start; }
    .ic { flex: none; width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: #e8f6f6; color: #0f766e; font-size: 22px; }
    strong { display: block; font: 700 .95rem/1.3 Inter, system-ui, sans-serif; color: #0f172a; }
    li div span { display: block; margin-top: 3px; font: 400 .85rem/1.45 Inter, system-ui, sans-serif; color: #475569; }
    @media (max-width: 1020px) { ul { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 680px) { ul { grid-template-columns: 1fr 1fr; padding: 22px 16px; gap: 18px 14px; } li { flex-direction: column; gap: 8px; } }
    @media (max-width: 400px) { ul { grid-template-columns: 1fr; } li { flex-direction: row; } }
  `],
})
export class LandingTrustComponent { readonly items = TRUST; }
