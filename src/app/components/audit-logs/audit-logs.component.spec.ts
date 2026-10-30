import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditLogsComponent } from './audit-logs.component';
import { baselineTestProviders } from '../../../testing/baseline-test-providers';

describe('AuditLogsComponent', () => {
  let component: AuditLogsComponent;
  let fixture: ComponentFixture<AuditLogsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [...baselineTestProviders()],
      imports: [AuditLogsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(AuditLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
