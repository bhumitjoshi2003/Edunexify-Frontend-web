import { routes } from '../app.routes';
import { BackContext, PAGE_HIERARCHY, homeDashboard, parseInAppUrl, resolveBackTarget } from './page-hierarchy';

const ctx = (over: Partial<BackContext> = {}): BackContext =>
  ({ role: 'ADMIN', userId: 'A1', params: {}, queryParams: {}, childStudentId: null, ...over });

describe('page hierarchy', () => {
  const dashboardChildren = (routes.find(r => r.path === 'dashboard')?.children ?? [])
    .map(r => r.path as string);

  it('classifies every /dashboard route, and only those', () => {
    expect(dashboardChildren.length).toBeGreaterThan(50);
    expect(dashboardChildren.filter(p => !PAGE_HIERARCHY[p])).toEqual([]);
    expect(Object.keys(PAGE_HIERARCHY).filter(p => !dashboardChildren.includes(p))).toEqual([]);
  });

  it('gives every nested page a parent and no dashboard a back control', () => {
    for (const [path, entry] of Object.entries(PAGE_HIERARCHY)) {
      if (entry.level === 'nested') expect(entry.back).withContext(path).toBeDefined();
      if (entry.level === 'dashboard') expect(entry.back).withContext(path).toBeUndefined();
    }
  });

  it('shows nothing on dashboards and plain top-level sidebar pages', () => {
    for (const path of ['admin-dashboard', 'teacher-dashboard', 'student-dashboard', 'super-admin-dashboard',
      'parent-dashboard', 'student-list', 'teacher-substitutions', 'fee-assignment', 'manage-assessments',
      'assessments', 'bulk-report-cards', 'report-cards-v2/setup', 'support-queue', 'payment-history']) {
      expect(resolveBackTarget(path, ctx())).withContext(path).toBeNull();
    }
  });

  it('returns nested pages to their logical parent, not browser history', () => {
    const t = (path: string, over?: Partial<BackContext>) => resolveBackTarget(path, ctx(over));
    expect(t('student-details/:studentId', { params: { studentId: 'S1' } })).toEqual({ label: 'Students', link: ['/dashboard/student-list'] });
    expect(t('teacher-details/:teacherId', { params: { teacherId: 'T1' } })?.label).toBe('Teachers');
    expect(t('admin-details/:adminId', { role: 'SUPER_ADMIN', params: { adminId: 'A1' } })?.label).toBe('Admins');
    expect(t('event-edit/:id')?.link).toEqual(['/dashboard/event-calendar']);
    expect(t('event-new')?.label).toBe('Event Calendar');
    expect(t('student-bulk-import')?.link).toEqual(['/dashboard/student-list']);
    expect(t('staff-adoption')?.link).toEqual(['/dashboard/admin-dashboard']);
    expect(t('fee-recalculation')?.link).toEqual(['/dashboard/fee-assignment']);
    expect(t('view-leaves/:studentId', { params: { studentId: 'S1' } })?.link).toEqual(['/dashboard/student-details', 'S1']);
  });

  it('keeps the timetable academic session when returning from the bulk import', () => {
    expect(resolveBackTarget('timetable-bulk-import', ctx({ queryParams: { academicSessionId: '7' } }))?.queryParams)
      .toEqual({ academicSessionId: '7' });
  });

  it('treats a person\'s own profile as top-level, other people\'s as nested', () => {
    expect(resolveBackTarget('student-details/:studentId', ctx({ role: 'STUDENT', userId: 'S1', params: { studentId: 'S1' } }))).toBeNull();
    expect(resolveBackTarget('teacher-details/:teacherId', ctx({ role: 'TEACHER', userId: 'T1', params: { teacherId: 'T1' } }))).toBeNull();
    expect(resolveBackTarget('admin-details/:adminId', ctx({ userId: 'A1', params: { adminId: 'A1' } }))).toBeNull();
    expect(resolveBackTarget('admin-details/:adminId', ctx({ userId: 'A1', params: { adminId: 'A2' } }))?.label).toBe('Admins');
  });

  it('shows a back control on a student\'s fees / payments only when an admin opened them', () => {
    const params = { studentId: 'S1' };
    expect(resolveBackTarget('fees/:studentId', ctx({ params }))?.link).toEqual(['/dashboard/student-details', 'S1']);
    expect(resolveBackTarget('payment-history/:studentId', ctx({ params }))?.label).toBe('Student details');
    expect(resolveBackTarget('fees/:studentId', ctx({ role: 'PARENT', params }))).toBeNull();
    expect(resolveBackTarget('payment-history/:studentId', ctx({ role: 'PARENT', params }))).toBeNull();
  });

  it('only drills attendance back to the student profile for staff with a studentId', () => {
    const queryParams = { studentId: 'S1' };
    expect(resolveBackTarget('attendance-summary', ctx())).toBeNull();
    expect(resolveBackTarget('attendance-summary', ctx({ role: 'TEACHER', queryParams }))?.label).toBe('Student details');
    expect(resolveBackTarget('attendance-summary', ctx({ role: 'PARENT', queryParams }))).toBeNull();
  });

  it('sends a payment receipt back to the right payment history for each role', () => {
    const p = 'payment-history-details/:paymentId';
    expect(resolveBackTarget(p, ctx())?.link).toEqual(['/dashboard/payment-history-admin']);
    expect(resolveBackTarget(p, ctx({ role: 'STUDENT' }))?.link).toEqual(['/dashboard/payment-history']);
    expect(resolveBackTarget(p, ctx({ role: 'PARENT', childStudentId: 'S9' }))?.link).toEqual(['/dashboard/payment-history', 'S9']);
    expect(resolveBackTarget(p, ctx({ role: 'PARENT' }))?.link).toEqual(['/dashboard/parent-dashboard']);
  });

  it('routes Generate & Preview to a Report Cards parent for each role', () => {
    expect(resolveBackTarget('report-cards-v2/generate', ctx())?.link).toEqual(['/dashboard/report-cards-v2/setup']);
    expect(resolveBackTarget('report-cards-v2/generate', ctx({ role: 'TEACHER' }))?.link).toEqual(['/dashboard/report-cards-v2/remarks']);
  });

  it('routes published report cards and the report card to their lists', () => {
    expect(resolveBackTarget('report-card-documents/:id', ctx())?.link).toEqual(['/dashboard/bulk-report-cards']);
    expect(resolveBackTarget('report-card-documents/:id', ctx({ role: 'PARENT', queryParams: { studentId: 'S1' } })))
      .toEqual({ label: 'Report Cards', link: ['/dashboard/report-card-documents'], queryParams: { studentId: 'S1' } });
    expect(resolveBackTarget('report-card', ctx({ role: 'STUDENT' }))?.link).toEqual(['/dashboard/my-results']);
    expect(resolveBackTarget('report-card', ctx({ role: 'TEACHER' }))?.link).toEqual(['/dashboard/class-results']);
  });

  it('returns the report card to the Class Results selection it was opened from, only for in-app URLs', () => {
    const returnUrl = '/dashboard/class-results?classId=3&session=2025-26';
    expect(resolveBackTarget('report-card', ctx({ queryParams: { returnUrl } })))
      .toEqual({ label: 'Class Results', link: ['/dashboard/class-results'], queryParams: { classId: '3', session: '2025-26' } });
    expect(resolveBackTarget('report-card', ctx({ queryParams: { returnUrl: 'https://evil.example/x' } }))?.link)
      .toEqual(['/dashboard/class-results']);
    expect(parseInAppUrl('//evil.example')).toBeNull();
  });

  it('falls back to the role\'s own dashboard for pages no list leads to', () => {
    expect(homeDashboard('TEACHER').link).toEqual(['/dashboard/teacher-dashboard']);
    expect(resolveBackTarget('wisdom/manage', ctx({ role: 'SUB_ADMIN' }))?.label).toBe('Admin dashboard');
    expect(resolveBackTarget('class-overview', ctx({ role: 'TEACHER' }))?.label).toBe('Teacher dashboard');
  });
});
