import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { StaffAttendanceComponent } from './staff-attendance.component';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { TeacherService } from '../../services/teacher.service';
import { TenantService } from '../../services/tenant.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { AcademicSessionService } from '../../services/academic-session.service';

/**
 * The "Mark Attendance" teacher list comes from the backend's expected-to-attend rule for the
 * dialog's date — not every teacher in the school — so nobody on a holiday, their own day off,
 * approved leave or outside employment can be picked. Editing an existing record is unchanged.
 */
describe('StaffAttendanceComponent — teachers offered for marking', () => {
  let fixture: ComponentFixture<StaffAttendanceComponent>;
  let component: StaffAttendanceComponent;
  let checkin: jasmine.SpyObj<TeacherCheckinService>;

  beforeEach(async () => {
    checkin = jasmine.createSpyObj('TeacherCheckinService', [
      'getByDate', 'getSummary', 'getTeacherSessionSummary', 'getSchoolTiming', 'adminMark', 'getMarkableTeachers',
    ]);
    checkin.getByDate.and.returnValue(of([]));
    checkin.getSchoolTiming.and.returnValue(of({} as any));
    checkin.getSummary.and.returnValue(of({ records: [] } as any));
    checkin.getMarkableTeachers.and.callFake((date: string) => of(date === '2026-10-05'
      ? [{ teacherId: 'T1', name: 'Asha' }]
      : []));
    const teachers = jasmine.createSpyObj('TeacherService', ['getAllTeachers']);
    teachers.getAllTeachers.and.returnValue(of([
      { teacherId: 'T1', name: 'Asha' }, { teacherId: 'T2', name: 'Leave Teacher' }, { teacherId: 'T3', name: 'Thu Only' },
    ] as any));
    const sessions = jasmine.createSpyObj('AcademicSessionService', ['getAllSessions', 'getCurrentSession']);
    sessions.getAllSessions.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [StaffAttendanceComponent],
      providers: [
        { provide: TeacherCheckinService, useValue: checkin },
        { provide: TeacherService, useValue: teachers },
        { provide: TenantService, useValue: jasmine.createSpyObj('TenantService', ['getLogoUrl']) },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error', 'warn', 'info']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info', 'confirm']) },
        { provide: AcademicSessionService, useValue: sessions },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StaffAttendanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.selectedDate = '2026-10-05';
  });

  it('offers only the teachers expected on the dialog date', () => {
    component.openMarkDialog();
    fixture.detectChanges();

    expect(checkin.getMarkableTeachers).toHaveBeenCalledWith('2026-10-05');
    expect(component.availableTeachers.map(t => t.teacherId)).toEqual(['T1']);
    const teacherSelect = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    const names = Array.from(teacherSelect.options).map(o => o.textContent?.trim());
    expect(names).toEqual(['Select teacher', 'Asha']);
  });

  it('re-fetches for a new date and clears a selection that is no longer valid, explaining an empty list', () => {
    component.openMarkDialog();
    component.markForm.teacherId = 'T1';
    component.markForm.date = '2026-10-04';   // a Sunday / holiday: nobody expected
    component.onMarkDateChange();
    fixture.detectChanges();

    expect(checkin.getMarkableTeachers).toHaveBeenCalledWith('2026-10-04');
    expect(component.availableTeachers).toEqual([]);
    expect(component.markForm.teacherId).toBe('');
    expect(fixture.nativeElement.textContent).toContain('No teachers are expected on this date');
  });

  it('editing an existing record still lists every teacher (the select is fixed to that record)', () => {
    component.openEditDialog({ id: 9, teacherId: 'T2', date: '2026-10-05', status: 'ON_LEAVE', checkInTime: null, checkOutTime: null } as any);

    expect(component.availableTeachers.map(t => t.teacherId)).toEqual(['T1', 'T2', 'T3']);
  });
});
