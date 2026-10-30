import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewNotificationComponent } from './view-notification.component';
import { baselineTestProviders } from '../../../testing/baseline-test-providers';

describe('ViewNotificationComponent', () => {
  let component: ViewNotificationComponent;
  let fixture: ComponentFixture<ViewNotificationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [...baselineTestProviders()],
      imports: [ViewNotificationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewNotificationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
