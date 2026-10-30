# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Edunexify** — the **web (browser) frontend** of a multi-tenant SaaS school management platform. Angular 19 single-page app (static build from `dist/ias/browser`) served at `https://edunexify.co.in` — SSR files exist but are dormant (see Dormant areas). This repo is the website counterpart to `EduPay-Leave-android` (the mobile/Capacitor app). Both frontends share the same Spring Boot backend.

Backend: `/Applications/IAS/ias-management(backend)`
Android app: `/Applications/IAS/EduPay-Leave-android`
Prod URL: `https://edunexify.co.in`

---

## Commands

```bash
npm start                                         # Dev server (ng serve)
ng build                                          # Production build (static browser bundle in dist/ias/browser)
ng build --watch --configuration development      # Dev build with watch
ng test                                           # Karma/Jasmine unit tests
npm run parity:check                              # Web/Android shared-file guard (also runs before npm test)
```

---

## Architecture

**Angular 19 standalone components** — no NgModules. Every component declares its own `imports: []`. Bootstrapped via `bootstrapApplication()` in `main.ts`.

### Routing

Single protected parent route `/dashboard` guarded by `authGuard`. All feature routes are lazy-loaded children (`loadComponent()`), same as Android. Public routes: `/home`, `/reset-password`. Route access restricted by `roleGuard` via `data: { roles: [...] }`.

**Role-to-route map:**
- `STUDENT` — fees, payment-history, apply-leave, student-attendance, student-dashboard, my-results, report-card, timetable, notice, event-calendar, student-details (own), fee-structure (view)
- `TEACHER` — teacher-attendance, student-list, view-leaves, mark-entry, class-results, report-card, teacher-dashboard, timetable, notice, event-calendar, event-new/edit
- `ADMIN` — everything TEACHER has + register, bulk-import, teacher-bulk-import, teacher-list, fee-structure (edit), bus-fees, fee-reminders, payment-history-admin, student-promotion, exam-config, subject-config, student-stream, audit-logs, analytics, admin-dashboard, school-settings, class-management, admin-list, admin-details
- `SUB_ADMIN` — class-management, timetable
- `SUPER_ADMIN` — super-admin-dashboard, admin-list, admin-details, register-admin

### Authentication

Custom JWT auth carried in **HTTP-only cookies** (`withCredentials: true`). No tokens in `localStorage`, no `Authorization: Bearer` header; the refresh token cookie also identifies the session for Active Sessions.

- `auth.service.ts` — login, logout, logout-all, refresh, password reset/change
- `auth-state.service.ts` — in-memory `UserInfo` loaded from `/auth/me`; status state machine (`CHECKING` / `AUTHENTICATED` / `UNAUTHENTICATED` / `SERVICE_UNAVAILABLE` / `OFFLINE`). Only an authoritative rejection signs out; transient failures never do.
- `auth.guard.ts` / `role.guard.ts` / `feature.guard.ts` — gate routes on that state, role and plan feature
- `auth.interceptor.ts` — on 401 refreshes once (shared in-flight refresh); a rejected refresh clears the session and goes to `/home`, saving the page via `redirect-url.util.ts`
- `core/app-resume.service.ts` — re-verifies the session on resume/reconnect (coalesced), shared with Android
- Passwords: one rule everywhere — 8+ chars, upper, lower, digit (`utils/password-policy.util.ts`, backend `PasswordPolicy`); never trimmed

**Roles:** `STUDENT`, `TEACHER`, `ADMIN`, `SUB_ADMIN`, `SUPER_ADMIN`

### API Communication

Base URL from `src/environments/environment.ts`:
- Dev: `http://localhost:8080/api`
- Prod: `/api` (same-origin — Angular and backend served together)

Paginated responses: `{ content: T[], totalElements, totalPages, number, size, first, last, empty }`. Build paginated requests with `HttpParams`.

Some endpoints return plain text — use `responseType: 'text'`.

### State Management

No NgRx. Services are `providedIn: 'root'` singletons.

**Standard cleanup pattern (required in all components with subscriptions):**
```typescript
private destroy$ = new Subject<void>();

ngOnInit() {
  this.service.getData().pipe(takeUntil(this.destroy$)).subscribe(...);
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}
```

All one-off subscriptions (e.g. delete, save) must also use `pipe(takeUntil(this.destroy$))`.

### UI & Dialogs

Angular Material. User feedback and confirmations are handled **exclusively** via `ToastService` — **never use SweetAlert2 (Swal) directly**.

- `ToastService` (`src/app/services/toast.service.ts`) — wraps a `BehaviorSubject<Toast[]>` for toast banners + `MatDialog` for confirm dialogs
  - `toast.success/error/warning/info(title, message?)` — shows a toast banner
  - `toast.confirm(data: ConfirmDialogData): Promise<boolean>` — opens `ConfirmDialogComponent` via MatDialog
- `ToastContainerComponent` (`src/app/components/toast/toast-container.component.ts`) — renders the toast stack; mounted in `app.component.html`
- `ConfirmDialogComponent` (`src/app/components/confirm-dialog/`) — the MatDialog modal for confirmations/alerts

`MatDialog` is also used for `WelcomeDialogComponent` (shown once on first dashboard load via `localStorage` flag).

### Forms

Reactive forms (`ReactiveFormsModule`, `FormBuilder`) for complex forms. Template-driven (`FormsModule`) for simpler ones.

---

## Features

### Fee Management
- `fees.component.ts` — per-student fee tracker; STUDENT sees own fees, ADMIN navigates via `:studentId`
- `fee-structure.component.ts` — admin edits class-wise fee structure per academic year; always uses PUT
- `bus-fees.component.ts` — admin edits distance-based bus fee slabs; same session pattern
- `payment.component.ts` — Razorpay integration; script lazy-loaded
- `payment-history.component.ts` / `payment-history-admin.component.ts` — paginated payment history
- `fee-reminders.component.ts` — admin sends push notification reminders to fee defaulters

### Attendance
- `teacher-attendance.component.ts` — teacher/admin marks daily attendance; uses `switchMap` pipeline
- `student-attendance.component.ts` — student/admin views attendance summary

### Leave Management
- `apply-leave.component.ts` — student applies for leave
- `view-leaves.component.ts` — teacher/admin views and approves/rejects leaves; paginated

### Marks & Results
- `subject-config.component.ts`, `exam-config.component.ts`, `student-stream.component.ts`
- `mark-entry.component.ts`, `student-results.component.ts`, `class-results.component.ts`, `report-card.component.ts`

### People Management
- `register.component.ts` — admin registers student or teacher
- `bulk-import.component.ts` / `teacher-bulk-import.component.ts` — CSV bulk import
- `student-promotion.component.ts` — promotes students to next class
- `student-list.component.ts`, `teacher-list.component.ts`
- `student-details.component.ts`, `teacher-details.component.ts`, `admin-details.component.ts`

### Notifications & Communication
- `notification-center.component.ts` — personal inbox (`/dashboard/notifications`, bell); unread count in `notification-state.service.ts`
- `notice.component.ts` — school Notice Board
- `active-sessions.component.ts` — account security (`/dashboard/active-sessions`)
- `event-calendar.component.ts` / `event-form.component.ts`

### School Configuration
- `school-settings.component.ts`, `class-management.component.ts`, `timetable.component.ts`

### Admin & Super Admin
- `admin-dashboard.component.ts`, `super-admin-dashboard.component.ts`
- `analytics.component.ts` — charts/stats (ng2-charts / Chart.js)
- `audit-logs.component.ts` — paginated audit log viewer
- `admin-list.component.ts`, `register-admin.component.ts`

---

## Key Differences vs Android App

| Topic | Website (this repo) | Android (`EduPay-Leave-android`) |
|---|---|---|
| API URL (dev) | `http://localhost:8080/api` | `https://edunexify.co.in/api` |
| API URL (prod) | `/api` (same-origin) | `https://edunexify.co.in/api` |
| Routing | Lazy `loadComponent()` | Lazy `loadComponent()` |
| Change detection | Mix of Default and OnPush | OnPush everywhere |
| Capacitor / native | No | Yes — Capacitor wraps it as Android APK |
| Push notifications | No | Yes — `PushNotifications` Capacitor plugin |
| School/tenant | Subdomain | Stored school picker |
| Super-admin payment gateways, pricing, delivery log, subscription health, full Razorpay setup | Yes | No — intentional web-only exception (F39); Android shows status + Manage on Web |

Business logic is otherwise meant to match. Files that must stay byte-identical are listed in `parity/shared-files.json` and checked by `npm run parity:check` (runs before `npm test`); see `parity/README.md`. Product decisions are recorded in `EduPay-Leave-android/docs/web-android-parity-product-decisions.md`.

---

## Dormant areas — do not port or revive during parity work

These exist in the source but are not routed, built or used. Leave them alone unless a product decision revives them.

- **Invoice Management (old invoice-based fee system)** — `components/invoice-management`, `components/invoice-detail`, `components/student-fee-overview`, `services/invoice.service.ts`. Not routed. Current fees use `StudentFees` + checkout quotes.
- **Legacy payment / credit-note paths** — `components/payment-record`, `services/fee-payment.service.ts`, `interfaces/fee-payment.ts`. Not routed. Payments go through `payment.component.ts` (Razorpay) and admin manual payments in `fees.component.ts`.
- **Unused pricing view** — `components/pricing`. Not routed. (Super-admin `payment-pricing` *is* active and web-only.)
- **Old notification components** — `components/notification`, `components/view-notification`. Not routed; replaced by `notification-center`.
- **SSR** — `src/server.ts`, `src/main.server.ts`, `app.config.server.ts`, `app.routes.server.ts` and the `serve:ssr:ias` npm script. `angular.json` has no server/SSR target, `ng build` produces only `dist/ias/browser`, and deploy ships that static folder. Do not rely on SSR or `node dist/ias/server/server.mjs`.
