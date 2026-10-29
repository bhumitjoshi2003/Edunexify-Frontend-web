import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SchoolService } from './school.service';

/**
 * Signing out this browser — the web adapter. Android has its own copy with the same API that
 * also releases the device's push token. User-bound state that follows AuthStateService (e.g. the
 * unread notification count) clears itself when the session ends; this only does what is
 * specific to the platform, then calls the server and leaves for the sign-in page.
 */
@Injectable({ providedIn: 'root' })
export class SignOutService {
  constructor(private auth: AuthService, private schoolService: SchoolService, private router: Router) {}

  /** This session only. Always ends on the sign-in page, even if the server call fails. */
  async signOut(): Promise<void> {
    this.beforeLocalSignOut();
    try { await firstValueFrom(this.auth.logout()); } catch { /* signed out locally either way */ }
    await this.router.navigate(['/home']);
  }

  /** Every session of this account, this one included. Rejects (and stays signed in) if the
   * server couldn't do it — other devices would otherwise remain signed in unnoticed. */
  async signOutEverywhere(): Promise<void> {
    await firstValueFrom(this.auth.logoutAll() as Observable<unknown>);
    this.beforeLocalSignOut();
    await this.router.navigate(['/home']);
  }

  private beforeLocalSignOut(): void {
    this.schoolService.invalidateClasses();
  }
}
