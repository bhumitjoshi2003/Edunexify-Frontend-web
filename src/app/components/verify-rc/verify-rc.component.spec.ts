import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { baselineTestProviders } from '../../../testing/baseline-test-providers';
import { VerifyRcComponent } from './verify-rc.component';

describe('VerifyRcComponent', () => {
  it('shows the bundled Edunexify logo and the no-token state without calling the API', () => {
    TestBed.configureTestingModule({ providers: [...baselineTestProviders()] });
    const fixture = TestBed.createComponent(VerifyRcComponent);
    fixture.detectChanges();
    const logo: HTMLImageElement = fixture.nativeElement.querySelector('img.vrc-logo');
    expect(logo.getAttribute('src')).toBe('EdunexifyLogo.png');
    expect(fixture.nativeElement.textContent).toContain('No verification token found in this link.');
    TestBed.inject(HttpTestingController).verify();
  });
});
