import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { ROLES } from './landing.model';

@Component({
  selector: 'app-role-tabs',
  standalone: true,
  imports: [NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sec" id="roles" aria-labelledby="roles-title">
      <div class="head">
        <span class="tag">For every role</span>
        <h2 id="roles-title">One Platform. Every Role.</h2>
        <p class="sub">Admins, teachers, parents and students each get a focused experience built around their day.</p>
      </div>

      <div class="rolebar" role="tablist" aria-label="Roles">
        <button *ngFor="let r of roles; let i = index" type="button" role="tab" class="rt" [class.on]="i === active"
                [attr.aria-selected]="i === active" [attr.id]="'role-tab-' + r.id" [attr.aria-controls]="'role-panel-' + r.id"
                [attr.tabindex]="i === active ? 0 : -1" (click)="active = i" (keydown)="onKey($event)">
          <span class="material-icons" aria-hidden="true">{{ r.icon }}</span>{{ r.title }}
        </button>
      </div>

      <div class="panels">
        <article *ngFor="let r of roles; let i = index" class="card panel" [class.on]="i === active" role="tabpanel"
                 [attr.id]="'role-panel-' + r.id" [attr.aria-labelledby]="'role-tab-' + r.id">
          <span class="ico big"><span class="material-icons" aria-hidden="true">{{ r.icon }}</span></span>
          <div>
            <h3>{{ r.headline }}</h3>
            <ul><li *ngFor="let b of r.bullets">{{ b }}</li></ul>
          </div>
        </article>
      </div>
    </section>
  `,
  styleUrls: ['./section.shared.css', './role-tabs.component.css'],
})
export class RoleTabsComponent {
  readonly roles = ROLES;
  active = 0;

  onKey(ev: KeyboardEvent): void {
    const n = this.roles.length;
    if (ev.key === 'ArrowRight') this.active = (this.active + 1) % n;
    else if (ev.key === 'ArrowLeft') this.active = (this.active - 1 + n) % n;
    else return;
    ev.preventDefault();
    queueMicrotask(() => document.getElementById('role-tab-' + this.roles[this.active].id)?.focus());
  }
}
