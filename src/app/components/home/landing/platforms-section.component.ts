import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceFrameComponent } from './device-frame.component';
import { ANDROID_SHOT, WEB_SHOT } from './landing.model';

/** Web + Android. No store claims: it is described as a web and Android experience. */
@Component({
  selector: 'app-platforms-section',
  standalone: true,
  imports: [DeviceFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="platforms" aria-labelledby="plat-title">
      <div class="head">
        <span class="tag">Web + Android</span>
        <h2 id="plat-title">One school, on every screen</h2>
        <p class="sub">Admins, teachers, parents and students stay connected from anywhere — in the browser or on their phone.</p>
      </div>
      <div class="stage">
        <div class="web"><app-device-frame [shot]="web" kind="browser" /><p>Full dashboards for staff, in any modern browser.</p></div>
        <div class="phone"><app-device-frame [shot]="android" kind="phone" /><p>The Android experience, with push notifications for notices and updates.</p></div>
      </div>
    </section>
  `,
  styleUrls: ['./section.shared.css', './platforms-section.component.css'],
})
export class PlatformsSectionComponent {
  readonly web = WEB_SHOT;
  readonly android = ANDROID_SHOT;
}
