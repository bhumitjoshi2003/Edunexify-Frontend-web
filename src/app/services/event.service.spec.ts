import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { EventService } from './event.service';
import { environment } from '../../environments/environment';

describe('EventService', () => {
  let service: EventService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(EventService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /**
   * Covers the Phase 2 direct-to-object-storage upload flow, replacing the retired
   * POST /api/files/uploadEventImage. See teacher.service.spec.ts for the exhaustive version of
   * this same shared contract — this file focuses on EVENT_IMAGE's own quirk: the "new" sentinel
   * entityId used when uploading an image before the event itself has been created.
   */
  describe('uploadEventImageDirect', () => {
    const uploadRequestUrl = `${environment.apiUrl}/files/upload-request`;
    const completeUrl = `${environment.apiUrl}/files/complete`;
    const presignedPutUrl = 'https://object-storage.example.com/bucket/schools/1/events/5/images/uuid.jpg?X-Amz-Signature=abc';

    const uploadRequestResponse = {
      objectKey: 'schools/1/events/5/images/uuid.jpg',
      uploadUrl: presignedPutUrl,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      requiredHeaders: { 'Content-Type': 'image/jpeg' },
    };

    function aFile(): File {
      return new File(['fake-image-bytes'], 'banner.jpg', { type: 'image/jpeg' });
    }

    it('uses the real event id as entityId when replacing an existing event\'s image', () => {
      service.uploadEventImageDirect(aFile(), 5).subscribe();

      const req = http.expectOne(uploadRequestUrl);
      expect(req.request.body).toEqual({
        purpose: 'EVENT_IMAGE',
        entityId: '5',
        fileName: 'banner.jpg',
        contentType: 'image/jpeg',
        size: aFile().size,
      });

      req.flush(uploadRequestResponse);
      http.expectOne(presignedPutUrl).flush({});
      http.expectOne(completeUrl).flush({ objectKey: uploadRequestResponse.objectKey, displayUrl: 'https://object-storage.example.com/signed-get' });
    });

    it('uses the "new" sentinel entityId when uploading before the event has been created', () => {
      service.uploadEventImageDirect(aFile(), null).subscribe();

      const req = http.expectOne(uploadRequestUrl);
      expect(req.request.body.entityId).toBe('new');

      req.flush({ ...uploadRequestResponse, objectKey: 'schools/1/events/new/images/uuid.jpg' });
      http.expectOne('https://object-storage.example.com/bucket/schools/1/events/5/images/uuid.jpg?X-Amz-Signature=abc').flush({});
      const completeReq = http.expectOne(completeUrl);
      expect(completeReq.request.body.entityId).toBe('new');
      completeReq.flush({ objectKey: 'schools/1/events/new/images/uuid.jpg', displayUrl: 'https://object-storage.example.com/signed-get' });
    });

    it('PUTs the file directly to object storage — never through our own backend', () => {
      const file = aFile();
      service.uploadEventImageDirect(file, 5).subscribe();
      http.expectOne(uploadRequestUrl).flush(uploadRequestResponse);

      const putReq = http.expectOne(presignedPutUrl);
      expect(putReq.request.method).toBe('PUT');
      expect(putReq.request.body).toBe(file);
      expect(putReq.request.url).not.toContain(environment.apiUrl);

      putReq.flush({});
      http.expectOne(completeUrl).flush({ objectKey: uploadRequestResponse.objectKey, displayUrl: 'https://object-storage.example.com/signed-get' });
    });

    it('a failed direct PUT propagates as an error and never calls completion', () => {
      let sawError = false;
      service.uploadEventImageDirect(aFile(), 5).subscribe({ error: () => { sawError = true; } });

      http.expectOne(uploadRequestUrl).flush(uploadRequestResponse);
      http.expectOne(presignedPutUrl).flush('storage error', { status: 500, statusText: 'Internal Server Error' });

      expect(sawError).toBeTrue();
      http.expectNone(completeUrl);
    });

    it('the legacy uploadEventImage method no longer exists on the service', () => {
      expect((service as any).uploadEventImage).toBeUndefined();
    });
  });
});

describe('Event write contract', () => {
  let api: EventService; let http: HttpTestingController;
  const event = { id: 99, schoolId: 2, createdBy: 'forged', title: 'Day', description: 'Info', startDate: '2026-10-18', category: 'School', targetAudience: ['ALL'] };
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); api = TestBed.inject(EventService); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('create sends retry ID and editable fields only', () => {
    api.createEvent(event, 'retry-id').subscribe(); const req = http.expectOne(environment.apiUrl + '/events');
    expect(req.request.body.id).toBeUndefined(); expect(req.request.body.schoolId).toBeUndefined(); expect(req.request.body.createdBy).toBeUndefined();
    expect(req.request.body.requestId).toBe('retry-id'); expect(req.request.body.endDate).toBeNull(); req.flush({});
  });
  it('update uses path identity and does not round-trip metadata', () => {
    api.updateEvent(10, event).subscribe(); const req = http.expectOne(environment.apiUrl + '/events/10');
    expect(req.request.body.id).toBeUndefined(); expect(req.request.body.schoolId).toBeUndefined(); expect(req.request.body.requestId).toBeUndefined();req.flush({});
  });
});
