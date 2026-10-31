/**
 * Content for the public homepage. Every statement here is tied to something the product actually
 * does (modules, roles, bulk import, plan entitlements, the AI Copilot's workflows) — nothing is a
 * customer count, certification, guarantee or performance claim. Add real proof (testimonials,
 * screenshots) by filling the arrays / `src` fields below; empty slots are never shown as fake content.
 */

/** A product screenshot slot. Set `src` (a file under public/landing/) to show a real image. */
export interface LandingShot {
  id: string;
  title: string;
  caption: string;
  /** e.g. 'landing/admin-dashboard.webp' — leave undefined until a real screenshot is supplied. */
  src?: string;
  alt: string;
}

export const SHOWCASE: LandingShot[] = [
  { id: 'admin', title: 'Admin dashboard', caption: 'Students, staff, attendance and fees at a glance — the day’s priorities in one place.', alt: 'Edunexify admin dashboard' },
  { id: 'attendance', title: 'Attendance', caption: 'Class-wise attendance marked in seconds, with live summaries for staff.', alt: 'Edunexify attendance screen' },
  { id: 'parent', title: 'Parent portal', caption: 'Parents follow attendance, results, notices and fees for each linked child.', alt: 'Edunexify parent portal' },
  { id: 'results', title: 'Results & report cards', caption: 'Enter marks once, then generate report cards for every class.', alt: 'Edunexify results and report cards' },
  { id: 'notifications', title: 'Notices & notifications', caption: 'Reach the right classes and roles, on the web and on Android.', alt: 'Edunexify notifications' },
  { id: 'fees', title: 'Fees', caption: 'Fee structures, dues and payment tracking, with online payment optional.', alt: 'Edunexify fees screen' },
  { id: 'copilot', title: 'AI Copilot', caption: 'Ask questions about school data and review suggested reminder batches.', alt: 'Edunexify AI Copilot' },
];

/** Single hero visual. Without `src` the hero shows a brand composition instead of a screenshot. */
export const HERO_SHOT: LandingShot = {
  id: 'hero', title: 'Edunexify dashboard', caption: '', alt: 'Edunexify school dashboard',
};
export const COPILOT_SHOT: LandingShot = {
  id: 'copilot-ui', title: 'Edunexify Copilot', caption: '', alt: 'The Edunexify AI Copilot panel',
};
export const WEB_SHOT: LandingShot = {
  id: 'web', title: 'Edunexify on the web', caption: '', alt: 'Edunexify on the web',
};
export const ANDROID_SHOT: LandingShot = {
  id: 'android', title: 'Edunexify on Android', caption: '', alt: 'Edunexify on Android',
};

export interface TrustItem { icon: string; title: string; text: string; }
export const TRUST: TrustItem[] = [
  { icon: 'flag', title: 'Built for Indian schools', text: 'Designed around how schools here actually run.' },
  { icon: 'devices', title: 'Web + Android', text: 'The same school, from a browser or a phone.' },
  { icon: 'admin_panel_settings', title: 'Role-based access', text: 'Admins, teachers, parents and students see only their own.' },
  { icon: 'domain', title: 'Separate data per school', text: 'Every school’s records are kept apart.' },
  { icon: 'upload_file', title: 'Bulk import', text: 'Bring students and teachers in from CSV.' },
];

export interface FeatureArea {
  id: string; icon: string; title: string; benefit: string; points: string[]; accent: 'teal' | 'navy' | 'sky' | 'violet' | 'amber' | 'rose';
}
export const FEATURE_AREAS: FeatureArea[] = [
  { id: 'operations', icon: 'event_available', title: 'School Operations', accent: 'teal',
    benefit: 'Mark attendance in seconds and keep daily records accurate in real time.',
    points: ['Student and teacher attendance', 'Timetables and substitutions', 'Leave requests and approvals'] },
  { id: 'academics', icon: 'school', title: 'Academics', accent: 'navy',
    benefit: 'From homework to report cards, keep every academic record connected.',
    points: ['Homework and assessments', 'Exams, marks and results', 'Report cards for every class'] },
  { id: 'fees', icon: 'account_balance_wallet', title: 'Fees & Administration', accent: 'sky',
    benefit: 'Know what is due and what is paid, without chasing spreadsheets.',
    points: ['Fee structures and dues', 'Payment tracking and receipts', 'Student and staff administration'] },
  { id: 'engagement', icon: 'forum', title: 'Parent & Student Engagement', accent: 'violet',
    benefit: 'Keep families informed without adding work for your staff.',
    points: ['Notices and class updates', 'Results and attendance for parents', 'Push notifications on Android'] },
  { id: 'analytics', icon: 'insights', title: 'Analytics & Automation', accent: 'amber',
    benefit: 'See trends across the school and let routine reminders run themselves.',
    points: ['Dashboards and trends', 'Reports for decisions', 'Scheduled reminders'] },
  { id: 'ai', icon: 'auto_awesome', title: 'AI Copilot', accent: 'rose',
    benefit: 'Ask questions about your school data and review suggested actions.',
    points: ['Answers within your role', 'Reminder batches for approval', 'Help finding your way around'] },
];

export interface RoleCard { id: string; icon: string; title: string; headline: string; bullets: string[]; }
export const ROLES: RoleCard[] = [
  { id: 'admin', icon: 'admin_panel_settings', title: 'School Admins', headline: 'Run school operations from one place.',
    bullets: ['Students, staff, classes and fees in one system', 'Turn modules on or off to fit your school', 'Notices, reports and school-wide analytics'] },
  { id: 'teacher', icon: 'co_present', title: 'Teachers', headline: 'Handle attendance, timetable, assessments and classroom updates faster.',
    bullets: ['Mark attendance for your class', 'See your timetable and substitutions', 'Post homework, assessments and class updates'] },
  { id: 'parent', icon: 'family_restroom', title: 'Parents', headline: 'Stay informed about attendance, academics, notices and fees.',
    bullets: ['Follow each linked child in one login', 'Results, report cards and attendance', 'School notices and fee status'] },
  { id: 'student', icon: 'backpack', title: 'Students', headline: 'Access timetable, homework, results and school updates.',
    bullets: ['Timetable and homework', 'Results and report cards', 'Notices and the school calendar'] },
];

export interface WhyPoint { icon: string; title: string; text: string; }
export const WHY: WhyPoint[] = [
  { icon: 'account_tree', title: 'Designed around real school workflows', text: 'Attendance, exams, fees and notices work the way schools already operate.' },
  { icon: 'hub', title: 'One connected system', text: 'Replace disconnected tools with one place where records stay in sync.' },
  { icon: 'lock_person', title: 'Role-based access', text: 'Everyone sees what their role needs and nothing more.' },
  { icon: 'devices', title: 'Web and mobile experience', text: 'Use Edunexify in the browser or on Android.' },
  { icon: 'tune', title: 'Configurable modules', text: 'Enable the modules your plan includes and switch off the rest.' },
  { icon: 'upload_file', title: 'Guided onboarding', text: 'Import your students and teachers from CSV and get set up with our help.' },
  { icon: 'monitoring', title: 'Modern reporting and communication', text: 'Dashboards, report cards, notices and notifications in one place.' },
  { icon: 'auto_awesome', title: 'AI-assisted workflows', text: 'An assistant that works within each person’s role and school.' },
];

export interface Step { n: string; title: string; text: string; icon: string; }
export const STEPS: Step[] = [
  { n: '01', icon: 'workspace_premium', title: 'Choose a plan', text: 'Pick the plan that fits your school size. Not sure? Book a demo and we will help you choose.' },
  { n: '02', icon: 'upload_file', title: 'Import your data', text: 'Bring students and teachers across with CSV import. We guide you through the migration.' },
  { n: '03', icon: 'rocket_launch', title: 'Go live', text: 'Set up classes, roles and modules, then invite staff, parents and students to sign in.' },
];

export interface CopilotPoint { icon: string; text: string; }
export const COPILOT_POINTS: CopilotPoint[] = [
  { icon: 'search', text: 'Understand school data faster by simply asking.' },
  { icon: 'fact_check', text: 'Get help with attendance and fee follow-ups.' },
  { icon: 'explore', text: 'Find your way around Edunexify without hunting through menus.' },
  { icon: 'task_alt', text: 'Review suggested reminder batches before anything is sent.' },
  { icon: 'shield_person', text: 'Works within each person’s role and school permissions.' },
];

/** Real testimonials only. Leave empty until genuine quotes (with permission) are available. */
export interface Testimonial { quote: string; name: string; role: string; school: string; logoSrc?: string; }
export const TESTIMONIALS: Testimonial[] = [];

export interface Faq { q: string; a: string; }
export const FAQS: Faq[] = [
  { q: 'How long does onboarding take?',
    a: 'It depends on your school’s size and how ready your data is. We guide you through setup and migration, and we’ll give you a realistic plan during your demo.' },
  { q: 'Can we import our existing student data?',
    a: 'Yes. Students and teachers can be imported from CSV files, and we guide you through preparing them.' },
  { q: 'Can teachers, parents and students use Edunexify?',
    a: 'Yes. Admins, teachers, parents and students each sign in with their own role and see what is relevant to them.' },
  { q: 'Is Android supported?',
    a: 'Yes. Edunexify is available as a web and Android experience, so staff, parents and students can stay connected from a browser or a phone.' },
  { q: 'Can modules be enabled or disabled?',
    a: 'Yes. Modules are included by plan, and a school admin can switch the available modules on or off to fit how the school works.' },
  { q: 'Is online payment optional?',
    a: 'Yes. Fee management and online payments are separate modules, so you can track fees without collecting them online.' },
  { q: 'Can we upgrade plans later?',
    a: 'Yes. A school admin can review the available plans and upgrade from School Settings.' },
  { q: 'Is school data secure?',
    a: 'Access is role-based, sessions use secure HTTP-only cookies, and each school’s data is kept separate from every other school. Ask us during your demo about anything specific you need.' },
];

/**
 * "Best for" positioning per tier. Prices, student/staff limits, AI availability and the capability
 * list are always read from the live plan data — this file never states an entitlement.
 */
export const PLAN_BEST_FOR: Record<string, string> = {
  CAMPUS: 'Smaller schools starting their digital journey.',
  ACADEMY: 'Growing schools needing advanced academics and automation.',
  INSTITUTE: 'Larger schools needing complete operations, AI and advanced controls.',
};
