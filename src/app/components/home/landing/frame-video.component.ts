import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild, inject,
} from '@angular/core';
import { NgIf } from '@angular/common';
import { LandingVideo } from './landing.model';

/**
 * A silent screen recording that fills a device frame's screen. It loops while at least
 * {@link FrameVideoComponent.VISIBLE_RATIO} of it is on screen and the tab is visible, and pauses
 * otherwise. With reduced motion it never plays and its first frame (the poster) stays on screen.
 * No native controls, so it reads as part of the mockup; a small pause/play button in the corner lets
 * anyone stop the motion (WCAG 2.2.2), and the caption below it carries the meaning.
 */
@Component({
  selector: 'app-frame-video',
  standalone: true,
  imports: [NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <video #player [src]="video.src" [poster]="video.poster" [attr.width]="video.width" [attr.height]="video.height"
           muted loop playsinline preload="metadata" disablepictureinpicture disableremoteplayback
           role="img" [attr.aria-label]="video.label"></video>
    <button *ngIf="!reducedMotion" type="button" class="toggle" (click)="togglePause()"
            [attr.aria-label]="userPaused ? 'Play video' : 'Pause video'">
      <span class="material-icons" aria-hidden="true">{{ userPaused ? 'play_arrow' : 'pause' }}</span>
    </button>
  `,
  styles: [`
    :host { position: relative; display: block; width: 100%; height: 100%; }
    video { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top center; background: #fff; }
    /* Bottom-left, clear of the recordings' own floating buttons; readable on dark and light screens. */
    .toggle { position: absolute; left: 10px; bottom: 10px; z-index: 1; display: grid; place-items: center; width: 28px; height: 28px;
      padding: 0; border: 1px solid rgba(255, 255, 255, .7); border-radius: 50%; background: rgba(15, 23, 42, .55); color: #fff;
      cursor: pointer; opacity: .75; transition: opacity .15s, background .15s; }
    .toggle:hover, .toggle:focus-visible { opacity: 1; background: rgba(15, 23, 42, .75); }
    .toggle:focus-visible { outline: 3px solid #4fbdbd; outline-offset: 2px; }
    .toggle .material-icons { font-size: 18px; }
  `],
})
export class FrameVideoComponent implements AfterViewInit, OnDestroy {
  /** Share of the recording that must be on screen before it plays. */
  static readonly VISIBLE_RATIO = 0.35;

  @Input({ required: true }) video!: LandingVideo;
  @ViewChild('player', { static: true }) private player!: ElementRef<HTMLVideoElement>;

  readonly reducedMotion = this.prefersReducedMotion();
  /** Set by the pause button; scrolling back into view does not override it. */
  userPaused = false;
  private onScreen = false;
  private observer?: IntersectionObserver;
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly onVisibilityChange = () => this.update();

  ngAfterViewInit(): void {
    // The `muted` attribute alone does not mute an element created by script, and browsers only
    // autoplay muted video.
    this.player.nativeElement.muted = true;
    if (this.reducedMotion) return;
    // Play/pause never changes the template, so none of this needs change detection.
    this.zone.runOutsideAngular(() => {
      this.observeVisibility();
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Whether the recording should be playing right now. */
  get shouldPlay(): boolean {
    return !this.reducedMotion && !this.userPaused && this.onScreen && !document.hidden;
  }

  /** Pause keeps the current frame; play continues from it. */
  togglePause(): void {
    this.userPaused = !this.userPaused;
    this.update();
  }

  protected setOnScreen(onScreen: boolean): void {
    this.onScreen = onScreen;
    this.update();
  }

  private update(): void {
    const el = this.player.nativeElement;
    if (this.shouldPlay) {
      // Rejected when the browser refuses autoplay (e.g. battery saver); the poster then stays.
      if (el.paused) el.play()?.catch(() => undefined);
    } else if (!el.paused) {
      el.pause();
    }
  }

  protected observeVisibility(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.setOnScreen(true);
      return;
    }
    this.observer = new IntersectionObserver(
      ([entry]) => this.setOnScreen(entry.isIntersecting && entry.intersectionRatio >= FrameVideoComponent.VISIBLE_RATIO),
      { threshold: [0, FrameVideoComponent.VISIBLE_RATIO] },
    );
    this.observer.observe(this.host.nativeElement);
  }

  protected prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
