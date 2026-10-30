import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRouteSnapshot, NavigationEnd, Params, Router } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { AuthStateService } from '../../auth/auth-state.service';
import { ParentChildContextService } from '../../services/parent-child-context.service';
import { BackTarget, resolveBackTarget } from '../../navigation/page-hierarchy';
import { PageBackComponent } from './page-back.component';

/**
 * Dashboard-shell integration: after every navigation, looks the activated page up in the page
 * hierarchy and shows the shared back control for nested pages only. Dashboards and top-level
 * sidebar pages resolve to nothing, so they never show one.
 */
@Component({
  selector: 'app-route-back-bar',
  standalone: true,
  imports: [NgIf, PageBackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-page-back *ngIf="target as t" [label]="t.label" [link]="t.link" [queryParams]="t.queryParams ?? null"></app-page-back>`,
})
export class RouteBackBarComponent implements OnInit, OnDestroy {
  target: BackTarget | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private auth: AuthStateService,
    private childContext: ParentChildContextService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.refresh();
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntil(this.destroy$))
      .subscribe(() => this.refresh());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private refresh(): void {
    const snapshot = this.router.routerState.snapshot;
    let leaf: ActivatedRouteSnapshot = snapshot.root;
    const params: Params = {};
    while (leaf.firstChild) { leaf = leaf.firstChild; Object.assign(params, leaf.params); }
    const user = this.auth.getUser();
    const childContext = this.childContext;
    this.target = resolveBackTarget(leaf.routeConfig?.path, {
      role: user?.role ?? '',
      userId: user?.userId ?? '',
      params,
      queryParams: snapshot.root.queryParams,
      // Read only when a resolver asks (a parent's receipt) — the selection is a BehaviorSubject.
      get childStudentId(): string | null {
        let id: string | null = null;
        childContext.selectedChild$.subscribe(c => id = c?.studentId ?? null).unsubscribe();
        return id;
      },
    });
    this.cdr.markForCheck();
  }
}
