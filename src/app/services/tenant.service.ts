import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { STARTUP_HTTP_TIMEOUT_MS } from '../core/startup.constants';
import { setIntendedRouteSchoolResolver } from '../auth/redirect-url.util';

export interface PublicSchoolInfo {
  name: string;
  slug: string;
  logoUrl: string | null;
  themeColor: string | null;
  city: string | null;
  boardType: string | null;
}

/**
 * Reads the school slug from the current subdomain on app init,
 * fetches public school branding from the backend, and exposes it
 * to components (primarily the login page).
 *
 * On root domain (edunexify.co.in) or localhost: school is null → marketing page shown.
 * On school subdomain (indraacademy.edunexify.co.in): school is populated → branded login shown.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly BASE_DOMAIN = environment.baseDomain;
  private _school: PublicSchoolInfo | null = null;
  private _slug: string | null = null;

  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    // A saved post-login destination belongs to the school (subdomain) it was saved under.
    setIntendedRouteSchoolResolver(() => this._slug);
  }

  get isBranded(): boolean {
    return this._school !== null;
  }
  get school(): PublicSchoolInfo | null {
    return this._school;
  }
  get slug(): string | null {
    return this._slug;
  }
  get isLocalDev(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
    );
  }

  /**
   * Called once during APP_INITIALIZER before the app renders.
   * Resolves silently — a failed fetch just means no branding (shows marketing page).
   */
  init(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve();

    const slug = this.extractSlug();
    if (!slug) return Promise.resolve();

    return this.loadSchoolBySlug(slug);
  }

  /**
   * Loads branding for an authenticated user's school. This is needed on
   * localhost and other hosts where a school slug cannot be read from the URL.
   *
   * Bounded by the same startup HTTP timeout AuthStateService's /auth/me check uses — without
   * it, a hung backend here would block the APP_INITIALIZER's Promise.all() indefinitely on its
   * own, independent of whatever the auth check is doing (the same root cause as the original
   * white-screen incident, just via a different request). On any failure — timeout included —
   * this resolves to "no branding" exactly as before: a missing/slow school lookup degrades to
   * the plain marketing/login page rather than blocking startup, since branding is cosmetic and
   * never the sole signal that the backend is unreachable (loadCurrentUser() owns that).
   */
  async loadSchoolBySlug(slug: string): Promise<void> {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug || (this._slug === normalizedSlug && this._school))
      return;

    this._slug = normalizedSlug;
    try {
      const info = await firstValueFrom(
        this.http.get<PublicSchoolInfo>(
          `${environment.apiUrl}/public/school/${normalizedSlug}`,
          { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
        ).pipe(timeout(STARTUP_HTTP_TIMEOUT_MS)),
      );
      this._school = info ?? null;
    } catch {
      this._school = null;
    }
  }

  /**
   * Returns the full URL for a school logo, handling both absolute URLs
   * and relative paths served from the backend.
   */
  getLogoUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl}${path}`;
  }

  /**
   * Builds the full URL for a school subdomain.
   * e.g. buildSchoolUrl('childrens-academy', '/dashboard')
   *   → 'https://childrens-academy.edunexify.co.in/dashboard'
   */
  buildSchoolUrl(slug: string, path = ''): string {
    if (this.isLocalDev) {
      return `${window.location.origin}${path}`;
    }
    const { protocol, port } = window.location;
    return `${protocol}//${slug}.${this.BASE_DOMAIN}${port ? ':' + port : ''}${path}`;
  }

  private extractSlug(): string | null {
    const hostname = window.location.hostname;

    // Strip port (e.g. localhost:4200)
    const host = hostname.split(':')[0];

    // Must end with .<baseDomain> to be a school subdomain
    if (!host.endsWith(`.${this.BASE_DOMAIN}`)) return null;

    const slug = host.slice(0, host.length - this.BASE_DOMAIN.length - 1);

    // Reject empty or nested subdomains
    if (!slug || slug.includes('.')) return null;

    return slug;
  }
}
