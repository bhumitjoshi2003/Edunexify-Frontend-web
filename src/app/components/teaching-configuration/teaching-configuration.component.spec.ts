import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';
import { TeachingConfigurationComponent } from './teaching-configuration.component';
import { ClassTeacherResponsibilityService } from '../../services/class-teacher-responsibility.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { TimetableService } from '../../services/timetable.service';
import { SectionService } from '../../services/section.service';
import { ToastService } from '../../services/toast.service';
import { ActivationPreview, Responsibility } from '../../interfaces/teaching-configuration';

const current = { id: 1, label: 'Current', startDate: '2020-01-01', endDate: '2999-01-01', current: true };
const future = { ...current, id: 2, label: 'Future', startDate: '2998-01-01', current: false };
const historical = { ...current, id: 3, label: 'Past', endDate: '2001-01-01', current: false };
const preview: ActivationPreview = { academicSessionId: 1, activationState: 'NEVER_APPLIED', inSync: true, hasIssues: false, lastAppliedAt: null, lastAppliedBy: null, becomingLive: 0, changing: 0, clearing: 0, unchanged: 0, ineligibleTeacher: 0, invalidClassOrSection: 0, details: [] };
const row: Responsibility = { id: 10, academicSessionId: 1, classId: 8, className: '8', sectionId: null, sectionName: null, configuredTeacherId: 'T1', configuredTeacherName: 'Teacher', liveTeacherId: null, liveTeacherName: null, liveMatchesConfigured: false };
describe('F6A responsibility management and activation', () => {
  let fixture: ComponentFixture<TeachingConfigurationComponent>;
  let c: TeachingConfigurationComponent;
  let service: any;
  let timetable: any;
  let toast: any;
  let academics: any;
  beforeEach(async () => {
    service = jasmine.createSpyObj('Responsibilities', ['list', 'create', 'update', 'delete', 'copy', 'preview', 'apply']);
    service.list.and.returnValue(of([row])); service.preview.and.returnValue(of(preview));
    service.apply.and.returnValue(of({ ...preview, activationState: 'APPLIED_IN_SYNC', applied: 0, cleared: 0 }));
    for (const name of ['create', 'update', 'delete', 'copy']) service[name].and.returnValue(of({}));
    timetable = { copySession: jasmine.createSpy().and.returnValue(of({})) };
    toast = { confirm: jasmine.createSpy().and.resolveTo(true) };
    academics = { getAllSessions: () => of([current, future, historical]), getCurrentSession: jasmine.createSpy().and.returnValue(of(current)) };
    await TestBed.configureTestingModule({ imports: [TeachingConfigurationComponent], providers: [
      { provide: ClassTeacherResponsibilityService, useValue: service }, { provide: TimetableService, useValue: timetable },
      { provide: AcademicSessionService, useValue: academics }, { provide: SectionService, useValue: { getSectionsForClass: () => of([]) } },
      { provide: ToastService, useValue: toast }
    ] }).compileComponents();
    fixture = TestBed.createComponent(TeachingConfigurationComponent); c = fixture.componentInstance;
    fixture.componentRef.setInput('session', current); fixture.detectChanges();
  });
  it('renders NEVER_APPLIED separately from inSync=true', () => {
    c.loadPreview(); fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Never Applied'); expect(text).toContain('In Sync');
    expect(service.apply).not.toHaveBeenCalled();
  });
  it('renders drift, provenance, gains, changes, removals and issues', () => {
    service.preview.and.returnValue(of({ ...preview, activationState: 'APPLIED_BUT_DRIFTED', inSync: false, becomingLive: 2, changing: 3, clearing: 4, hasIssues: true, ineligibleTeacher: 1, lastAppliedBy: 'admin', lastAppliedAt: '2026-09-01T10:00:00', details: [{ className: '8', outcome: 'INELIGIBLE_TEACHER', reason: 'Teacher is inactive' }] }));
    c.loadPreview(); fixture.detectChanges(); const text = fixture.nativeElement.textContent;
    for (const expected of ['Applied · Drifted', 'Gains 2', 'changes 3', 'removals 4', 'admin', '1 ineligible teacher', 'Teacher is inactive']) expect(text).toContain(expected);
  });
  it('requires explicit confirmation before apply, even if in sync', async () => {
    c.loadPreview(); await c.apply(); expect(toast.confirm).toHaveBeenCalled(); expect(service.apply).toHaveBeenCalledTimes(1);
  });
  it('does not apply on cancelled confirmation', async () => { toast.confirm.and.resolveTo(false); c.loadPreview(); await c.apply(); expect(service.apply).not.toHaveBeenCalled(); });
  it('rechecks current-session authority before apply', async () => {
    academics.getCurrentSession.and.returnValue(of(future)); c.loadPreview(); await c.apply();
    expect(service.apply).not.toHaveBeenCalled(); expect(c.error).toContain('current session changed');
  });
  it('rejects preview from a different current session', () => { service.preview.and.returnValue(of({ ...preview, academicSessionId: 2 })); c.loadPreview(); expect(c.preview).toBeNull(); });
  for (const session of [future, historical]) {
    it(`hides and blocks activation for ${session.label}`, async () => {
      fixture.componentRef.setInput('session', session); fixture.detectChanges(); c.loadPreview(); await c.apply();
      expect(service.preview).not.toHaveBeenCalled(); expect(service.apply).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).not.toContain('Resync Class Teachers');
    });
  }
  it('offers only ACTIVE teachers for a class-teacher responsibility (LEFT/UPCOMING never selectable)', () => {
    fixture.componentRef.setInput('teachers', [
      { teacherId: 'T1', name: 'Active One', status: 'ACTIVE' },
      { teacherId: 'T9', name: 'Left One', status: 'LEFT' },
      { teacherId: 'T8', name: 'Upcoming One', status: 'UPCOMING' },
    ] as any);
    fixture.detectChanges();
    expect(c.eligibleTeachers.map((t) => t.teacherId)).toEqual(['T1']);
    const options = [...fixture.nativeElement.querySelectorAll('option')].map((o: HTMLOptionElement) => o.textContent?.trim());
    expect(options).toContain('Active One (T1)');
    expect(options.some((o) => o?.includes('T9') || o?.includes('T8'))).toBeFalse();
  });
  it('creates and updates canonical responsibility configuration', () => {
    c.classId = 8; c.teacherId = 'T1'; c.sectionsLoaded = true; c.save();
    expect(service.create).toHaveBeenCalledWith({ academicSessionId: 1, classId: 8, sectionId: null, teacherId: 'T1' });
    c.edit(row); c.save(); expect(service.update).toHaveBeenCalledWith(10, { academicSessionId: 1, classId: 8, sectionId: null, teacherId: 'T1' });
  });
  it('deletes selected-session responsibility after confirmation', async () => { await c.remove(row); expect(service.delete).toHaveBeenCalledWith(10, 1); });
  it('blocks historical and no-session configuration writes', () => {
    for (const session of [historical, null]) { fixture.componentRef.setInput('session', session); fixture.detectChanges(); c.classId = 8; c.teacherId = 'T1'; c.sectionsLoaded = true; c.save(); expect(c.canSave()).toBeFalse(); }
    expect(service.create).not.toHaveBeenCalled();
  });
  it('requires explicit distinct copy sessions and disallows historical targets', () => {
    c.sourceId = 1; c.targetId = 1; expect(c.canCopy()).toBeFalse(); c.targetId = 3; expect(c.canCopy()).toBeFalse();
    c.sourceId = 3; c.targetId = 2; expect(c.canCopy()).toBeTrue();
  });
  it('copies historical timetable to current with confirmed flag', async () => {
    c.sourceId = 3; c.targetId = 1; await c.copy('timetable');
    expect(timetable.copySession).toHaveBeenCalledWith({ sourceAcademicSessionId: 3, targetAcademicSessionId: 1, confirmCurrentTarget: true });
  });
  it('copies responsibilities to future without live activation', async () => {
    c.sourceId = 1; c.targetId = 2; await c.copy('responsibilities');
    expect(service.copy).toHaveBeenCalledWith({ sourceAcademicSessionId: 1, targetAcademicSessionId: 2 }); expect(service.apply).not.toHaveBeenCalled();
  });

  // ─── Shared by the web and Android clients — keep the two copies identical. ───
  it('future writable session: responsibilities can be configured but not activated', async () => {
    fixture.componentRef.setInput('session', future); fixture.detectChanges();
    c.classId = 8; c.teacherId = 'T1'; c.sectionsLoaded = true;
    expect(c.canSave()).toBeTrue();
    c.save();
    expect(service.create).toHaveBeenCalledWith({ academicSessionId: 2, classId: 8, sectionId: null, teacherId: 'T1' });
    c.loadPreview(); await c.apply();
    expect(service.apply).not.toHaveBeenCalled();
  });
  it('an invalid section choice blocks saving; a server rejection (e.g. ineligible teacher) is shown', () => {
    c.classId = 8; c.teacherId = 'T1'; c.sectionsLoaded = true;
    c.sections = [{ id: 81, name: 'A', active: true } as any];
    c.sectionId = 99;
    expect(c.canSave()).toBeFalse();
    c.sectionId = 81;
    service.create.and.returnValue(throwError(() => ({ status: 400, error: { message: 'Teacher is not eligible for this class.' } })));
    c.save();
    expect(c.error).toContain('Teacher is not eligible');
    expect(c.busy).toBeFalse();
  });
  it('switching session while a delete confirmation is open cancels the delete', async () => {
    let resolve!: (v: boolean) => void;
    toast.confirm.and.returnValue(new Promise<boolean>(r => (resolve = r)));
    const pending = c.remove(row);
    fixture.componentRef.setInput('session', future); fixture.detectChanges();
    resolve(true); await pending;
    expect(service.delete).not.toHaveBeenCalled();
  });
  it('actions are gated while an operation is running', () => {
    const inFlight = new Subject<any>();
    service.create.and.returnValue(inFlight);
    c.classId = 8; c.teacherId = 'T1'; c.sectionsLoaded = true; c.save();
    expect(c.busy).toBeTrue();
    expect(c.canWrite()).toBeFalse();
    c.sourceId = 3; c.targetId = 2;
    expect(c.canCopy()).toBeFalse();
    inFlight.next({}); inFlight.complete();
    expect(c.busy).toBeFalse();
  });
  it('activation applies only after the current session is rechecked, and reports the result', async () => {
    c.loadPreview();
    expect(c.preview).not.toBeNull();
    await c.apply();
    expect(academics.getCurrentSession).toHaveBeenCalled();
    expect(service.apply).toHaveBeenCalled();
    expect(c.applied?.activationState).toBe('APPLIED_IN_SYNC');
  });
});

/** B4-6: the panel lives inside the OnPush TimetableComponent. Every async result must render on the
 *  next check without any other event marking the host dirty. */
@Component({
  selector: 'app-onpush-host', standalone: true, imports: [TeachingConfigurationComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-teaching-configuration [session]="session" [classes]="classes" [teachers]="teachers" />'
})
class OnPushHostComponent {
  session = current;
  classes = [{ id: 11, name: 'Class 11', displayOrder: 1, active: true, streamEligible: true }] as any[];
  teachers = [{ teacherId: 'T3', name: 'Meera', status: 'ACTIVE' }] as any[];
}

/** A test fixture's root view is refreshed on every detectChanges(), so the OnPush host sits one
 *  level down — as TimetableComponent does under the dashboard. */
@Component({ standalone: true, imports: [OnPushHostComponent], template: '<app-onpush-host />' })
class PageComponent {}

describe('B4-6 teaching configuration renders async results inside an OnPush host', () => {
  let fixture: ComponentFixture<PageComponent>;
  let panel: TeachingConfigurationComponent;
  let service: any;
  let sections$: Subject<any[]>;
  let rows: Responsibility[] = [];
  let toast: any;
  const text = () => fixture.nativeElement.textContent as string;
  const sectionOptions = () => Array.from(fixture.nativeElement.querySelectorAll('fieldset.tc-form select')[1].options).map((o: any) => o.textContent.trim());
  const science = { id: 5, classId: 11, name: 'Science', active: true };
  const commerce = { id: 6, classId: 11, name: 'Commerce', active: true };
  const configured: Responsibility = { ...row, id: 20, classId: 11, className: 'Class 11', sectionId: 5, sectionName: 'Science', configuredTeacherId: 'T3', configuredTeacherName: 'Meera', liveMatchesConfigured: true };

  beforeEach(async () => {
    sections$ = new Subject(); rows = [];
    service = jasmine.createSpyObj('Responsibilities', ['list', 'create', 'update', 'delete', 'copy', 'preview', 'apply']);
    service.list.and.callFake(() => of(rows));   // HTTP-like: emits the current rows, then completes
    toast = { confirm: jasmine.createSpy().and.resolveTo(true) };
    await TestBed.configureTestingModule({ imports: [PageComponent], providers: [
      { provide: ClassTeacherResponsibilityService, useValue: service }, { provide: TimetableService, useValue: {} },
      { provide: AcademicSessionService, useValue: { getAllSessions: () => of([current]), getCurrentSession: () => of(current) } },
      { provide: SectionService, useValue: { getSectionsForClass: () => sections$ } },
      { provide: ToastService, useValue: toast }
    ] }).compileComponents();
    fixture = TestBed.createComponent(PageComponent);
    fixture.detectChanges();
    // Settle: NgModel writes initial values in a microtask and then marks the host for check, so
    // wait for that before the final pass — from here on the OnPush host is clean, as in the app.
    await fixture.whenStable(); fixture.detectChanges();
    panel = fixture.debugElement.query(By.directive(TeachingConfigurationComponent)).componentInstance;
  });

  it('renders a class\'s sections as soon as they arrive, and enables Save once valid', () => {
    panel.classId = 11; panel.classChanged();
    sections$.next([science, commerce]); fixture.detectChanges();
    expect(sectionOptions()).toEqual(['Select section', 'Science', 'Commerce']);
    const [, sectionSelect, teacherSelect] = fixture.nativeElement.querySelectorAll('fieldset.tc-form select');
    sectionSelect.selectedIndex = 1; sectionSelect.dispatchEvent(new Event('change'));
    teacherSelect.selectedIndex = 1; teacherSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(panel.sectionId).toBe(5); expect(panel.teacherId).toBe('T3');
    const save = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b: any) => b.textContent.includes('Save responsibility')) as HTMLButtonElement;
    expect(save.disabled).toBeFalse();
  });

  it('renders an added row, an edited row and a removed row immediately', async () => {
    service.create.and.returnValue(of(configured));
    panel.classId = 11; panel.classChanged(); sections$.next([science, commerce]);
    rows = [configured];
    panel.sectionId = 5; panel.teacherId = 'T3'; panel.save();
    fixture.detectChanges();
    expect(text()).toContain('Class 11 / Science');

    service.update.and.returnValue(of({ ...configured, sectionId: 6, sectionName: 'Commerce' }));
    rows = [{ ...configured, sectionId: 6, sectionName: 'Commerce' }];
    panel.edit(configured); sections$.next([science, commerce]); panel.sectionId = 6; panel.save();
    fixture.detectChanges();
    expect(text()).toContain('Class 11 / Commerce');
    expect(text()).not.toContain('Class 11 / Science');

    service.delete.and.returnValue(of(undefined));
    rows = [];
    await panel.remove(configured);
    fixture.detectChanges();
    expect(text()).not.toContain('Class 11 / Commerce');
  });

  it('renders the resync preview as soon as it arrives', () => {
    const preview$ = new Subject<ActivationPreview>();
    service.preview.and.returnValue(preview$);
    panel.loadPreview();
    preview$.next(preview); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tc-preview')).not.toBeNull();
    expect(text()).toContain('In Sync');
    expect(text()).toContain('removals 0');
  });

  it('renders a failed save\'s error immediately', () => {
    service.create.and.returnValue(throwError(() => ({ error: { message: 'This class/section is already configured.' } })));
    panel.classId = 11; panel.classChanged(); sections$.next([science]);
    panel.sectionId = 5; panel.teacherId = 'T3'; panel.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tc-error')?.textContent).toContain('already configured');
  });
});
