import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ClassManagementComponent } from './class-management.component';
import { SchoolService } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('ClassManagementComponent — section removal', () => {
  let sectionService: any;
  let toast: any;
  let c: ClassManagementComponent;

  beforeEach(() => {
    sectionService = jasmine.createSpyObj('SectionService', ['deleteSection']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'warning', 'error', 'confirm']);
    TestBed.configureTestingModule({
      imports: [ClassManagementComponent],
      providers: [
        { provide: SchoolService, useValue: {} },
        { provide: SectionService, useValue: sectionService },
        { provide: AuthStateService, useValue: { getUser: () => ({ role: 'ADMIN' }) } },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: toast },
      ],
    });
    TestBed.overrideComponent(ClassManagementComponent, { set: { template: '' } });
    c = TestBed.createComponent(ClassManagementComponent).componentInstance;   // ngOnInit not run
    c.classSections.set(9, [{ id: 91, name: 'A' } as any, { id: 92, name: 'B' } as any]);
  });

  const flush = () => new Promise((r) => setTimeout(r));

  it('removing a section with assigned students says how many were cleared', async () => {
    toast.confirm.and.returnValue(Promise.resolve(true));
    sectionService.deleteSection.and.returnValue(of({ affected: 3 }));
    c.removeSection(9, { id: 91, name: 'A' } as any);
    await flush();
    expect(sectionService.deleteSection).toHaveBeenCalledWith(91);
    expect(c.classSections.get(9)!.map((s) => s.name)).toEqual(['B']);
    expect(toast.warning).toHaveBeenCalledWith('Section Removed', 'Section "A" removed. 3 students\' section assignment was cleared.');
  });

  it('cancelling removes nothing', async () => {
    toast.confirm.and.returnValue(Promise.resolve(false));
    c.removeSection(9, { id: 91, name: 'A' } as any);
    await flush();
    expect(toast.confirm.calls.mostRecent().args[0].cancelText).toBe('Cancel');
    expect(sectionService.deleteSection).not.toHaveBeenCalled();
    expect(c.classSections.get(9)!.length).toBe(2);
  });
});
