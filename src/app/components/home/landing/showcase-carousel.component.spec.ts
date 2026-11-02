import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { ShowcaseCarouselComponent } from './showcase-carousel.component';
import { ProductShowcaseComponent } from './product-showcase.component';
import { SHOWCASE, ShowcaseCategory } from './landing.model';

const INTERVAL = ShowcaseCarouselComponent.INTERVAL_MS;
const byId = (id: string) => SHOWCASE.find(c => c.id === id)!;

describe('ShowcaseCarouselComponent', () => {
  let fixture: ComponentFixture<ShowcaseCarouselComponent>;
  let el: HTMLElement;

  function create(category: ShowcaseCategory, opts: { reducedMotion?: boolean } = {}): ShowcaseCarouselComponent {
    // Treat the gallery as scrolled into view; Karma's page position must not matter.
    spyOn(ShowcaseCarouselComponent.prototype as any, 'observeVisibility').and.callFake(function (this: any) {
      this.onScreen = true;
      this.schedule();
    });
    spyOn(ShowcaseCarouselComponent.prototype as any, 'prefersReducedMotion').and.returnValue(!!opts.reducedMotion);
    fixture = TestBed.createComponent(ShowcaseCarouselComponent);
    fixture.componentRef.setInput('category', category);
    fixture.detectChanges();
    el = fixture.nativeElement;
    return fixture.componentInstance;
  }

  const activeSrc = () => el.querySelector('.slide.on img')!.getAttribute('src');
  const pointer = (type: string, init: PointerEventInit) => new PointerEvent(type, { bubbles: true, ...init });

  beforeEach(() => TestBed.configureTestingModule({ imports: [ShowcaseCarouselComponent] }));
  afterEach(() => fixture?.destroy());

  it('shows a single screenshot statically, with no arrows, dots or autoplay', fakeAsync(() => {
    create(byId('fees'));
    expect(el.querySelectorAll('img').length).toBe(1);
    expect(el.querySelector('.arrow')).toBeNull();
    expect(el.querySelector('.dot')).toBeNull();
    expect(el.querySelector('.pause')).toBeNull();
    expect(el.querySelector('[aria-roledescription="carousel"]')).toBeNull();
    tick(INTERVAL * 3);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/fees-1.png');
  }));

  it('renders every screenshot sharp, lazy and undistorted', () => {
    create(byId('admin'));
    const imgs = Array.from(el.querySelectorAll('img'));
    expect(imgs.length).toBe(2);
    for (const img of imgs) {
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('srcset')).toContain('3200w');
      expect(img.getAttribute('srcset')).toContain('1600w');
      expect(img.alt.length).toBeGreaterThan(20);
      expect(getComputedStyle(img).objectFit).toBe('contain');
    }
  });

  it('autoplays every 5 seconds and loops', fakeAsync(() => {
    create(byId('admin'));
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');
    tick(INTERVAL - 1);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');
    tick(1);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-2.png');
    tick(INTERVAL);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');
    fixture.destroy();
  }));

  it('moves with the arrows and dots, wrapping round, and restarts the countdown', fakeAsync(() => {
    create(byId('results'));
    const [prev, next] = Array.from(el.querySelectorAll<HTMLButtonElement>('.arrow'));
    expect(prev.getAttribute('aria-label')).toBe('Previous screenshot');
    expect(next.getAttribute('aria-label')).toBe('Next screenshot');

    tick(INTERVAL - 1000);
    next.click();
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/results-2.png');
    tick(INTERVAL - 1);               // the manual move reset the timer
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/results-2.png');

    prev.click();
    prev.click();                    // wraps from the first to the last
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/results-2.png');

    const dots = el.querySelectorAll<HTMLButtonElement>('.dot');
    expect(dots.length).toBe(2);
    dots[0].click();
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/results-1.png');
    expect(dots[0].getAttribute('aria-current')).toBe('true');
    expect(dots[1].getAttribute('aria-current')).toBeNull();
    expect(dots[1].getAttribute('aria-label')).toBe('Show screenshot 2 of 2');
    fixture.destroy();
  }));

  it('hides the inactive screenshot from assistive technology', () => {
    create(byId('admin'));
    const slides = el.querySelectorAll('.slide');
    expect(slides[0].getAttribute('aria-hidden')).toBeNull();
    expect(slides[1].getAttribute('aria-hidden')).toBe('true');
    expect(slides[1].hasAttribute('inert')).toBeTrue();
  });

  it('pauses while a mouse is over it and resumes afterwards', fakeAsync(() => {
    create(byId('admin'));
    const car = el.querySelector('.car')!;
    car.dispatchEvent(pointer('pointerenter', { pointerType: 'mouse' }));
    tick(INTERVAL * 2);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');

    car.dispatchEvent(pointer('pointerleave', { pointerType: 'mouse' }));
    tick(INTERVAL);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-2.png');
    fixture.destroy();
  }));

  it('does not treat a touch as a hover', fakeAsync(() => {
    create(byId('admin'));
    el.querySelector('.car')!.dispatchEvent(pointer('pointerenter', { pointerType: 'touch' }));
    tick(INTERVAL);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-2.png');
    fixture.destroy();
  }));

  it('pauses while it has keyboard focus and resumes when focus leaves', fakeAsync(() => {
    const c = create(byId('admin'));
    const next = el.querySelector<HTMLButtonElement>('.arrow.next')!;
    spyOn(next, 'matches').and.returnValue(true);   // as if focused from the keyboard
    next.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(c.playing).toBeFalse();
    tick(INTERVAL * 2);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');

    next.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    expect(c.playing).toBeTrue();
    tick(INTERVAL);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-2.png');
    fixture.destroy();
  }));

  it('has a pause button that stops and restarts the slideshow', fakeAsync(() => {
    create(byId('admin'));
    const pause = el.querySelector<HTMLButtonElement>('.pause')!;
    expect(pause.getAttribute('aria-label')).toBe('Pause slideshow');
    pause.click();
    fixture.detectChanges();
    expect(pause.getAttribute('aria-label')).toBe('Play slideshow');
    tick(INTERVAL * 2);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');
    pause.click();
    tick(INTERVAL);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-2.png');
    fixture.destroy();
  }));

  it('changes screenshot on a horizontal swipe but not on a vertical scroll', fakeAsync(() => {
    create(byId('admin'));
    const view = el.querySelector('.view')!;
    const swipe = (fromX: number, toX: number, fromY = 100, toY = 100) => {
      view.dispatchEvent(pointer('pointerdown', { pointerType: 'touch', clientX: fromX, clientY: fromY }));
      view.dispatchEvent(pointer('pointerup', { pointerType: 'touch', clientX: toX, clientY: toY }));
      fixture.detectChanges();
    };
    swipe(300, 200);
    expect(activeSrc()).toBe('landing/showcase/admin-2.png');
    swipe(100, 220);
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');
    swipe(200, 150, 100, 300);        // mostly vertical: a page scroll
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');
    swipe(200, 180);                  // too short
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');
    fixture.destroy();
  }));

  it('does not autoplay until it has been scrolled into view', fakeAsync(() => {
    spyOn(ShowcaseCarouselComponent.prototype as any, 'prefersReducedMotion').and.returnValue(false);
    spyOn(ShowcaseCarouselComponent.prototype as any, 'observeVisibility').and.stub();
    fixture = TestBed.createComponent(ShowcaseCarouselComponent);
    fixture.componentRef.setInput('category', byId('admin'));
    fixture.detectChanges();
    el = fixture.nativeElement;
    expect(fixture.componentInstance.playing).toBeFalse();
    tick(INTERVAL * 2);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');
  }));

  it('starts again from the first screenshot when the category changes', fakeAsync(() => {
    create(byId('admin'));
    el.querySelector<HTMLButtonElement>('.arrow.next')!.click();
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-2.png');

    fixture.componentRef.setInput('category', byId('attendance'));
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/attendance-1.png');
    tick(INTERVAL);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/attendance-2.png');
    fixture.destroy();
  }));

  it('never autoplays with reduced motion, but keeps manual controls', fakeAsync(() => {
    create(byId('admin'), { reducedMotion: true });
    expect(el.querySelector('.pause')).toBeNull();
    tick(INTERVAL * 3);
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-1.png');
    el.querySelector<HTMLButtonElement>('.arrow.next')!.click();
    fixture.detectChanges();
    expect(activeSrc()).toBe('landing/showcase/admin-2.png');
    discardPeriodicTasks();
  }));
  // Clicking a control means the mouse is over the carousel. Before the fix that hover hold kept
  // autoplay stopped, so Play only changed its icon and arrows/dots never resumed the countdown.
  describe('autoplay while the mouse is on the controls', () => {
    const later = (ms: number) => { tick(ms); fixture.detectChanges(); };
    const mouseOver = () => el.querySelector('.car')!.dispatchEvent(pointer('pointerenter', { pointerType: 'mouse' }));
    const clickWithMouse = (selector: string, nth = 0) => {
      mouseOver();
      el.querySelectorAll<HTMLButtonElement>(selector)[nth].click();
      fixture.detectChanges();
    };

    it('advances from screenshot 1 to 2 after 5 seconds', fakeAsync(() => {
      create(byId('admin'));
      later(INTERVAL - 1);
      expect(activeSrc()).toBe('landing/showcase/admin-1.png');
      later(1);
      expect(activeSrc()).toBe('landing/showcase/admin-2.png');
      fixture.destroy();
    }));

    it('loops from screenshot 2 back to 1 after another 5 seconds, and keeps looping', fakeAsync(() => {
      create(byId('results'));
      later(INTERVAL);
      expect(activeSrc()).toBe('landing/showcase/results-2.png');
      later(INTERVAL);
      expect(activeSrc()).toBe('landing/showcase/results-1.png');
      later(INTERVAL);
      expect(activeSrc()).toBe('landing/showcase/results-2.png');
      fixture.destroy();
    }));

    it('Pause stops advancing and keeps the current screenshot on screen', fakeAsync(() => {
      create(byId('admin'));
      later(INTERVAL);
      expect(activeSrc()).toBe('landing/showcase/admin-2.png');
      clickWithMouse('.pause');
      el.querySelector('.car')!.dispatchEvent(pointer('pointerleave', { pointerType: 'mouse' }));
      later(INTERVAL * 4);
      expect(activeSrc()).toBe('landing/showcase/admin-2.png');
      expect(el.querySelector('.pause')!.getAttribute('aria-label')).toBe('Play slideshow');
      fixture.destroy();
    }));

    it('Play resumes advancing from the current screenshot even with the mouse still on the button', fakeAsync(() => {
      create(byId('admin'));
      clickWithMouse('.dot', 1);                 // on screenshot 2
      clickWithMouse('.pause');                  // pause
      later(INTERVAL * 2);
      expect(activeSrc()).toBe('landing/showcase/admin-2.png');

      clickWithMouse('.pause');                  // play, pointer never leaves
      expect(el.querySelector('.pause')!.getAttribute('aria-label')).toBe('Pause slideshow');
      later(INTERVAL - 1);
      expect(activeSrc()).toBe('landing/showcase/admin-2.png');
      later(1);
      expect(activeSrc()).toBe('landing/showcase/admin-1.png');
      later(INTERVAL);
      expect(activeSrc()).toBe('landing/showcase/admin-2.png');
      fixture.destroy();
    }));

    it('an arrow, dot or swipe changes the screenshot at once and restarts the 5-second countdown', fakeAsync(() => {
      create(byId('attendance'));
      later(INTERVAL - 1000);
      clickWithMouse('.arrow.next');
      expect(activeSrc()).toBe('landing/showcase/attendance-2.png');
      later(INTERVAL - 1);                       // a full new countdown, not the 1s left over
      expect(activeSrc()).toBe('landing/showcase/attendance-2.png');
      later(1);
      expect(activeSrc()).toBe('landing/showcase/attendance-1.png');

      later(INTERVAL - 2000);
      clickWithMouse('.dot', 1);
      expect(activeSrc()).toBe('landing/showcase/attendance-2.png');
      later(INTERVAL - 1);
      expect(activeSrc()).toBe('landing/showcase/attendance-2.png');
      later(1);
      expect(activeSrc()).toBe('landing/showcase/attendance-1.png');

      later(INTERVAL - 3000);
      const view = el.querySelector('.view')!;
      view.dispatchEvent(pointer('pointerdown', { pointerType: 'touch', clientX: 300, clientY: 100 }));
      view.dispatchEvent(pointer('pointerup', { pointerType: 'touch', clientX: 150, clientY: 100 }));
      fixture.detectChanges();
      expect(activeSrc()).toBe('landing/showcase/attendance-2.png');
      later(INTERVAL - 1);
      expect(activeSrc()).toBe('landing/showcase/attendance-2.png');
      later(1);
      expect(activeSrc()).toBe('landing/showcase/attendance-1.png');
      fixture.destroy();
    }));

    it('a category change goes back to screenshot 1 and autoplays it', fakeAsync(() => {
      create(byId('admin'));
      clickWithMouse('.arrow.next');
      fixture.componentRef.setInput('category', byId('notifications'));
      fixture.detectChanges();
      expect(activeSrc()).toBe('landing/showcase/notification-1.png');
      later(INTERVAL);
      expect(activeSrc()).toBe('landing/showcase/notification-2.png');
      fixture.destroy();
    }));

    it('keeps the hover pause when the mouse simply rests on the screenshot', fakeAsync(() => {
      create(byId('admin'));
      mouseOver();
      later(INTERVAL * 3);
      expect(activeSrc()).toBe('landing/showcase/admin-1.png');
      fixture.destroy();
    }));

    for (const id of ['parent', 'fees', 'copilot']) {
      it(`keeps the single-screenshot ${id} category static, with no play/pause, arrows or dots`, fakeAsync(() => {
        const c = create(byId(id));
        expect(el.querySelector('.pause')).toBeNull();
        expect(el.querySelector('.arrow')).toBeNull();
        expect(el.querySelector('.dot')).toBeNull();
        expect(c.playing).toBeFalse();
        const src = activeSrc();
        later(INTERVAL * 3);
        expect(activeSrc()).toBe(src);
      }));
    }
  });
});

describe('ProductShowcaseComponent', () => {
  let fixture: ComponentFixture<ProductShowcaseComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    spyOn(ShowcaseCarouselComponent.prototype as any, 'observeVisibility').and.stub();
    TestBed.configureTestingModule({ imports: [ProductShowcaseComponent] });
    fixture = TestBed.createComponent(ProductShowcaseComponent);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });
  afterEach(() => fixture.destroy());

  it('maps every category to its real screenshots', () => {
    const files = (id: string) => byId(id).slides.map(s => s.src.replace('landing/showcase/', ''));
    expect(SHOWCASE.map(c => c.id)).toEqual(['admin', 'attendance', 'parent', 'results', 'notifications', 'fees', 'copilot']);
    expect(files('admin')).toEqual(['admin-1.png', 'admin-2.png']);
    expect(files('attendance')).toEqual(['attendance-1.png', 'attendance-2.png']);
    expect(files('parent')).toEqual(['parent-1.png']);
    expect(files('results')).toEqual(['results-1.png', 'results-2.png']);
    expect(files('notifications')).toEqual(['notification-1.png', 'notification-2.png']);
    expect(files('fees')).toEqual(['fees-1.png']);
    expect(files('copilot')).toEqual(['ai-1.png']);
    expect(new Set(SHOWCASE.flatMap(c => c.slides.map(s => s.alt))).size).toBe(11);
  });

  it('no longer shows the "preview coming soon" placeholder', () => {
    expect(el.textContent).not.toContain('Product preview coming soon');
    expect(el.querySelector('.df-ph')).toBeNull();
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('renders only the selected category and switches with the tabs', () => {
    const tabs = el.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs.length).toBe(SHOWCASE.length);
    expect(el.querySelectorAll('app-showcase-carousel').length).toBe(1);

    tabs[5].click();                // Fees
    fixture.detectChanges();
    expect(tabs[5].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('[role="tabpanel"]')!.getAttribute('aria-labelledby')).toBe('tab-fees');
    expect(Array.from(el.querySelectorAll('img')).map(i => i.getAttribute('src'))).toEqual(['landing/showcase/fees-1.png']);
    expect(el.querySelector('.cap')!.textContent).toContain('Fees');
  });

  it('moves between tabs with the arrow keys', () => {
    const first = el.querySelector<HTMLButtonElement>('[role="tab"]')!;
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.active).toBe(SHOWCASE.length - 1);
  });
});
