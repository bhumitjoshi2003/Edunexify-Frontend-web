import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy,
  SimpleChanges, inject,
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { DeviceFrameComponent } from './device-frame.component';
import { ShowcaseCategory } from './landing.model';

/**
 * The screenshots of one showcase category inside the browser frame. With two or more screenshots it
 * crossfades between them every {@link ShowcaseCarouselComponent.INTERVAL_MS} ms (looping), with
 * arrows, dots, a pause button and touch swipe; autoplay waits while the mouse rests on it or a
 * control has keyboard focus (until a control is used), while it is off-screen, and never runs with
 * reduced motion. A single screenshot is
 * shown on its own with no controls. Changing `category` starts again from its first screenshot.
 */
@Component({
  selector: 'app-showcase-carousel',
  standalone: true,
  imports: [NgFor, NgIf, DeviceFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="car" role="group" [attr.aria-roledescription]="multi ? 'carousel' : null"
         [attr.aria-label]="category.title + (multi ? ' screenshots' : ' screenshot')"
         (pointerenter)="onPointerEnter($event)" (pointerleave)="onPointerLeave($event)"
         (focusin)="onFocusIn($event)" (focusout)="onFocusOut($event)">
      <div class="stage">
        <app-device-frame kind="browser">
          <div class="view" [class.swipe]="multi" [attr.aria-live]="multi ? (playing ? 'off' : 'polite') : null"
               (pointerdown)="onSwipeStart($event)" (pointerup)="onSwipeEnd($event)" (pointercancel)="swipe = null">
            <div *ngFor="let s of category.slides; let i = index" class="slide" [class.on]="i === index"
                 [attr.role]="multi ? 'group' : null" [attr.aria-roledescription]="multi ? 'slide' : null"
                 [attr.aria-label]="multi ? (i + 1) + ' of ' + category.slides.length : null"
                 [attr.aria-hidden]="i === index ? null : 'true'" [attr.inert]="i === index ? null : ''">
              <img [src]="s.src" [attr.srcset]="s.srcset" sizes="(max-width: 720px) calc(100vw - 32px), 980px"
                   [alt]="s.alt" width="3200" height="2000" loading="lazy" decoding="async" draggable="false" />
            </div>
          </div>
        </app-device-frame>

        <ng-container *ngIf="multi">
          <button type="button" class="arrow prev" aria-label="Previous screenshot" (click)="prev()">
            <span class="material-icons" aria-hidden="true">chevron_left</span>
          </button>
          <button type="button" class="arrow next" aria-label="Next screenshot" (click)="next()">
            <span class="material-icons" aria-hidden="true">chevron_right</span>
          </button>
        </ng-container>
      </div>

      <!-- Always rendered (empty for one screenshot) so switching categories does not shift the page. -->
      <div class="nav">
        <ng-container *ngIf="multi">
          <button *ngFor="let s of category.slides; let i = index" type="button" class="dot" [class.on]="i === index"
                  [attr.aria-label]="'Show screenshot ' + (i + 1) + ' of ' + category.slides.length"
                  [attr.aria-current]="i === index ? 'true' : null" (click)="go(i)"></button>
          <button *ngIf="!reducedMotion" type="button" class="pause" (click)="togglePause()"
                  [attr.aria-label]="userPaused ? 'Play slideshow' : 'Pause slideshow'">
            <span class="material-icons" aria-hidden="true">{{ userPaused ? 'play_arrow' : 'pause' }}</span>
          </button>
        </ng-container>
      </div>
    </div>
  `,
  styleUrls: ['./showcase-carousel.component.css'],
})
export class ShowcaseCarouselComponent implements OnChanges, AfterViewInit, OnDestroy {
  /** Time each screenshot stays on screen before the next one fades in. */
  static readonly INTERVAL_MS = 5000;
  /** Horizontal travel, in CSS px, that counts as a swipe. */
  private static readonly SWIPE_PX = 40;

  @Input({ required: true }) category!: ShowcaseCategory;

  index = 0;
  userPaused = false;
  readonly reducedMotion = this.prefersReducedMotion();

  swipe: { x: number; y: number } | null = null;
  private hovered = false;
  private focused = false;
  /** Set by the IntersectionObserver: autoplay starts only once the gallery is scrolled into view. */
  private onScreen = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private observer?: IntersectionObserver;
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly onVisibilityChange = () => this.schedule();

  get multi(): boolean {
    return this.category.slides.length > 1;
  }

  /** Whether the slideshow is advancing on its own right now. */
  get playing(): boolean {
    return this.multi && !this.reducedMotion && !this.userPaused && !this.hovered && !this.focused && this.onScreen
      && !document.hidden;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['category']) {
      this.index = 0;
      this.schedule();
    }
  }

  ngAfterViewInit(): void {
    this.observeVisibility();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  next(): void { this.go(this.index + 1); }
  prev(): void { this.go(this.index - 1); }

  /** Arrow, dot or swipe: shows screenshot `i` (wrapping round) and restarts the 5-second countdown. */
  go(i: number): void {
    this.releaseHold();
    this.show(i);
  }

  /** Play resumes advancing from the current screenshot; pause keeps it on screen. */
  togglePause(): void {
    this.userPaused = !this.userPaused;
    this.releaseHold();
    this.schedule();
  }

  onPointerEnter(ev: PointerEvent): void {
    // Touch "hover" never ends, so only a real mouse pauses on hover.
    if (ev.pointerType !== 'mouse') return;
    this.hovered = true;
    this.schedule();
  }

  onPointerLeave(ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') return;
    this.hovered = false;
    this.schedule();
  }

  onFocusIn(ev: FocusEvent): void {
    // Keyboard focus pauses; focus left behind by a mouse click on an arrow does not.
    this.focused = (ev.target as Element).matches?.(':focus-visible') ?? true;
    this.schedule();
  }

  onFocusOut(ev: FocusEvent): void {
    if (this.host.nativeElement.contains(ev.relatedTarget as Node | null)) return;
    this.focused = false;
    this.schedule();
  }

  onSwipeStart(ev: PointerEvent): void {
    if (!this.multi || ev.pointerType === 'mouse') return;
    this.swipe = { x: ev.clientX, y: ev.clientY };
  }

  onSwipeEnd(ev: PointerEvent): void {
    if (!this.swipe) return;
    const dx = ev.clientX - this.swipe.x;
    const dy = ev.clientY - this.swipe.y;
    this.swipe = null;
    if (Math.abs(dx) < ShowcaseCarouselComponent.SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) this.next(); else this.prev();
  }

  private show(i: number): void {
    const n = this.category.slides.length;
    this.index = ((i % n) + n) % n;
    this.cdr.markForCheck();
    this.schedule();
  }

  /**
   * A click, tap or key press on a control is an explicit request to keep the slideshow going, so it
   * ends the hover / keyboard-focus hold. Without this, the pointer resting on the Play button or an
   * arrow kept autoplay paused, and Play only changed the icon. Moving the mouse out and back in (or
   * tabbing to another control) pauses it again.
   */
  private releaseHold(): void {
    this.hovered = false;
    this.focused = false;
  }

  /** Restarts the countdown to the next screenshot, or stops it when autoplay should not run. */
  private schedule(): void {
    this.clearTimer();
    if (!this.playing) return;
    this.timer = setTimeout(() => this.show(this.index + 1), ShowcaseCarouselComponent.INTERVAL_MS);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Runs autoplay only while the gallery is (mostly) in view. */
  protected observeVisibility(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.onScreen = true;
      this.schedule();
      return;
    }
    // IntersectionObserver callbacks run outside Angular's zone; re-enter it so the timer's slide changes render.
    this.observer = new IntersectionObserver(([entry]) => this.zone.run(() => {
      this.onScreen = entry.isIntersecting;
      this.schedule();
    }), { threshold: 0.25 });
    this.observer.observe(this.host.nativeElement);
  }

  protected prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
