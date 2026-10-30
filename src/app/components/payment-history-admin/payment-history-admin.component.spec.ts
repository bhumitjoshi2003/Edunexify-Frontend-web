import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentHistoryAdminComponent } from './payment-history-admin.component';
import { baselineTestProviders } from '../../../testing/baseline-test-providers';

describe('PaymentHistoryAdminComponent', () => {
  let component: PaymentHistoryAdminComponent;
  let fixture: ComponentFixture<PaymentHistoryAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [...baselineTestProviders()],
      imports: [PaymentHistoryAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentHistoryAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
