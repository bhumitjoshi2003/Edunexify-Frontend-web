import { TestBed } from '@angular/core/testing';
import { baselineTestProviders } from '../../../testing/baseline-test-providers';
import { HomeComponent } from './home.component';
import { ToastService } from '../../services/toast.service';


/** Forgot password tells people without an email on file where to get help. */
describe('HomeComponent — forgot-password hint', () => {
  it('the forgot-password form shows the no-email hint', () => {
    TestBed.configureTestingModule({
      providers: [
        ...baselineTestProviders(),
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['warning', 'error', 'success', 'info', 'confirm']) },
      ],
    });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.componentInstance.forgotPassword();
    fixture.detectChanges();

    const hints = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="forgot-no-email-hint"]'));
    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) {
      expect(hint.textContent?.trim()).toBe('No email on file? Contact your school office for help accessing your account.');
    }
  });
});
