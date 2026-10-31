import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';
import { LandingShot } from './landing.model';

/**
 * Browser or phone frame around a product screenshot. Shows the real image when `shot.src` is set
 * (lazy-loaded below the fold) and an honest, clearly-labelled placeholder otherwise — never a
 * fabricated screen.
 */
@Component({
  selector: 'app-device-frame',
  standalone: true,
  imports: [NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="df" [class.df-phone]="kind === 'phone'" [class.df-browser]="kind === 'browser'">
      <div class="df-bar" *ngIf="kind === 'browser'" aria-hidden="true">
        <span></span><span></span><span></span><em>edunexify.co.in</em>
      </div>
      <div class="df-notch" *ngIf="kind === 'phone'" aria-hidden="true"></div>
      <div class="df-screen">
        <img *ngIf="shot.src; else placeholder" [src]="shot.src" [alt]="shot.alt"
             [attr.loading]="eager ? 'eager' : 'lazy'" decoding="async" />
        <ng-template #placeholder>
          <div class="df-ph" role="img" [attr.aria-label]="shot.title + ' — preview coming soon'">
            <div class="df-ph-skel" aria-hidden="true">
              <span class="s1"></span><span class="s2"></span><span class="s3"></span><span class="s4"></span>
            </div>
            <p>{{ shot.title }}</p>
            <small>Product preview coming soon</small>
          </div>
        </ng-template>
      </div>
    </figure>
  `,
  styles: [`
    :host { display: block; }
    .df { margin: 0; border-radius: 16px; background: #fff; border: 1px solid rgba(15, 23, 42, .1);
      box-shadow: 0 30px 60px -20px rgba(15, 23, 42, .28), 0 12px 24px -12px rgba(15, 23, 42, .18); overflow: hidden; }
    .df-bar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
    .df-bar span { width: 10px; height: 10px; border-radius: 50%; background: #cbd5e1; }
    .df-bar span:nth-child(1) { background: #fca5a5; } .df-bar span:nth-child(2) { background: #fcd34d; } .df-bar span:nth-child(3) { background: #86efac; }
    .df-bar em { margin-left: 10px; flex: 1; max-width: 260px; font: 500 .72rem/1 Inter, system-ui, sans-serif; font-style: normal;
      color: #64748b; background: #fff; border: 1px solid #e2e8f0; border-radius: 999px; padding: 6px 12px; }
    .df-screen { position: relative; aspect-ratio: 16 / 10; background: #f8fafc; }
    .df-screen img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
    .df-phone { width: min(100%, 270px); margin-inline: auto; border-radius: 38px; padding: 10px; background: #0f172a; border: 0;
      box-shadow: 0 30px 60px -20px rgba(15, 23, 42, .45), inset 0 0 0 2px #1e293b; position: relative; }
    .df-phone .df-screen { aspect-ratio: 9 / 19; border-radius: 28px; overflow: hidden; }
    .df-notch { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); width: 72px; height: 18px; border-radius: 12px; background: #0f172a; z-index: 2; }
    .df-ph { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 20px; text-align: center;
      background: linear-gradient(160deg, #f8fafc, #eef4f8); }
    .df-ph-skel { width: min(82%, 360px); display: grid; grid-template-columns: 1fr 2fr; gap: 8px; margin-bottom: 14px; opacity: .7; }
    .df-ph-skel span { display: block; border-radius: 8px; background: #e2e8f0; }
    .df-ph-skel .s1 { grid-row: span 3; height: 100px; background: #dbe7f0; } .df-ph-skel .s2 { height: 26px; background: #cfe9e9; }
    .df-ph-skel .s3 { height: 26px; } .df-ph-skel .s4 { height: 26px; }
    .df-ph p { margin: 0; font: 700 .95rem/1.3 Inter, system-ui, sans-serif; color: #1e3a5f; }
    .df-ph small { font: 500 .75rem/1.3 Inter, system-ui, sans-serif; color: #64748b; }
    .df-phone .df-ph-skel { grid-template-columns: 1fr; width: 80%; } .df-phone .df-ph-skel .s1 { grid-row: auto; height: 64px; }
  `],
})
export class DeviceFrameComponent {
  @Input({ required: true }) shot!: LandingShot;
  @Input() kind: 'browser' | 'phone' = 'browser';
  @Input() eager = false;
}
