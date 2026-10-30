import { Params } from '@angular/router';

/**
 * Back-navigation hierarchy for every `/dashboard/*` page.
 *
 *  - `dashboard`  — a role's home page: never a back control.
 *  - `top-level`  — a feature page reachable straight from the sidebar (or the header bell /
 *                   profile menu): no back control, the sidebar is the way out.
 *  - `nested`     — a detail / create / edit / import / workflow page: shows a back control to its
 *                   logical parent (never blind browser history, which may be an unrelated page).
 *
 * Keyed by the route `path` in `app.routes.ts`. `page-hierarchy.spec.ts` fails if a route is added
 * without being classified here, so the hierarchy cannot silently drift.
 */
export type PageLevel = 'dashboard' | 'top-level' | 'nested';

export interface BackTarget {
  /** Parent page name shown beside the arrow ("Students", "Admin dashboard"). */
  label: string;
  link: string[];
  queryParams?: Params;
}

/** Everything a resolver may need — the shell gathers it, resolvers stay pure. */
export interface BackContext {
  role: string;
  userId: string;
  params: Params;
  queryParams: Params;
  /** The parent's currently selected child, if any. */
  childStudentId: string | null;
}

export type BackResolver = (ctx: BackContext) => BackTarget | null;

export interface PageEntry {
  level: PageLevel;
  /** Required for `nested`; a `top-level` page may use it only for a contextual drill-down. */
  back?: BackResolver;
}

const target = (label: string, ...link: string[]): BackTarget => ({ label, link });
const fixed = (t: BackTarget): BackResolver => () => t;

const D = '/dashboard';
const STUDENTS = target('Students', `${D}/student-list`);
const TEACHERS = target('Teachers', `${D}/teacher-list`);
const ADMINS = target('Admins', `${D}/admin-list`);
const PARENTS = target('Parents', `${D}/parent-portal`);
const EVENTS = target('Event Calendar', `${D}/event-calendar`);
const FEES = target('Fees', `${D}/fees`);
const ADMIN_DASHBOARD = target('Admin dashboard', `${D}/admin-dashboard`);
const SCHOOL_SETUP = target('School setup', `${D}/school-setup`);
const FEE_ASSIGNMENT = target('Fee assignment', `${D}/fee-assignment`);
const RC_SETUP = target('Report Card Setup', `${D}/report-cards-v2/setup`);
const RC_REMARKS = target('Remarks', `${D}/report-cards-v2/remarks`);
const RC_PUBLISHED = target('Published Report Cards', `${D}/bulk-report-cards`);
const RC_MY_CARDS = target('Report Cards', `${D}/report-card-documents`);
const MY_RESULTS = target('Results', `${D}/my-results`);
const CLASS_RESULTS = target('Class Results', `${D}/class-results`);
const TIMETABLE = target('Timetable', `${D}/timetable`);

const STAFF_ROLES = ['ADMIN', 'SUB_ADMIN', 'TEACHER'];

/** The role's own dashboard — the parent of pages that no list or hub leads to. */
export function homeDashboard(role: string): BackTarget {
  switch (role) {
    case 'ADMIN':
    case 'SUB_ADMIN': return ADMIN_DASHBOARD;
    case 'TEACHER': return target('Teacher dashboard', `${D}/teacher-dashboard`);
    case 'STUDENT': return target('Student dashboard', `${D}/student-dashboard`);
    case 'PARENT': return target('Dashboard', `${D}/parent-dashboard`);
    case 'SUPER_ADMIN': return target('Super Admin dashboard', `${D}/super-admin-dashboard`);
    default: return target('Dashboard', D);
  }
}

/** Splits an in-app `/dashboard/...?a=b` URL; anything else (external, protocol-relative) is rejected. */
export function parseInAppUrl(url: string | null | undefined): { link: string[]; queryParams: Params } | null {
  if (!url || !url.startsWith(`${D}/`) || url.startsWith('//')) return null;
  const [path, query = ''] = url.split('#')[0].split('?');
  const queryParams: Params = {};
  new URLSearchParams(query).forEach((value, key) => { queryParams[key] = value; });
  return { link: [path], queryParams };
}

const studentDetails = (studentId: string): BackTarget =>
  target('Student details', `${D}/student-details`, studentId);

/** Own profile (reached from the header menu) is a top-level destination; anyone else's is nested. */
const ownProfile = (ctx: BackContext, idParam: string): boolean =>
  ctx.role === 'STUDENT' || (!!ctx.userId && ctx.params[idParam] === ctx.userId);

const dashboard: PageEntry = { level: 'dashboard' };
const topLevel: PageEntry = { level: 'top-level' };
const nested = (back: BackResolver | BackTarget): PageEntry =>
  ({ level: 'nested', back: typeof back === 'function' ? back : fixed(back) });

export const PAGE_HIERARCHY: Record<string, PageEntry> = {
  // ── Dashboards / home ────────────────────────────────────────────────
  'student-dashboard': dashboard,
  'teacher-dashboard': dashboard,
  'admin-dashboard': dashboard,
  'super-admin-dashboard': dashboard,
  'parent-dashboard': dashboard,

  // ── Top-level sidebar / header features ──────────────────────────────
  'fees': topLevel,
  'payment-history': topLevel,
  'apply-leave': topLevel,
  // Drill-down from a student's profile (?studentId=…) is nested; from the sidebar it is not.
  'attendance-summary': {
    level: 'top-level',
    back: ctx => STAFF_ROLES.includes(ctx.role) && ctx.queryParams['studentId']
      ? studentDetails(ctx.queryParams['studentId']) : null,
  },
  'teacher-attendance': topLevel,
  'apply-teacher-leave': topLevel,
  'teacher-leave-requests': topLevel,
  'student-search': topLevel,
  'student-list': topLevel,
  'view-leaves': topLevel,
  'payment-pricing': topLevel,
  'payment-gateways': topLevel,
  'school-settings': topLevel,
  'knowledge-base': topLevel,
  'class-management': topLevel,
  'holiday-calendar': topLevel,
  'teacher-checkin': topLevel,
  'staff-attendance': topLevel,
  'bulk-report-cards': topLevel,
  'report-cards-v2/setup': topLevel,
  'report-cards-v2/design': topLevel,
  'report-cards-v2/remarks': topLevel,
  'report-card-documents': topLevel,
  'payment-history-admin': topLevel,
  'fee-reminders': topLevel,
  'teacher-list': topLevel,
  'register': topLevel,
  'admin-list': topLevel,
  'register-admin': topLevel,
  'audit-logs': topLevel,
  'fee-structure': topLevel,
  'bus-fees': topLevel,
  'fee-assignment': topLevel,
  'fee-generation-target': topLevel,
  'fee-head-management': topLevel,
  'subject-config': topLevel,
  'exam-config': topLevel,
  'student-stream': topLevel,
  'elective-assignment': topLevel,
  'mark-entry': topLevel,
  'my-results': topLevel,
  'class-results': topLevel,
  'parent-portal': topLevel,
  'homework-classwork': topLevel,
  'homework': topLevel,
  'teacher-class-updates': topLevel,
  'class-updates': topLevel,
  'manage-assessments': topLevel,
  'assessments': topLevel,
  'analytics': topLevel,
  'teacher-substitutions': topLevel,
  'timetable': topLevel,
  'student-promotion': topLevel,
  'notifications': topLevel,
  'notice': topLevel,
  'event-calendar': topLevel,
  'active-sessions': topLevel,
  'report-problem': topLevel,
  'my-support-requests': topLevel,
  'support-queue': topLevel,
  'notification-deliveries': topLevel,

  // ── Nested: details ──────────────────────────────────────────────────
  'student-details/:studentId': nested(ctx =>
    ownProfile(ctx, 'studentId') ? null : STUDENTS),
  'teacher-details/:teacherId': nested(ctx =>
    ownProfile(ctx, 'teacherId') || ctx.role === 'TEACHER' ? null : TEACHERS),
  'admin-details/:adminId': nested(ctx =>
    ctx.role === 'ADMIN' && ownProfile(ctx, 'adminId') ? null : ADMINS),
  'parent-portal/:parentId': nested(PARENTS),

  // ── Nested: a student's own fee / leave / payment views (staff opened from the profile) ──
  'fees/:studentId': nested(ctx =>
    ctx.role === 'ADMIN' ? studentDetails(ctx.params['studentId']) : null),
  'payment-history/:studentId': nested(ctx =>
    ctx.role === 'ADMIN' ? studentDetails(ctx.params['studentId']) : null),
  'view-leaves/:studentId': nested(ctx => studentDetails(ctx.params['studentId'])),
  'payment-history-details/:paymentId': nested(ctx => {
    if (ctx.role === 'ADMIN') return target('Payment History', `${D}/payment-history-admin`);
    if (ctx.role === 'PARENT') {
      return ctx.childStudentId
        ? target('Payment History', `${D}/payment-history`, ctx.childStudentId)
        : homeDashboard('PARENT');
    }
    return target('Payment History', `${D}/payment-history`);
  }),
  'payment': nested(FEES),

  // ── Nested: create / edit / import ───────────────────────────────────
  'event-new': nested(EVENTS),
  'event-edit/:id': nested(EVENTS),
  'student-bulk-import': nested(STUDENTS),
  'teacher-bulk-import': nested(TEACHERS),
  'parent-bulk-import': nested(PARENTS),
  'timetable-bulk-import': nested(ctx => ({
    ...TIMETABLE,
    queryParams: ctx.queryParams['academicSessionId']
      ? { academicSessionId: ctx.queryParams['academicSessionId'] } : undefined,
  })),

  // ── Nested: admin workflows opened from the admin dashboard / a setup hub ──
  'school-setup': nested(ADMIN_DASHBOARD),
  'staff-adoption': nested(ADMIN_DASHBOARD),
  'wisdom/manage': nested(ctx => homeDashboard(ctx.role)),
  'assessment-groups': nested(ADMIN_DASHBOARD),
  'fee-rule-config': nested(SCHOOL_SETUP),
  'fee-recalculation': nested(FEE_ASSIGNMENT),

  // ── Nested: report cards ─────────────────────────────────────────────
  // Generate & Preview is the last step of the setup → remarks → generate workflow.
  'report-cards-v2/generate': nested(ctx => ctx.role === 'ADMIN' ? RC_SETUP : RC_REMARKS),
  'report-card-documents/:id': nested(ctx => {
    if (ctx.role === 'ADMIN') return RC_PUBLISHED;
    const studentId = ctx.queryParams['studentId'];
    return studentId ? { ...RC_MY_CARDS, queryParams: { studentId } } : RC_MY_CARDS;
  }),
  'report-card': nested(ctx => {
    // A Class Results caller passes its own URL (selection intact) — only an in-app path is honoured.
    const returned = parseInAppUrl(ctx.queryParams['returnUrl']);
    if (returned) return { ...CLASS_RESULTS, ...returned };
    return ctx.role === 'STUDENT' || ctx.role === 'PARENT' ? MY_RESULTS : CLASS_RESULTS;
  }),
  // Orphan routes (no sidebar entry or in-app link): their parent is the role's dashboard.
  'report-card-templates': nested(ctx => homeDashboard(ctx.role)),
  'report-card-remarks': nested(ctx => homeDashboard(ctx.role)),
  'class-overview': nested(ctx => homeDashboard(ctx.role)),
  'report-card-gallery': nested(ctx => homeDashboard(ctx.role)),
};

/** The back target for a dashboard child route, or null when the page has none. */
export function resolveBackTarget(routePath: string | null | undefined, ctx: BackContext): BackTarget | null {
  const entry = routePath ? PAGE_HIERARCHY[routePath] : undefined;
  if (!entry || entry.level === 'dashboard') return null;
  return entry.back ? entry.back(ctx) : null;
}
