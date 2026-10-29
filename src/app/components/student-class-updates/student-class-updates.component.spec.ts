import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthStateService } from '../../auth/auth-state.service';
import { ParentPortalService } from '../../services/parent-portal.service';
import { StudentClassUpdatesComponent } from './student-class-updates.component';
import { ClassUpdateService } from '../../services/class-update.service';
import { LoggerService } from '../../services/logger.service';
import { ClassUpdate } from '../../interfaces/class-update';

describe('StudentClassUpdatesComponent', () => {
  let role = 'STUDENT';
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const child = (studentId: string, studentName: string): any => ({
    relationshipId: 1, studentId, studentName, className: '9', sectionName: 'A', relationshipType: 'FATHER', primaryGuardian: true,
    canViewAttendance: true, canViewFees: true, canPayFees: true, canViewResults: true, canViewTimetable: true, canManageLeave: true,
    effectiveFrom: '2026-04-01', effectiveUntil: null,
  });
  let fixture: ComponentFixture<StudentClassUpdatesComponent>;
  let component: StudentClassUpdatesComponent;
  let service: jasmine.SpyObj<ClassUpdateService>;

  const item = (overrides: Partial<ClassUpdate> = {}): ClassUpdate => ({
    id: 1, classId: 8, className: '8', sectionId: 3, sectionName: 'A', subjectName: 'Science',
    teacherId: 'T1', teacherName: 'Ms Rao', title: 'Unit test Friday', message: 'Chapters 3 and 4.',
    attachment: null, expiresAt: null, expired: false,
    createdAt: '2026-09-23T09:00:00', updatedAt: '2026-09-23T09:00:00', canEdit: false, ...overrides,
  });

  beforeEach(() => {
    role = 'STUDENT';
    query = new BehaviorSubject(convertToParamMap({}));
    service = jasmine.createSpyObj('ClassUpdateService', ['studentActive']);
    TestBed.configureTestingModule({
      imports: [StudentClassUpdatesComponent],
      providers: [
        { provide: ClassUpdateService, useValue: service },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { get queryParamMap() { return query; } } },
        { provide: AuthStateService, useValue: { getUserRole: () => role, getUserId: () => 'U1' } },
        { provide: ParentPortalService, useValue: { getMyProfile: () => of({ children: [child('S1', 'Aarav'), child('S3', 'Kabir')] }) } },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
      ],
    });
    fixture = TestBed.createComponent(StudentClassUpdatesComponent);
    component = fixture.componentInstance;
  });

  it('shows title, teacher, class/subject, message, posted time and expiry', () => {
    service.studentActive.and.returnValue(of([item({ expiresAt: new Date(Date.now() + 2 * 24 * 3600_000 + 60_000).toISOString() })]));
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(service.studentActive).toHaveBeenCalledOnceWith(undefined, null);
    expect(text).toContain('Unit test Friday');
    expect(text).toContain('Ms Rao');
    expect(fixture.nativeElement.querySelector('.scu-chip.is-subject').textContent).toContain('Science');
    expect(fixture.nativeElement.querySelector('.scu-chip.is-class').textContent).toContain('Class 8 – A');
    expect(text).toContain('Chapters 3 and 4.');
    expect(text).toContain('Posted');
    expect(text).toContain('Ends in 2d');
    expect(fixture.nativeElement.querySelector('.scu-hero').textContent).toContain('Updates from your teachers.');
  });

  it('shows a class-wide update without a subject', () => {
    service.studentActive.and.returnValue(of([item({ subjectName: null, sectionName: null })]));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.scu-chip.is-class').textContent.trim()).toContain('Class 8');
    expect(fixture.nativeElement.querySelector('.scu-chip.is-subject')).toBeNull();
  });

  it('links an image thumbnail or PDF tile to the attachment', () => {
    service.studentActive.and.returnValue(of([
      item({ attachment: { fileName: 'diagram.png', contentType: 'image/png', fileSize: 2048, type: 'IMAGE', url: 'https://cdn/img.png', objectKey: null } }),
      item({ id: 2, attachment: { fileName: 'sheet.pdf', contentType: 'application/pdf', fileSize: 3 * 1024 * 1024, type: 'PDF', url: 'https://cdn/sheet.pdf', objectKey: null } }),
    ]));
    fixture.detectChanges();
    const media = fixture.nativeElement.querySelector('.scu-media');
    expect(media.querySelector('img').getAttribute('src')).toBe('https://cdn/img.png');
    const pdf = fixture.nativeElement.querySelector('.scu-file');
    expect(pdf.getAttribute('href')).toBe('https://cdn/sheet.pdf');
    expect(pdf.querySelector('.scu-pdf')).toBeTruthy();
    expect(pdf.textContent).toContain('3.0 MB');
  });

  it('filters by subject when updates span several subjects', () => {
    service.studentActive.and.returnValue(of([item(), item({ id: 2, subjectName: 'Maths', title: 'Maths quiz' })]));
    fixture.detectChanges();
    expect(component.subjects).toEqual(['Science', 'Maths']);
    const maths = Array.from(fixture.nativeElement.querySelectorAll('.scu-filters button') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent!.includes('Maths'))!;
    maths.click();
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.scu-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('Maths quiz');
  });

  it('shows empty and error states with retry', () => {
    service.studentActive.and.returnValue(of([]));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No class updates right now.');

    service.studentActive.and.returnValue(throwError(() => new Error('offline')));
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('temporarily unavailable');
  });
  it('a parent reads the linked child named in the URL, switches child, and sees no posting controls', () => {
    service.studentActive.and.returnValue(of([item()]));
    role = 'PARENT';
    query.next(convertToParamMap({ studentId: 'S3' }));
    const parentFixture = TestBed.createComponent(StudentClassUpdatesComponent);
    parentFixture.detectChanges();
    expect(service.studentActive).toHaveBeenCalledWith(undefined, 'S3');
    const el = parentFixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.child-tab').length).toBe(2);
    expect(el.textContent).toContain("Updates from your child's teachers");
    expect(el.textContent).not.toMatch(/Post |Edit|Delete|Publish/);

    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    el.querySelectorAll<HTMLButtonElement>('.child-tab')[0].click();
    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { studentId: 'S1' } }));
    query.next(convertToParamMap({ studentId: 'S1' }));
    expect(service.studentActive).toHaveBeenCalledWith(undefined, 'S1');
  });

  it('a parent refused for a child (unlinked or ended link) sees only the switcher, not an error page', () => {
    service.studentActive.and.returnValue(throwError(() => ({ status: 403 })));
    role = 'PARENT';
    query.next(convertToParamMap({ studentId: 'S2' }));
    const parentFixture = TestBed.createComponent(StudentClassUpdatesComponent);
    parentFixture.detectChanges();
    const el = parentFixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('You no longer have access to this student.');
    expect(el.querySelector('.scu-hero')).toBeNull();
    expect(el.textContent).not.toContain('temporarily unavailable');
  });

  it('a student never sends a student id', () => {
    service.studentActive.and.returnValue(of([]));
    fixture.detectChanges();
    expect(service.studentActive).toHaveBeenCalledWith(undefined, null);
  });
});
