import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { StudentListComponent } from './student-list.component';
import { StudentService } from '../../services/student.service';
import { TeacherService } from '../../services/teacher.service';
import { Router } from '@angular/router';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { setStoredSelectedClass } from '../../utils/class-selection-storage.util';

describe('StudentListComponent', () => {
  let component: StudentListComponent;
  let fixture: ComponentFixture<StudentListComponent>;

  let studentServiceSpy: jasmine.SpyObj<StudentService>;
  let schoolServiceSpy: jasmine.SpyObj<SchoolService>;
  let authStateServiceSpy: jasmine.SpyObj<AuthStateService>;

  const adminUser = {
    userId: 'admin1', role: 'ADMIN', name: 'Admin', className: null, schoolSlug: 'school-a',
    featureKeys: [], planTier: null, planVersion: null, subscriptionStatus: null,
    trialEndsAt: null, expiresAt: null, graceEndsAt: null, permissionKeys: null,
  };

  beforeEach(async () => {
    localStorage.clear();

    studentServiceSpy = jasmine.createSpyObj('StudentService', [
      'getActiveStudentsByClass', 'getNewStudentsByClass', 'getAlumniByClass', 'getLeftStudentsByClass'
    ]);
    studentServiceSpy.getActiveStudentsByClass.and.returnValue(of([]));
    studentServiceSpy.getNewStudentsByClass.and.returnValue(of([]));
    studentServiceSpy.getAlumniByClass.and.returnValue(of([]));
    studentServiceSpy.getLeftStudentsByClass.and.returnValue(of([]));

    schoolServiceSpy = jasmine.createSpyObj('SchoolService', ['getClasses', 'getManagedClasses']);
    authStateServiceSpy = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authStateServiceSpy.getUser.and.returnValue(adminUser as any);
    authStateServiceSpy.hasFeature.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [StudentListComponent],
      providers: [
        { provide: StudentService, useValue: studentServiceSpy },
        { provide: TeacherService, useValue: jasmine.createSpyObj('TeacherService', ['getTeacher']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: AuthStateService, useValue: authStateServiceSpy },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error', 'warn', 'info']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error', 'success', 'warning', 'info']) },
        { provide: SchoolService, useValue: schoolServiceSpy },
        { provide: SectionService, useValue: jasmine.createSpyObj('SectionService', ['getSectionsForClass']) },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StudentListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    schoolServiceSpy.getClasses.and.returnValue(of([]));
    schoolServiceSpy.getManagedClasses.and.returnValue(of([]));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  /** Regression: a subject teacher (or a Coordinator in Teacher work) with no class saw "Failed to load students". */
  it('a teacher without a class of their own sees "No class assigned" and no request is sent', () => {
    authStateServiceSpy.getUser.and.returnValue({ ...adminUser, userId: 'T9', role: 'TEACHER' } as any);
    const teachers = TestBed.inject(TeacherService) as jasmine.SpyObj<TeacherService>;
    teachers.getTeacher.and.returnValue(of({ teacherId: 'T9', name: 'Subject Teacher', classTeacher: null } as any));
    schoolServiceSpy.getClasses.and.returnValue(of(['8']));
    schoolServiceSpy.getManagedClasses.and.returnValue(of([]));
    fixture.detectChanges();
    expect(component.noOwnClass).toBeTrue();
    expect(component.isLoading).toBeFalse();
    expect(studentServiceSpy.getActiveStudentsByClass).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No class assigned');
  });

  it('when the school has no configured classes, selectedClass stays empty and no student query runs', () => {
    schoolServiceSpy.getClasses.and.returnValue(of([]));
    schoolServiceSpy.getManagedClasses.and.returnValue(of([]));

    fixture.detectChanges();

    expect(component.selectedClass).toBe('');
    expect(component.isLoading).toBe(false);
    expect(studentServiceSpy.getActiveStudentsByClass).not.toHaveBeenCalled();
  });

  it('restores a stored class that is present in the freshly loaded class list', () => {
    setStoredSelectedClass('school-a', '10');
    schoolServiceSpy.getClasses.and.returnValue(of(['9', '10', '11']));
    schoolServiceSpy.getManagedClasses.and.returnValue(of([
      { id: 1, name: '9', displayOrder: 1, active: true, streamEligible: false },
      { id: 2, name: '10', displayOrder: 2, active: true, streamEligible: false },
      { id: 3, name: '11', displayOrder: 3, active: true, streamEligible: false },
    ]));

    fixture.detectChanges();

    expect(component.selectedClass).toBe('10');
  });

  it('a class selection stored for a different school never becomes the current class', () => {
    // Simulates a stale/foreign localStorage value from a previous school/session.
    setStoredSelectedClass('other-school', '7');
    schoolServiceSpy.getClasses.and.returnValue(of(['9', '10']));
    schoolServiceSpy.getManagedClasses.and.returnValue(of([
      { id: 1, name: '9', displayOrder: 1, active: true, streamEligible: false },
      { id: 2, name: '10', displayOrder: 2, active: true, streamEligible: false },
    ]));

    fixture.detectChanges();

    // Falls back to the first real configured class, never the foreign "7".
    expect(component.selectedClass).toBe('9');
    expect(component.selectedClass).not.toBe('7');
  });

  it('a stale stored class no longer present in the class list falls back to the first configured class', () => {
    setStoredSelectedClass('school-a', '1'); // never configured / since deleted
    schoolServiceSpy.getClasses.and.returnValue(of(['9', '10']));
    schoolServiceSpy.getManagedClasses.and.returnValue(of([
      { id: 1, name: '9', displayOrder: 1, active: true, streamEligible: false },
      { id: 2, name: '10', displayOrder: 2, active: true, streamEligible: false },
    ]));

    fixture.detectChanges();

    expect(component.selectedClass).toBe('9');
  });
});
