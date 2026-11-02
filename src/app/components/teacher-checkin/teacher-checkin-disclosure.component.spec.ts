import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeacherCheckinComponent } from './teacher-checkin.component';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { TeacherAttendanceRecord } from '../../interfaces/teacher-checkin';
import { ATTENDANCE_LOCATION_DISCLOSURE } from '../../utils/location-disclosure';

describe('TeacherCheckinComponent location disclosure', () => {
  let fixture: ComponentFixture<TeacherCheckinComponent>;
  let checkinService: jasmine.SpyObj<TeacherCheckinService>;
  let getPosition: jasmine.Spy;

  beforeEach(() => {
    // Rendering only: the screen's own loading is covered elsewhere and must not matter here.
    spyOn(TeacherCheckinComponent.prototype, 'ngOnInit');
    getPosition = spyOn<any>(TeacherCheckinComponent.prototype, 'getPosition');
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

  const disclosures = (): string[] => Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="location-disclosure"]'),
    el => el.textContent!.trim());

  it('shows the full disclosure next to Check In, before location is requested', () => {
    fixture.componentInstance.todayStateResolved = true;
    // The web screen also needs today to be a working day before it offers Check In.
    (fixture.componentInstance as unknown as { expectedToday: boolean }).expectedToday = true;
    fixture.detectChanges();

    expect(disclosures()).toEqual([ATTENDANCE_LOCATION_DISCLOSURE]);
    expect(getPosition).not.toHaveBeenCalled();
  });

  it('shows it again next to Check Out', () => {
    fixture.componentInstance.todayStateResolved = true;
    fixture.componentInstance.todayRecord = { checkInTime: '2026-11-02T08:55:00', checkOutTime: null, status: 'ON_TIME' } as TeacherAttendanceRecord;
    fixture.detectChanges();

    expect(disclosures()).toEqual([ATTENDANCE_LOCATION_DISCLOSURE]);
  });

  it('states that check-in location is saved, checkout location is not, and nothing runs in the background', () => {
    expect(ATTENDANCE_LOCATION_DISCLOSURE).toContain('check-in location and distance from the school are saved');
    expect(ATTENDANCE_LOCATION_DISCLOSURE).toContain('Checkout location is used for verification but is not saved');
    expect(ATTENDANCE_LOCATION_DISCLOSURE).toContain('does not access your location in the background');
  });
});
