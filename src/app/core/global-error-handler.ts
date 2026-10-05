import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { ObservabilityService } from './observability.service';
import { isChunkLoadError, StaleBuildRecoveryService } from './stale-build-recovery';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  constructor(private observability: ObservabilityService, private zone: NgZone,
              private staleBuild: StaleBuildRecoveryService) {}

  handleError(error: unknown): void {
    // A lazy chunk from an older build failed to load outside a route change (a component's
    // own dynamic import). Router-driven failures are handled in app.config.ts; whichever runs
    // first wins — StaleBuildRecoveryService allows only one reload per minute.
    if (isChunkLoadError(unwrap(error)) && typeof window !== 'undefined'
        && this.staleBuild.reloadInto(window.location.pathname + window.location.search)) {
      return;
    }
    // Run outside Angular's zone so the error handler itself
    // doesn't trigger additional change detection cycles.
    this.zone.runOutsideAngular(() => {
      this.observability.reportUnexpected(error, { operation: 'angular.runtime' });
    });
  }

}

/** Angular wraps an unhandled promise rejection (e.g. a failed dynamic import) as {rejection}. */
function unwrap(error: unknown): unknown {
  const rejection = (error as { rejection?: unknown } | null)?.rejection;
  return rejection ?? error;
}
