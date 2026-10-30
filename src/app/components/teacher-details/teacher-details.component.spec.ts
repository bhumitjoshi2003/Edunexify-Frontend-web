import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { TeacherDetailsComponent } from './teacher-details.component';
import { TeacherService } from '../../services/teacher.service';
import { ToastService } from '../../services/toast.service';
import { baselineTestProviders } from '../../../testing/baseline-test-providers';

describe('TeacherDetailsComponent', () => {
  let component: TeacherDetailsComponent;
  let fixture: ComponentFixture<TeacherDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [...baselineTestProviders()],
      imports: [TeacherDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeacherDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

/**
 * Phase 1 direct-to-object-storage upload — client-side behavior around
 * TeacherService.uploadTeacherPhotoDirect. The actual presign/PUT/complete HTTP sequence is
 * covered in teacher.service.spec.ts; this suite covers what the component does with the
 * outcome (validation before ever calling the service, and UI state on success/failure).
 */
describe('TeacherDetailsComponent — photo upload (direct-to-object-storage)', () => {
  let component: TeacherDetailsComponent;
  let fixture: ComponentFixture<TeacherDetailsComponent>;
  let teacherService: jasmine.SpyObj<TeacherService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    teacherService = jasmine.createSpyObj('TeacherService', ['uploadTeacherPhotoDirect']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);

    await TestBed.configureTestingModule({
      imports: [TeacherDetailsComponent],
      providers: [
        ...baselineTestProviders(),
        { provide: TeacherService, useValue: teacherService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherDetailsComponent);
    component = fixture.componentInstance;
    component.teacherId = 'T1';
    component.teacherDetails = { photoUrl: '' } as any;
  });

  function fileEvent(file: File): Event {
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: [file] });
    return { target: input } as unknown as Event;
  }

  it('rejects an unsupported file type before ever calling the upload service', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

    component.onPhotoSelected(fileEvent(file));

    expect(teacherService.uploadTeacherPhotoDirect).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Unsupported File Type', jasmine.any(String));
  });

  it('rejects a file over 5MB before ever calling the upload service', () => {
    const bigContent = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([bigContent], 'photo.jpg', { type: 'image/jpeg' });

    component.onPhotoSelected(fileEvent(file));

    expect(teacherService.uploadTeacherPhotoDirect).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('File Too Large', jasmine.any(String));
  });

  it('accepts JPEG/PNG/WebP within the size limit and calls the direct-upload service', () => {
    teacherService.uploadTeacherPhotoDirect.and.returnValue(
      of({ objectKey: 'schools/1/teachers/T1/profile/uuid.jpg', displayUrl: 'https://storage.example/signed-url' }),
    );
    const file = new File(['x'], 'photo.png', { type: 'image/png' });

    component.onPhotoSelected(fileEvent(file));

    expect(teacherService.uploadTeacherPhotoDirect).toHaveBeenCalledWith('T1', file);
  });

  it('on success, updates the displayed photo to the fresh presigned URL and clears the uploading flag', () => {
    teacherService.uploadTeacherPhotoDirect.and.returnValue(
      of({ objectKey: 'schools/1/teachers/T1/profile/uuid.jpg', displayUrl: 'https://storage.example/signed-url' }),
    );
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

    component.onPhotoSelected(fileEvent(file));

    expect(component.teacherDetails?.photoUrl).toBe('https://storage.example/signed-url');
    expect(component.photoUploading).toBeFalse();
    expect(toast.success).toHaveBeenCalled();
  });

  it('on failure (e.g. a failed direct PUT), shows a recoverable error and clears the uploading flag without touching the existing photo', () => {
    teacherService.uploadTeacherPhotoDirect.and.returnValue(throwError(() => new Error('PUT failed')));
    component.teacherDetails = { photoUrl: 'https://storage.example/old-photo' } as any;
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

    component.onPhotoSelected(fileEvent(file));

    expect(component.photoUploading).toBeFalse();
    expect(component.teacherDetails?.photoUrl).toBe('https://storage.example/old-photo'); // untouched
    expect(toast.error).toHaveBeenCalledWith('Upload failed', jasmine.any(String));
  });

  it('getPhotoUrl uses an already-absolute (presigned) URL as-is, without prepending the API base URL', () => {
    expect(component.getPhotoUrl('https://storage.example/signed-url')).toBe('https://storage.example/signed-url');
  });

  it('getPhotoUrl still prepends the API base URL for a legacy relative path', () => {
    const result = component.getPhotoUrl('/uploads/teacher-photos/T1.jpg');
    expect(result).not.toBe('/uploads/teacher-photos/T1.jpg');
    expect(result.endsWith('/uploads/teacher-photos/T1.jpg')).toBeTrue();
  });
});
