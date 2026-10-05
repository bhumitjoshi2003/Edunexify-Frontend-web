import { inject, Injectable } from '@angular/core';
import { NavigationError } from '@angular/router';

/**
 * Messages browsers use when a lazy route chunk (dynamic import) cannot be loaded. After a
 * deploy, the old build's chunk files no longer exist; the server answers their URLs with
 * index.html (SPA fallback), which every browser rejects as a module script.
 *   Chrome/Edge: "Failed to fetch dynamically imported module: …"
 *   Firefox:     "error loading dynamically imported module"
 *   Safari:      "Importing a module script failed."
 */
const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i;

/** Shared with the inline boot guard in index.html, so the two never reload back to back. */
export const STALE_BUILD_RELOAD_KEY = 'edunexify.stale-build-reload';
const MIN_RELOAD_INTERVAL_MS = 60_000;

export function isChunkLoadError(error: unknown): boolean {
  if (error == null) return false;
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return CHUNK_LOAD_ERROR.test(text);
}

/**
 * Recovers a tab that is still running an older build than the one now deployed: the code it
 * needs for the next page no longer exists on the server, so no in-app retry can succeed — the
 * only fix is loading the current build. This does that once, straight to the page the user
 * was going to, and never loops: at most one attempt per minute (sessionStorage), and never
 * while the browser reports being offline (a reload then would replace the app with the
 * browser's own offline error page; the user stays on the current page instead).
 */
@Injectable({ providedIn: 'root' })
export class StaleBuildRecoveryService {

  /** Returns true if a full load of {@code targetUrl} was started. */
  reloadInto(targetUrl: string): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    try {
      const last = Number(sessionStorage.getItem(STALE_BUILD_RELOAD_KEY) || 0);
      if (Date.now() - last < MIN_RELOAD_INTERVAL_MS) return false;
      sessionStorage.setItem(STALE_BUILD_RELOAD_KEY, String(Date.now()));
    } catch {
      return false;   // no way to guard against a reload loop — leave the current page as it is
    }
    this.assign(targetUrl.startsWith('/') && !targetUrl.startsWith('//') ? targetUrl : '/');
    return true;
  }

  /** Separate so tests can observe it without navigating the test runner. */
  protected assign(url: string): void {
    window.location.assign(url);
  }
}

/**
 * Router navigation-error handler (see app.config.ts): a lazy route whose chunk belongs to an
 * older build loads the current build straight into that route instead of leaving the
 * navigation silently failed. Runs in an injection context.
 */
export function recoverStaleChunkNavigation(event: NavigationError): void {
  if (isChunkLoadError(event.error)) inject(StaleBuildRecoveryService).reloadInto(event.url);
}
