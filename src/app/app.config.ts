import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withNavigationErrorHandler } from '@angular/router';
import { routes } from './app.routes';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AuthInterceptor } from './auth/auth.interceptor';
import { GlobalErrorHandler } from './core/global-error-handler';
import { StartupService } from './core/startup.service';
import { STARTUP_BOOTSTRAP_GRACE_MS } from './core/startup.constants';
import { recoverStaleChunkNavigation } from './core/stale-build-recovery';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // A tab left open across a deploy still runs the old build; its next lazy route then fails
    // to load (the old chunk is gone). Load the current build straight into that route instead
    // of leaving the navigation silently failed on a half-empty page.
    provideRouter(routes, withNavigationErrorHandler(recoverStaleChunkNavigation)),
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(() => {
      const startupService = inject(StartupService);

      // Load school branding (from subdomain) and current user session in parallel. Bootstrap
      // waits for this up to STARTUP_BOOTSTRAP_GRACE_MS only — a healthy, fast backend still
      // resolves within that window so the first paint is unchanged from before. If it's
      // slower than that (a cold Neon resume, a briefly loaded backend), Angular bootstraps
      // anyway with AuthStateService still CHECKING; the root shell renders a loading state and
      // reacts to status$ once the real result lands. The underlying calls are never abandoned
      // — they keep running past this race and settle for real within STARTUP_HTTP_TIMEOUT_MS
      // regardless of whether bootstrap already proceeded without them. Neither call can ever
      // reject (see StartupService), so this race can never leave bootstrap itself rejected.
      const initPromise = startupService.initialize();
      const grace = new Promise<void>(resolve => setTimeout(resolve, STARTUP_BOOTSTRAP_GRACE_MS));
      return Promise.race([initPromise, grace]);
    })
  ]
};
