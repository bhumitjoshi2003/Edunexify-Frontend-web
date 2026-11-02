import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FrameVideoComponent } from './frame-video.component';
import { PlatformsSectionComponent } from './platforms-section.component';
import { ANDROID_VIDEO, WEB_VIDEO } from './landing.model';

describe('FrameVideoComponent', () => {
  let fixture: ComponentFixture<FrameVideoComponent>;
  let video: HTMLVideoElement;
  let paused: boolean;
  let play: jasmine.Spy;
  let pause: jasmine.Spy;

  function create(opts: { reducedMotion?: boolean } = {}): FrameVideoComponent {
    // Visibility is driven by the tests through setOnScreen; Karma's page position must not matter.
    spyOn(FrameVideoComponent.prototype as any, 'observeVisibility');
    spyOn(FrameVideoComponent.prototype as any, 'prefersReducedMotion').and.returnValue(!!opts.reducedMotion);
    fixture = TestBed.createComponent(FrameVideoComponent);
    fixture.componentRef.setInput('video', WEB_VIDEO);
    video = fixture.nativeElement.querySelector('video');
    paused = true;
    Object.defineProperty(video, 'paused', { get: () => paused });
    play = spyOn(video, 'play').and.callFake(() => { paused = false; return Promise.resolve(); });
    pause = spyOn(video, 'pause').and.callFake(() => { paused = true; });
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const setOnScreen = (c: FrameVideoComponent, on: boolean) => (c as any).setOnScreen(on);

  beforeEach(() => TestBed.configureTestingModule({ imports: [FrameVideoComponent] }));
  afterEach(() => fixture?.destroy());

  it('is a muted, looping, inline recording with a poster and no native controls', () => {
    create();
    expect(video.getAttribute('src')).toBe(WEB_VIDEO.src);
    expect(video.getAttribute('poster')).toBe(WEB_VIDEO.poster);
    expect(video.muted).toBeTrue();
    expect(video.loop).toBeTrue();
    expect(video.playsInline).toBeTrue();
    expect(video.controls).toBeFalse();
    expect(video.getAttribute('preload')).toBe('metadata');
    expect(video.getAttribute('aria-label')).toBe(WEB_VIDEO.label);
  });

  it('does not play until it is on screen', () => {
    create();
    expect(play).not.toHaveBeenCalled();
    expect(paused).toBeTrue();
  });

  it('plays when scrolled into view, pauses when scrolled away and resumes when back', () => {
    const c = create();
    setOnScreen(c, true);
    expect(play).toHaveBeenCalledTimes(1);
    expect(paused).toBeFalse();

    setOnScreen(c, false);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(paused).toBeTrue();

    setOnScreen(c, true);
    expect(play).toHaveBeenCalledTimes(2);
    expect(paused).toBeFalse();
  });

  it('pauses while the tab is hidden', () => {
    const c = create();
    setOnScreen(c, true);
    spyOnProperty(document, 'hidden').and.returnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pause).toHaveBeenCalled();
    expect(c.shouldPlay).toBeFalse();
  });

  it('stays on its poster and never plays with reduced motion', () => {
    const c = create({ reducedMotion: true });
    setOnScreen(c, true);
    expect(play).not.toHaveBeenCalled();
    expect(paused).toBeTrue();
    expect(video.getAttribute('poster')).toBe(WEB_VIDEO.poster);
  });

  it('has a small pause button that stops it, survives scrolling away and back, and plays again', () => {
    const c = create();
    setOnScreen(c, true);
    const button = () => fixture.nativeElement.querySelector('button.toggle') as HTMLButtonElement;
    expect(button().getAttribute('aria-label')).toBe('Pause video');

    button().click();
    fixture.detectChanges();
    expect(paused).toBeTrue();
    expect(button().getAttribute('aria-label')).toBe('Play video');

    setOnScreen(c, false);
    setOnScreen(c, true);
    expect(paused).toBeTrue();

    button().click();
    fixture.detectChanges();
    expect(paused).toBeFalse();
    expect(button().getAttribute('aria-label')).toBe('Pause video');
  });

  it('shows no pause button with reduced motion, since nothing moves', () => {
    create({ reducedMotion: true });
    expect(fixture.nativeElement.querySelector('button.toggle')).toBeNull();
  });

  it('keeps the poster when the browser refuses autoplay', async () => {
    const c = create();
    play.and.returnValue(Promise.reject(new DOMException('blocked', 'NotAllowedError')));
    setOnScreen(c, true);
    await fixture.whenStable();
    expect(video.getAttribute('poster')).toBe(WEB_VIDEO.poster);
  });
});

describe('PlatformsSectionComponent', () => {
  let el: HTMLElement;

  beforeEach(() => {
    spyOn(FrameVideoComponent.prototype as any, 'observeVisibility');
    TestBed.configureTestingModule({ imports: [PlatformsSectionComponent] });
    const fixture = TestBed.createComponent(PlatformsSectionComponent);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('shows the admin recording in the browser frame and the parent recording in the phone frame', () => {
    expect(el.querySelector('.df-browser video')!.getAttribute('src')).toBe(WEB_VIDEO.src);
    expect(el.querySelector('.df-phone video')!.getAttribute('src')).toBe(ANDROID_VIDEO.src);
    expect(el.querySelector('.df-ph')).toBeNull();
    expect(el.textContent).not.toContain('coming soon');
  });

  it('fits each recording to its screen without stretching or cropping', () => {
    const box = (sel: string) => el.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
    const web = box('.df-browser video');
    expect(web.width / web.height).toBeCloseTo(WEB_VIDEO.width / WEB_VIDEO.height, 2);
    expect(box('.df-browser .df-screen').height).toBeCloseTo(web.height, 0);
    const phone = box('.df-phone video');
    expect(phone.width / phone.height).toBeCloseTo(ANDROID_VIDEO.width / ANDROID_VIDEO.height, 2);
    expect(phone.width).toBeCloseTo(box('.df-phone .df-screen').width, 0);
  });

  it('keeps the phone notch off the recording', () => {
    const notch = el.querySelector('.df-phone .df-notch')!.getBoundingClientRect();
    const video = el.querySelector('.df-phone video')!.getBoundingClientRect();
    expect(notch.bottom).toBeLessThanOrEqual(video.top);
  });
});
