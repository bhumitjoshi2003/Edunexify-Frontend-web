import { ErrorHandler } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withNavigationErrorHandler } from '@angular/router';
import {
  isChunkLoadError, recoverStaleChunkNavigation, STALE_BUILD_RELOAD_KEY, StaleBuildRecoveryService,
} from './stale-build-recovery';
import { GlobalErrorHandler } from './global-error-handler';
import { ObservabilityService } from './observability.service';

/** A tab left open across a deploy asks for chunks of the old build, which no longer exist. */
describe('Stale build recovery', () => {
  const chromeError = new TypeError('Failed to fetch dynamically imported module: https://edunexify.co.in/chunk-OLD123.js');

  afterEach(() => sessionStorage.removeItem(STALE_BUILD_RELOAD_KEY));

  it('recognises each browser\'s failed-chunk error, and nothing else', () => {
    expect(isChunkLoadError(chromeError)).toBeTrue();
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBeTrue();   // Firefox
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBeTrue();           // Safari
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBeFalse();
    expect(isChunkLoadError(null)).toBeFalse();
    // ordinary auth/network failures never count as a stale build (no full-page reload)
    expect(isChunkLoadError(new HttpErrorResponse({ status: 0, url: '/api/auth/me' }))).toBeFalse();
    expect(isChunkLoadError(new HttpErrorResponse({ status: 401, url: '/api/auth/refresh-token' }))).toBeFalse();
    expect(isChunkLoadError(new TimeoutError())).toBeFalse();
  });

  describe('StaleBuildRecoveryService', () => {
    let service: StaleBuildRecoveryService;
    let assign: jasmine.Spy;

    beforeEach(() => {
      service = TestBed.inject(StaleBuildRecoveryService);
      assign = spyOn<any>(service, 'assign');
    });

    it('loads the current build straight into the page the user was going to — once', () => {
      expect(service.reloadInto('/dashboard/fees')).toBeTrue();
      expect(service.reloadInto('/dashboard/fees')).toBeFalse();   // never a reload loop
      expect(assign).toHaveBeenCalledOnceWith('/dashboard/fees');
    });

    it('never reloads while offline (the user keeps the current page)', () => {
      spyOnProperty(navigator, 'onLine').and.returnValue(false);

      expect(service.reloadInto('/dashboard/fees')).toBeFalse();
      expect(assign).not.toHaveBeenCalled();
    });

    it('only ever reloads into an internal path', () => {
      service.reloadInto('//evil.example/x');
      expect(assign).toHaveBeenCalledOnceWith('/');
    });
  });

  it('a route whose chunk is gone reloads into that route instead of failing silently', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([
        { path: 'old', loadComponent: () => Promise.reject(chromeError) },
      ], withNavigationErrorHandler(recoverStaleChunkNavigation))],
    });
    const reload = spyOn(TestBed.inject(StaleBuildRecoveryService), 'reloadInto').and.returnValue(true);

    await TestBed.inject(Router).navigateByUrl('/old').catch(() => false);

    expect(reload).toHaveBeenCalledOnceWith('/old');
  });

  it('a failed chunk outside routing is recovered by the global error handler; other errors are still reported', () => {
    const observability = jasmine.createSpyObj<ObservabilityService>('ObservabilityService', ['reportUnexpected']);
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        { provide: ObservabilityService, useValue: observability },
      ],
    });
    const reload = spyOn(TestBed.inject(StaleBuildRecoveryService), 'reloadInto').and.returnValue(true);
    const handler = TestBed.inject(ErrorHandler);

    handler.handleError({ rejection: chromeError });   // Angular's unhandled-rejection wrapper
    expect(reload).toHaveBeenCalledTimes(1);
    expect(observability.reportUnexpected).not.toHaveBeenCalled();

    handler.handleError(new Error('something else'));
    expect(observability.reportUnexpected).toHaveBeenCalledTimes(1);
  });
});
