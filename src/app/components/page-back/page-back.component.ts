import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf, NgTemplateOutlet } from '@angular/common';
import { Params, RouterLink } from '@angular/router';

/**
 * The one back control for nested pages: a quiet pill with an arrow and the parent page's name
 * ("← Students"). Navigates to the logical parent via `link` (a real anchor — keyboard, middle-click
 * and new-tab all work); with no `link` it renders a button that emits `back` instead.
 *
 * Normally rendered once by the dashboard shell (`RouteBackBarComponent`) from the page hierarchy,
 * so individual pages do not carry back markup of their own.
 */
@Component({
  selector: 'app-page-back',
  standalone: true,
  imports: [NgIf, NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="pb-nav" aria-label="Back navigation">
      <a *ngIf="link; else action" class="pb" [routerLink]="link" [queryParams]="queryParams"
         [attr.aria-label]="'Back to ' + label">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
      <ng-template #action>
        <button type="button" class="pb" (click)="back.emit()" [attr.aria-label]="'Back to ' + label">
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </button>
      </ng-template>
    </nav>
    <ng-template #content>
      <span class="pb-arrow" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
      </span>
      <span class="pb-label">{{ label }}</span>
    </ng-template>
  `,
  styles: [`
    :host { display: block; margin: 0 0 14px; }
    .pb-nav { display: flex; min-width: 0; }
    .pb {
      display: inline-flex; align-items: center; gap: 8px; max-width: 100%; min-height: 34px;
      padding: 4px 14px 4px 5px; box-sizing: border-box;
      border: 1px solid var(--edu-border, #e2e8f0); border-radius: 999px;
      background: var(--edu-card-bg, #fff); box-shadow: var(--edu-shadow-stat, 0 2px 8px rgba(0, 0, 0, 0.05));
      color: var(--edu-text-sec, #64748b);
      font: 600 var(--edu-text-sm, 0.82rem)/1.2 inherit; font-family: inherit;
      text-decoration: none; cursor: pointer;
      transition: color .15s ease, border-color .15s ease, box-shadow .15s ease;
    }
    .pb-arrow {
      display: grid; place-items: center; flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%;
      background: var(--edu-bg, #f0f4f8); color: var(--edu-teal-dark, #0f766e);
      transition: background .15s ease, color .15s ease, transform .15s ease;
    }
    .pb-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pb:hover { color: var(--edu-text, #1e293b); border-color: #cbd5e1; box-shadow: var(--edu-shadow-sm, 0 2px 12px rgba(30, 58, 95, 0.07)); }
    .pb:hover .pb-arrow { background: var(--edu-teal-dark, #0f766e); color: #fff; transform: translateX(-2px); }
    .pb:focus-visible { outline: 2px solid var(--edu-teal-mid, #0d9488); outline-offset: 2px; }
    @media (max-width: 600px) { :host { margin-bottom: 12px; } .pb { min-height: 38px; } }
    @media (prefers-reduced-motion: reduce) { .pb, .pb-arrow { transition: none; } .pb:hover .pb-arrow { transform: none; } }
    @media print { :host { display: none; } }
  `],
})
export class PageBackComponent {
  /** The parent page's name, e.g. "Students". */
  @Input({ required: true }) label = '';
  @Input() link: string[] | null = null;
  @Input() queryParams: Params | null = null;
  /** Emitted by the button form (no `link`). */
  @Output() back = new EventEmitter<void>();
}
