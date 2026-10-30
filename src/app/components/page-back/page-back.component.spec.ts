import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageBackComponent } from './page-back.component';

@Component({ standalone: true, template: '' })
class Blank {}

describe('PageBackComponent', () => {
  let fixture: ComponentFixture<PageBackComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PageBackComponent],
      providers: [provideRouter([{ path: 'dashboard/student-list', component: Blank }])],
    });
    fixture = TestBed.createComponent(PageBackComponent);
    fixture.componentRef.setInput('label', 'Students');
  });

  it('renders an anchor to the parent with the parent\'s name', () => {
    fixture.componentRef.setInput('link', ['/dashboard/student-list']);
    fixture.componentRef.setInput('queryParams', { page: '2' });
    fixture.detectChanges();
    const a: HTMLAnchorElement = fixture.nativeElement.querySelector('a.pb');
    expect(a.textContent).toContain('Students');
    expect(a.getAttribute('href')).toBe('/dashboard/student-list?page=2');
    expect(a.getAttribute('aria-label')).toBe('Back to Students');
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-label')).toBe('Back navigation');
  });

  it('renders a button that emits back when there is no link', () => {
    let emitted = 0;
    fixture.componentInstance.back.subscribe(() => emitted++);
    fixture.detectChanges();
    const b: HTMLButtonElement = fixture.nativeElement.querySelector('button.pb');
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    b.click();
    expect(emitted).toBe(1);
  });
});
