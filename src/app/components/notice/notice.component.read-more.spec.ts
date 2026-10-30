import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { NoticeComponent } from './notice.component';
import { NotificationService } from '../../services/notification.service';
import { NotificationStateService } from '../../services/notification-state.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';

/** notice.component.spec.ts is an unconfigured Angular CLI skeleton (no providers at all —
 *  it never worked with real DI, unrelated to this change). This spec exists specifically to
 *  cover the new "Read more" behavior with the dependencies it actually needs mocked. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('NoticeComponent — read more for long messages', () => {
  let fixture: ComponentFixture<NoticeComponent>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  const longMessage = 'This is a very long notice message. '.repeat(40);

  const userPage = (message: string) => ({
    content: [{
      id: 1, inboxId: 1, userId: 'stu_1', title: 'A notice', message,
      type: 'NOTICE', isRead: false, createdAt: new Date().toISOString(), category: 'NOTICE_ANNOUNCEMENT'
    }],
    totalElements: 1, totalPages: 1, last: true, first: true, numberOfElements: 1,
    pageable: { pageNumber: 0, pageSize: 20 }
  });

  beforeEach(async () => {
    notificationService = jasmine.createSpyObj('NotificationService', [
      'getAllNotifications', 'getUserNotifications', 'markAllNotificationsAsRead'
    ]);
    notificationService.getUserNotifications.and.returnValue(of(userPage(longMessage) as any));
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [NoticeComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: NotificationStateService, useValue: jasmine.createSpyObj('NotificationStateService', ['allRead']) },
        { provide: AuthStateService, useValue: { getUser: () => ({ role: 'STUDENT' }), hasFeature: () => false } },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error', 'warn', 'info']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'confirm']) },
        { provide: SchoolService, useValue: { getClasses: () => of([]) } },
        { provide: MatDialog, useValue: dialog },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NoticeComponent);
  });

  it('shows "Read more" for a long message and opens the full text in a dialog', async () => {
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const readMore: HTMLButtonElement = fixture.nativeElement.querySelector('.nb-read-more');
    expect(readMore).not.toBeNull();

    readMore.click();
    expect(dialog.open).toHaveBeenCalledTimes(1);
    const config: any = dialog.open.calls.mostRecent().args[1];
    expect(config.data.message).toBe(longMessage);
  });

  it('does not show "Read more" for a short message', async () => {
    notificationService.getUserNotifications.and.returnValue(of(userPage('Short notice.') as any));
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.nb-read-more')).toBeNull();
  });
});
