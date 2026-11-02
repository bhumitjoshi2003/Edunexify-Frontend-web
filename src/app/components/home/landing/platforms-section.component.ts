import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceFrameComponent } from './device-frame.component';
import { FrameVideoComponent } from './frame-video.component';
import { ANDROID_VIDEO, LandingVideo, WEB_VIDEO } from './landing.model';

/**
 * Web + Android, each shown as a real screen recording looping inside its device frame. No store
 * claims: it is described as a web and Android experience.
 */
@Component({
  selector: 'app-platforms-section',
  standalone: true,
  imports: [DeviceFrameComponent, FrameVideoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="platforms" aria-labelledby="plat-title">
      <div class="head">
        <span class="tag">Web + Android</span>
        <h2 id="plat-title">One school, on every screen</h2>
        <p class="sub">Admins, teachers, parents and students stay connected from anywhere — in the browser or on their phone.</p>
      </div>
      <div class="stage">
        <div class="web">
          <app-device-frame kind="browser" [screenRatio]="ratio(web)"><app-frame-video [video]="web" /></app-device-frame>
          <p>Full dashboards for staff, in any modern browser.</p>
        </div>
        <div class="phone">
          <app-device-frame kind="phone" screenRatio="auto"><app-frame-video [video]="android" /></app-device-frame>
          <p>The Android experience, with push notifications for notices and updates.</p>
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./section.shared.css', './platforms-section.component.css'],
})
export class PlatformsSectionComponent {
  readonly web = WEB_VIDEO;
  readonly android = ANDROID_VIDEO;

  /**
   * The browser screen takes the recording's own shape, so it is neither stretched nor cropped. The
   * phone screen is sized by its content instead: the recording plus a status-bar strip for the notch.
   */
  ratio(v: LandingVideo): string {
    return `${v.width} / ${v.height}`;
  }
}
