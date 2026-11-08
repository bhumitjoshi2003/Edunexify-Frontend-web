import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PrincipalManagementComponent } from './principal-management.component';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';

describe('Principal profile and readable ID', () => {
  let fixture: ComponentFixture<PrincipalManagementComponent>, component: PrincipalManagementComponent;
  let http: HttpTestingController, toast: jasmine.SpyObj<ToastService>;
  const endpoint = `${environment.apiUrl}/principals`;
  const current = {
    userId: 'principal-legacy', loginId: 'pri_26010001', name: 'Meera Sharma', email: 'meera@example.test', active: true, photoUrl: null,
    details: { gender: 'Female', dob: '1975-04-02', phoneNumber: '9876543210', alternatePhoneNumber: null, address: null, city: 'Pune', state: null,
      pinCode: null, qualification: 'M.Ed.', specialization: null, experienceYears: 22, previousInstitution: null, joiningDate: '2024-06-01', employmentType: 'PERMANENT' },
  };

  beforeEach(async () => {
    toast = jasmine.createSpyObj('ToastService', ['confirm', 'success', 'warning', 'error']); toast.confirm.and.resolveTo(true);
    await TestBed.configureTestingModule({
      imports: [PrincipalManagementComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    }).compileComponents();
    fixture = TestBed.createComponent(PrincipalManagementComponent); component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController); fixture.detectChanges();
  });
  afterEach(() => { http.verify(); fixture.destroy(); });

  it('shows the readable Principal ID and profile details, and edits with the internal identity', async () => {
    http.expectOne(endpoint).flush([current]); http.expectOne(`${endpoint}/current/history`).flush([]); fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('pri_26010001');
    expect(text).not.toContain('principal-legacy');
    expect(text).toContain('M.Ed.');
    expect(text).toContain('Permanent');

    component.open('edit'); component.details.city = '  Mumbai '; component.details.experienceYears = null; await component.submit();
    const request = http.expectOne(`${endpoint}/current`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.expectedUserId).toBe('principal-legacy');
    expect(request.request.body.details).toEqual(jasmine.objectContaining({ city: 'Mumbai', experienceYears: null, phoneNumber: '9876543210', gender: 'Female' }));
    request.flush({ ...current, details: { ...current.details, city: 'Mumbai' } }); http.expectOne(`${endpoint}/current/history`).flush([]);
  });

  it('appoints a Principal with only the entered optional details and blocks invalid numbers', async () => {
    http.expectOne(endpoint).flush([]); http.expectOne(`${endpoint}/current/history`).flush([]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No Principal appointed yet');

    component.open('create'); component.name = 'Meera Sharma'; component.email = 'meera@example.test'; component.details.phoneNumber = '12345';
    await component.submit();
    expect(component.error).toContain('10 digits'); http.expectNone(endpoint);

    component.details.phoneNumber = '9876543210'; component.details.qualification = 'M.Ed.'; await component.submit();
    const request = http.expectOne(r => r.method === 'POST' && r.url === endpoint);
    expect(request.request.body.details.phoneNumber).toBe('9876543210');
    expect(request.request.body.details.qualification).toBe('M.Ed.');
    expect(request.request.body.details.city).toBeNull();
    request.flush({ ...current, userId: 'pri_26010002', loginId: 'pri_26010002' }); http.expectOne(`${endpoint}/current/history`).flush([]);
    expect(toast.success).toHaveBeenCalledWith('Principal appointed · pri_26010002');
  });

  it('separates current and previous appointments in the history view', () => {
    http.expectOne(endpoint).flush([current]);
    http.expectOne(`${endpoint}/current/history`).flush([
      { id: 2, userId: 'principal-legacy', loginId: 'pri_26010001', name: 'Meera Sharma', email: 'm@example.test', appointedAt: '2025-06-01T09:00:00', endedAt: null, appointedBy: 'emp_25010001', endedBy: null, reason: null },
      { id: 1, userId: 'principal-old', loginId: null, name: 'Former Head', email: 'f@example.test', appointedAt: '2020-04-01T09:00:00', endedAt: '2025-06-01T09:00:00', appointedBy: null, endedBy: 'emp_25010001', reason: 'Retired' },
    ]);
    component.tab = 'history'; fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(component.currentAppointment?.id).toBe(2);
    expect(text).toContain('Former Head');
    expect(text).toContain('Retired');
    expect(text).toContain('principal-old');
  });
});
