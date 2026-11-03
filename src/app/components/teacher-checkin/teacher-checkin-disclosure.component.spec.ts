import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeacherCheckinComponent } from './teacher-checkin.component';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { TeacherAttendanceRecord } from '../../interfaces/teacher-checkin';

describe('TeacherCheckinComponent presentation', () => {
  let fixture: ComponentFixture<TeacherCheckinComponent>;
  let checkinService: jasmine.SpyObj<TeacherCheckinService>;

  beforeEach(() => {
    spyOn(TeacherCheckinComponent.prototype, 'ngOnInit');
    checkinService = jasmine.createSpyObj('TeacherCheckinService', ['getMyAttendance', 'checkIn', 'checkOut']);
    TestBed.configureTestingModule({
      imports: [TeacherCheckinComponent],
      providers: [
        { provide: TeacherCheckinService, useValue: checkinService },
        { provide: AuthStateService, useValue: jasmine.createSpyObj('AuthStateService', { getUser: { name: 'Teacher' } }) },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['log', 'error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'warning', 'error', 'info']) },
      ],
    });
    fixture = TestBed.createComponent(TeacherCheckinComponent);
  });

  it('does not render the long location disclosure beside attendance actions', () => {
    fixture.componentInstance.todayStateResolved = true;
    fixture.componentInstance.expectedToday = true;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="location-disclosure"]')).toBeNull();
  });

  it('renders an admin-marked attendance source as human-readable copy', () => {
    fixture.componentInstance.todayStateResolved = true;
    fixture.componentInstance.todayRecord = {
      checkInTime: '2026-11-02T08:55:00', checkOutTime: null, status: 'ON_TIME', method: 'MANUAL_ADMIN'
    } as TeacherAttendanceRecord;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Marked by Admin');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('MANUAL_ADMIN');
  });
});
