import { FeeAssignmentComponent } from './fee-assignment.component';
describe('Fee Assignment school policy authority', () => {
  it('does not send a per-request school-policy override', () => {
    const c = new FeeAssignmentComponent({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    c.session = '2026-2027'; c.selected.add('S1'); c.selectedMonths.add(1);
    c.assignForm.effectiveDate = '2026-10-16';
    const request = (c as any).request();
    expect(request.midSessionPolicy).toBeUndefined();
  });
});
