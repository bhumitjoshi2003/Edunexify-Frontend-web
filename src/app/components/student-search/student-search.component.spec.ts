import { fakeAsync, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { StudentSearchComponent } from './student-search.component';
describe('StudentSearchComponent request recovery', () => {
  it('searches again after failure without recreating the component', fakeAsync(() => {
    const api = jasmine.createSpyObj('StudentService', ['searchStudents']);
    api.searchStudents.and.returnValues(throwError(() => new Error('offline')), of([{ studentId: 'S2', name: 'Second' }]));
    const c = new StudentSearchComponent(api, {} as any, { markForCheck: () => {} } as any);
    c.ngOnInit(); c.query = 'first'; c.onQueryChange(); tick(351);
    expect(c.error).toContain('Search failed');
    c.query = 'second'; c.onQueryChange(); tick(351);
    expect(api.searchStudents).toHaveBeenCalledTimes(2);
    expect(c.results[0].studentId).toBe('S2'); expect(c.error).toBeNull(); c.ngOnDestroy();
  }));
  it('clearing the query prevents an earlier request from restoring results', fakeAsync(() => {
    const old = new Subject<any[]>();
    const api = { searchStudents: () => old };
    const c = new StudentSearchComponent(api as any, {} as any, { markForCheck: () => {} } as any);
    c.ngOnInit(); c.query = 'first'; c.onQueryChange(); tick(351);
    c.clearSearch(); old.next([{ studentId: 'old' }]);
    expect(c.results).toEqual([]); expect(c.hasSearched).toBeFalse(); c.ngOnDestroy();
  }));
});
