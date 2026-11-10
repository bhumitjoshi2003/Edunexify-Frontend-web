import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { ApplyLeaveComponent } from './apply-leave.component';

/** Shared by the web and Android clients — keep the two copies identical. A parent confirms leave
 * for a named child; the submitted subject must be exactly the confirmed one. */
describe('ApplyLeaveComponent — parent confirmation', () => {
  let leaveService: any;
  let toast: any;
  let role: string;
  let resolveConfirm: (value: boolean) => void;
  let c: ApplyLeaveComponent;

  function futureWeekday(): string {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  beforeEach(() => {
    role = 'PARENT';
    leaveService = { applyLeave: jasmine.createSpy('applyLeave').and.returnValue(of('Leave applied')) };
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info', 'confirm']);
    toast.confirm.and.callFake(() => new Promise<boolean>((resolve) => { resolveConfirm = resolve; }));
    const authState = { getUserRole: () => role, getUserId: () => 'parent1' };
    c = new ApplyLeaveComponent(new FormBuilder(), leaveService, {} as any, authState as any,
      jasmine.createSpyObj('LoggerService', ['error']), jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck', 'detectChanges']),
      toast, { snapshot: { paramMap: new Map(), queryParamMap: new Map() }, params: of({}), queryParams: of({}) } as any,
      jasmine.createSpyObj('Router', ['navigate']), {} as any);
    (c as any).loadStudentLeaves = () => {};
    c.studentId = 'stu_A';
    c.studentName = 'Asha';
    c.leaves = [];
    c.leaveForm.setValue({ leaveDate: futureWeekday(), reason: 'Sick', otherReason: '' });
  });

  it('confirms and submits for the child named in the dialog', async () => {
    const pending = c.applyLeave();
    expect(toast.confirm.calls.mostRecent().args[0].title).toBe('Submit leave for Asha?');
    resolveConfirm(true);
    await pending;
    expect(leaveService.applyLeave).toHaveBeenCalledWith(jasmine.objectContaining({ reason: 'Sick' }), 'stu_A');
  });

  it('child switched to B while the dialog is open: nothing is submitted, never silently for B', async () => {
    const pending = c.applyLeave();
    c.studentId = 'stu_B';
    c.studentName = 'Bharat';
    resolveConfirm(true);
    await pending;
    expect(leaveService.applyLeave).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('Leave not submitted', jasmine.stringMatching(/Asha/));
  });

  it('the date and reason are those shown in the dialog, even if the form changes meanwhile', async () => {
    const pending = c.applyLeave();
    const shownMessage: string = toast.confirm.calls.mostRecent().args[0].message;
    c.leaveForm.patchValue({ reason: 'Family function' });
    resolveConfirm(true);
    await pending;
    const [request] = leaveService.applyLeave.calls.mostRecent().args;
    expect(request.reason).toBe('Sick');
    expect(shownMessage).toContain(request.leaveDate);
  });

  it('cancel submits nothing', async () => {
    const pending = c.applyLeave();
    resolveConfirm(false);
    await pending;
    expect(leaveService.applyLeave).not.toHaveBeenCalled();
  });

  it('a student submits directly, without a parent confirmation', async () => {
    role = 'STUDENT';
    await c.applyLeave();
    expect(toast.confirm).not.toHaveBeenCalled();
    expect(leaveService.applyLeave).toHaveBeenCalledWith(jasmine.any(Object), undefined);
  });
});
