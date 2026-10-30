import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';
import { Subject, of } from 'rxjs';

import { AiCopilotComponent } from './ai-copilot.component';
import { AiCopilotService } from '../../services/ai-copilot.service';
import { AiWorkflowService } from '../../services/ai-workflow.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ChatMarkdownPipe } from '../../pipes/chat-markdown.pipe';
import { DomSanitizer } from '@angular/platform-browser';

describe('AiCopilotComponent streaming', () => {
  let fixture: ComponentFixture<AiCopilotComponent>;
  let component: AiCopilotComponent;
  let stream: Subject<any>;
  let aiService: jasmine.SpyObj<AiCopilotService>;

  const progress = (partialText: string) => ({ type: HttpEventType.DownloadProgress, loaded: partialText.length, partialText });
  const response = (body: string) => ({ type: HttpEventType.Response, body });
  const assistantTexts = () => component.messages.filter((m) => m.role === 'assistant').map((m) => m.content);

  beforeEach(async () => {
    stream = new Subject<any>();
    aiService = jasmine.createSpyObj<AiCopilotService>('AiCopilotService', ['sendStream', 'send']);
    aiService.sendStream.and.callFake(() => stream.asObservable());
    const authState = jasmine.createSpyObj<AuthStateService>('AuthStateService', ['getUser', 'getUserRole']);
    authState.getUser.and.returnValue({ name: 'Aarav Sharma', userId: 'stu_1' } as any);
    authState.getUserRole.and.returnValue('STUDENT');

    await TestBed.configureTestingModule({
      imports: [AiCopilotComponent],
      providers: [
        { provide: AiCopilotService, useValue: aiService },
        { provide: AiWorkflowService, useValue: jasmine.createSpyObj('AiWorkflowService', ['approve', 'reject']) },
        { provide: AcademicSessionService, useValue: { getCurrentSession: () => of({ label: '2026-2027' }) } },
        { provide: AuthStateService, useValue: authState },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AiCopilotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders streamed chunks incrementally and in order, then completes cleanly', () => {
    component.sendMessage('What is my attendance?');
    expect(component.isStreaming).toBeTrue();
    stream.next(progress('Your attendance '));
    expect(assistantTexts()).toEqual(['Your attendance ']);
    stream.next(progress('Your attendance is 100%'));
    stream.next(progress('Your attendance is 100% this year.'));
    expect(assistantTexts()).toEqual(['Your attendance is 100% this year.']);
    stream.next(response('Your attendance is 100% this year.'));
    stream.complete();
    expect(assistantTexts()).toEqual(['Your attendance is 100% this year.']);
    expect(component.isStreaming).toBeFalse();
    expect(component.isLoading).toBeFalse();
  });

  it('refuses a second send while a reply is still streaming', () => {
    component.sendMessage('first');
    component.sendMessage('second');
    expect(aiService.sendStream).toHaveBeenCalledTimes(1);
  });

  it('keeps partial text and flags the reply when the connection drops mid-stream', () => {
    component.sendMessage('hello');
    stream.next(progress('Partial answer'));
    stream.error(new Error('network'));
    const last = component.messages[component.messages.length - 1];
    expect(last.content).toContain('Partial answer');
    expect(last.content).toContain('Connection lost');
    expect(last.error).toBeTrue();
    expect(component.isStreaming).toBeFalse();
  });

  it('shows the server explanation when a message is refused as too long or too frequent', () => {
    component.sendMessage('hello');
    stream.error({ status: 429, error: "You're sending messages too quickly. Please wait a moment and try again." });
    const last = component.messages[component.messages.length - 1];
    expect(last.content).toContain('too quickly');
    expect(last.error).toBeTrue();
    expect(component.isStreaming).toBeFalse();
  });

  it('stop cancels the request and leaves the composer usable', () => {
    component.sendMessage('long answer');
    stream.next(progress('Some text'));
    component.stopGenerating();
    expect(stream.observed).toBeFalse();
    expect(component.isStreaming).toBeFalse();
    component.sendMessage('next question');
    expect(aiService.sendStream).toHaveBeenCalledTimes(2);
  });

  it('an empty reply shows the fallback text instead of an empty bubble', () => {
    component.sendMessage('hello');
    stream.next(response(''));
    stream.complete();
    expect(assistantTexts()).toEqual(["I wasn't able to complete your request. Please try again."]);
  });
});

describe('ChatMarkdownPipe', () => {
  it('escapes HTML from the model before applying its own formatting', () => {
    TestBed.configureTestingModule({});
    const pipe = new ChatMarkdownPipe(TestBed.inject(DomSanitizer));
    const html = (pipe.transform('<img src=x onerror="alert(1)"><script>x()</script> **bold**') as any)
      .changingThisBreaksApplicationSecurity as string;
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img');
    expect(html).toContain('<strong>bold</strong>');
  });
});
