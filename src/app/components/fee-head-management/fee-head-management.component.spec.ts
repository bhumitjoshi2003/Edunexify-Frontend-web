import { FeeHeadManagementComponent } from './fee-head-management.component';
import { of } from 'rxjs';
describe('fee head academic schedules', () => {
  function component() {
    return new FeeHeadManagementComponent(
      { getAllFeeHeads: () => of([]) } as any, {} as any, { error: () => {} } as any,
      { markForCheck: () => {} } as any,
      { getCurrentSession: () => of({ startDate: '2026-04-01' }) } as any);
  }
  it('uses academic month 1 for annual and months 1/7 for semi-annual', () => {
    const c = component(); c.ngOnInit();
    c.form.frequency = 'ANNUAL'; c.onFrequencyChange();
    expect([...c.selectedMonths]).toEqual([1]);
    c.form.frequency = 'SEMI_ANNUAL'; c.onFrequencyChange();
    expect([...c.selectedMonths]).toEqual([1, 7]);
    expect(c.allMonths[0].label).toBe('April 2026');
    expect(c.allMonths[6].label).toBe('October 2026');
  });
  it('preserves existing suspicious schedules when editing', () => {
    const c = component();
    c.openEdit({ id: 1, dueMonths: '[4,10]' } as any);
    expect([...c.selectedMonths]).toEqual([4, 10]);
  });
});
