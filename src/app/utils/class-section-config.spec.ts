import { Subject, of, throwError } from 'rxjs';
import { ClassSectionConfig, ClassSectionSources } from './class-section-config';
import { SchoolClass } from '../services/school.service';
import { Section } from '../interfaces/section';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('ClassSectionConfig', () => {
  const cls = (id: number, name: string): SchoolClass => ({ id, name, displayOrder: id, active: true, streamEligible: false });
  const sec = (id: number, name: string): Section => ({ id, name } as Section);
  let destroy$: Subject<void>;
  let changed: jasmine.Spy;
  let classes$: Subject<string[]>;
  let managed$: Subject<SchoolClass[]>;
  let sectionsByClass: Record<number, Subject<Section[]>>;
  let sources: ClassSectionSources;

  beforeEach(() => {
    destroy$ = new Subject<void>();
    changed = jasmine.createSpy('changed');
    classes$ = new Subject();
    managed$ = new Subject();
    sectionsByClass = { 1: new Subject(), 2: new Subject() };
    sources = {
      getClasses: () => classes$,
      getManagedClasses: () => managed$,
      getSectionsForClass: (id) => sectionsByClass[id],
    };
  });
  afterEach(() => destroy$.next());

  const make = () => { const c = new ClassSectionConfig(sources, changed, destroy$); c.load(); return c; };

  it('class list and managed classes load independently; each update re-renders', () => {
    const c = make();
    expect(c.classesState).toBe('loading');
    classes$.next(['1', '2']);
    expect(c.classesReady).toBeTrue();
    expect(c.managedState).toBe('loading');
    expect(changed).toHaveBeenCalled();
  });

  it('managed classes slow: a picked class waits, then gets its sections when they arrive', () => {
    const c = make();
    classes$.next(['1', '2']);
    c.selectClass('1');
    expect(c.sectionsState).toBe('waiting');
    expect(c.sectionsPending).toBeTrue();
    managed$.next([cls(1, '1'), cls(2, '2')]);
    expect(c.sectionsState).toBe('loading');
    sectionsByClass[1].next([sec(10, 'A')]);
    expect(c.sectionsState).toBe('ready');
    expect(c.sections.map((s) => s.name)).toEqual(['A']);
  });

  it('managed classes fail: sections are unavailable (failed), the class list still works, retry recovers', () => {
    sources.getManagedClasses = () => throwError(() => new Error('down'));
    const c = make();
    classes$.next(['1']);
    c.selectClass('1');
    expect(c.classesReady).toBeTrue();
    expect(c.managedState).toBe('failed');
    expect(c.sectionsState).toBe('failed');
    expect(c.anyFailed).toBeTrue();

    sources.getManagedClasses = () => of([cls(1, '1')]);
    c.retry();
    expect(c.managedState).toBe('ready');
    expect(c.sectionsState).toBe('loading');
  });

  it('class list fails: class controls are gated, retry reloads only what failed', () => {
    sources.getClasses = () => throwError(() => new Error('down'));
    const c = make();
    expect(c.classesState).toBe('failed');
    expect(c.classesReady).toBeFalse();
    sources.getClasses = () => of(['1']);
    c.retry();
    expect(c.classesReady).toBeTrue();
    expect(c.managedState).toBe('loading');
  });

  it('rapid class switching cancels the stale section request', () => {
    const c = make();
    managed$.next([cls(1, '1'), cls(2, '2')]);
    c.selectClass('1');
    c.selectClass('2');
    sectionsByClass[1].next([sec(10, 'Stale')]);
    expect(c.sections).toEqual([]);
    expect(c.sectionsState).toBe('loading');
    sectionsByClass[2].next([sec(20, 'B')]);
    expect(c.sections.map((s) => s.name)).toEqual(['B']);
  });

  it('a class with no managed entry has no sections; clearing the class clears them', () => {
    const c = make();
    managed$.next([cls(1, '1')]);
    c.selectClass('Unknown');
    expect(c.sectionsState).toBe('ready');
    expect(c.sections).toEqual([]);
    c.selectClass('');
    expect(c.sectionsState).toBe('idle');
    expect(c.sectionsReady).toBeTrue();
  });

  it('a section load failure is reported and retryable', () => {
    const c = make();
    managed$.next([cls(1, '1')]);
    c.selectClass('1');
    sectionsByClass[1].error(new Error('down'));
    expect(c.sectionsState).toBe('failed');
    sectionsByClass[1] = new Subject();
    c.retry();
    expect(c.sectionsState).toBe('loading');
  });
});
