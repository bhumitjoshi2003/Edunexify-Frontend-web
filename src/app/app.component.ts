import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './components/toast/toast-container.component';
import { AuthStateService } from './auth/auth-state.service';
import { StartupRecoveryComponent } from './components/startup-recovery/startup-recovery.component';
import { AppResumeService } from './core/app-resume.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, RouterOutlet, ToastContainerComponent, StartupRecoveryComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'ias';

  /**
   * Drives the root-level gate between the normal app (router-outlet) and the startup-recovery
   * experience. CHECKING/SERVICE_UNAVAILABLE/OFFLINE all render StartupRecoveryComponent instead
   * of the router outlet — infrastructure failure becomes a renderable STATE here rather than a
   * blocked bootstrap, which is what let the original incident produce an indefinite white
   * screen. AUTHENTICATED and UNAUTHENTICATED both render normally: routing/guards already
   * decide what an unauthenticated visitor sees (the public/login flow), so this gate only ever
   * needs to distinguish "we have a real verdict" from "we don't yet, or can't get one".
   */
  constructor(public authState: AuthStateService, appResume: AppResumeService) {
    // Tab resume / back-forward-cache restore / reconnect handling for every route.
    appResume.start();
  }
}
