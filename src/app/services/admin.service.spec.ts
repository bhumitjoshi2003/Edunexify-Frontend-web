import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AdminService } from './admin.service';
import { environment } from '../../environments/environment';

/**
 * Covers the Phase 2 direct-to-object-storage upload flow's client-side contract for admin
 * photos — see teacher.service.spec.ts for the exhaustive version of this same shared contract.
 */
describe('AdminService — uploadAdminPhotoDirect', () => {
  let service: AdminService;
  let http: HttpTestingController;

  const uploadRequestUrl = `${environment.apiUrl}/files/upload-request`;
  const completeUrl = `${environment.apiUrl}/files/complete`;
  const presignedPutUrl = 'https://object-storage.example.com/bucket/schools/1/admins/A1/profile/uuid.jpg?X-Amz-Signature=abc';

  const uploadRequestResponse = {
    objectKey: 'schools/1/admins/A1/profile/uuid.jpg',
    uploadUrl: presignedPutUrl,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    requiredHeaders: { 'Content-Type': 'image/jpeg' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function aFile(): File {
    return new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' });
  }

  it('requests a presigned upload URL first, with ADMIN_PROFILE_PHOTO purpose and the correct entityId', () => {
    service.uploadAdminPhotoDirect('A1', aFile()).subscribe();

    const req = http.expectOne(uploadRequestUrl);
    expect(req.request.body).toEqual({
      purpose: 'ADMIN_PROFILE_PHOTO',
      entityId: 'A1',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      size: aFile().size,
    });

    req.flush(uploadRequestResponse);
    http.expectOne(presignedPutUrl).flush({});
    http.expectOne(completeUrl).flush({ objectKey: uploadRequestResponse.objectKey, displayUrl: 'https://object-storage.example.com/signed-get' });
  });

  it('PUTs the file directly to object storage — never through our own backend', () => {
    const file = aFile();
    service.uploadAdminPhotoDirect('A1', file).subscribe();
    http.expectOne(uploadRequestUrl).flush(uploadRequestResponse);

    const putReq = http.expectOne(presignedPutUrl);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toBe(file);
    expect(putReq.request.url).not.toContain(environment.apiUrl);

    putReq.flush({});
    http.expectOne(completeUrl).flush({ objectKey: uploadRequestResponse.objectKey, displayUrl: 'https://object-storage.example.com/signed-get' });
  });

  it('calls completion only after the direct PUT succeeds, with the exact objectKey/entityId', () => {
    service.uploadAdminPhotoDirect('A1', aFile()).subscribe();
    http.expectOne(uploadRequestUrl).flush(uploadRequestResponse);
    http.expectOne(presignedPutUrl).flush({});

    const completeReq = http.expectOne(completeUrl);
    expect(completeReq.request.body).toEqual({
      objectKey: uploadRequestResponse.objectKey,
      purpose: 'ADMIN_PROFILE_PHOTO',
      entityId: 'A1',
    });
    completeReq.flush({ objectKey: uploadRequestResponse.objectKey, displayUrl: 'https://object-storage.example.com/signed-get' });
  });

  it('a failed direct PUT propagates as an error and never calls completion', () => {
    let sawError = false;
    service.uploadAdminPhotoDirect('A1', aFile()).subscribe({ error: () => { sawError = true; } });

    http.expectOne(uploadRequestUrl).flush(uploadRequestResponse);
    http.expectOne(presignedPutUrl).flush('storage error', { status: 500, statusText: 'Internal Server Error' });

    expect(sawError).toBeTrue();
    http.expectNone(completeUrl);
  });

  it('the legacy multipart upload method no longer exists on the service (Phase 3 cleanup)', () => {
    expect((service as any).uploadAdminPhoto).toBeUndefined();
  });

  it('create whitelists normalized fields and explicit school assignment', () => {
    service.createAdmin({ adminId: ' A1 ', name: ' Admin ', email: ' A@EXAMPLE.COM ', phoneNumber: '9876543210', dob: '1990-01-01', gender: 'Male', schoolId: 1, photoUrl: 'forged', createdAt: 'forged' }).subscribe();
    const req = http.expectOne(environment.apiUrl + '/admins'); expect(req.request.body.adminId).toBe('A1'); expect(req.request.body.email).toBe('a@example.com');
    expect(req.request.body.schoolId).toBe(1); expect(req.request.body.photoUrl).toBeUndefined(); expect(req.request.body.createdAt).toBeUndefined(); req.flush({});
  });
  it('update uses path identity and strips tenant, identity and response metadata', () => {
    service.updateAdmin('A1', { adminId: 'A2', name: ' Admin ', email: ' NEW@EXAMPLE.COM ', phoneNumber: '9876543210', dob: '1990-01-01', gender: 'Male', schoolId: 2, photoUrl: 'signed' }).subscribe();
    const req = http.expectOne(environment.apiUrl + '/admins/A1'); expect(req.request.body.email).toBe('new@example.com');
    for (const field of ['adminId','schoolId','photoUrl','createdAt','updatedAt']) expect(req.request.body[field]).toBeUndefined(); req.flush({});
  });
});
