import { studentStatusLabel, studentStatusTone } from '../../utils/student-status.util';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  of,
  catchError,
  timer,
  switchMap,
  takeUntil,
} from 'rxjs';

import { StudentService } from '../../services/student.service';
import { Student } from '../../interfaces/student';

@Component({
  selector: 'app-student-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-search.component.html',
  styleUrl: './student-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentSearchComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private search$ = new Subject<string>();

  query = '';
  results: Student[] = [];
  isLoading = false;
  hasSearched = false;
  error: string | null = null;

  constructor(
    private studentService: StudentService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.search$.pipe(
      switchMap(query => {
        const q = query.trim();
        this.results = [];
        this.error = null;
        this.isLoading = q.length >= 2;
        this.hasSearched = false;
        this.cdr.markForCheck();
        if (q.length < 2) return of([]);
        // Debounce inside switchMap so every change immediately cancels the former request.
        return timer(350).pipe(switchMap(() => this.studentService.searchStudents(q).pipe(catchError(() => {
          this.error = 'Search failed. Please try again.';
          return of([]);
        }))));
      }),
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.results = results;
      this.isLoading = false;
      this.hasSearched = this.query.trim().length >= 2;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onQueryChange(): void {
    this.search$.next(this.query);
  }

  clearSearch(): void {
    this.query = '';
    this.results = [];
    this.hasSearched = false;
    this.error = null;
    this.search$.next('');
    this.cdr.markForCheck();
  }

  viewStudent(studentId: string): void {
    this.router.navigate(['/dashboard/student-details', studentId]);
  }

  getStatusClass(status: string | undefined): string { return 'status-' + studentStatusTone(status); }
  getStatusLabel(status: string | undefined): string { return studentStatusLabel(status); }

  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  trackByStudentId(_: number, student: Student): string {
    return student.studentId;
  }
}
