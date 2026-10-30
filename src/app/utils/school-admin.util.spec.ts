import { activationDialog, activationResultMessage, schoolEditPayload, schoolOnboardPayload, schoolSlugFromName, onboardingResultDialog, setupLinkError, setupLinkFeedback } from './school-admin.util';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('school administration normalization', () => {
  it('generates the same slug for spaces and punctuation', () => {
    expect(schoolSlugFromName('A & B')).toBe('a-b');
    expect(schoolSlugFromName("  St. Mary's   Convent School ")).toBe('st-mary-s-convent-school');
    expect(schoolSlugFromName('Délhi Public School #2')).toBe('delhi-public-school-2');
    expect(schoolSlugFromName('---')).toBe('');
    expect(schoolSlugFromName(null)).toBe('');
  });

  it('edit payload: trimmed text; an emptied optional field is cleared (""), never null (= unchanged)', () => {
    const payload = schoolEditPayload({
      name: '  Green Valley ', slug: ' Green-Valley ', website: '   ', email: ' office@gv.in ', phone: null,
      boardType: '', plan: 'BASIC', maxStudents: null, expiryDate: '',
    });
    expect(payload.name).toBe('Green Valley');
    expect(payload.slug).toBe('green-valley');
    expect(payload.website).toBe('');
    expect(payload.email).toBe('office@gv.in');
    expect(payload.phone).toBe('');
    expect(payload.boardType).toBeNull();
    expect(payload.plan).toBe('BASIC');
    expect(payload.maxStudents).toBeNull();
    expect(payload.expiryDate).toBeNull();
  });

  it('edit payload never carries activation', () => {
    const payload = schoolEditPayload({ name: 'X', slug: 'x', active: true } as any);
    expect('active' in payload).toBeFalse();
    expect('newAdminPassword' in payload).toBeFalse();
  });

  it('onboard payload: empty optional fields are null; slug lowercased', () => {
    const payload = schoolOnboardPayload({ name: ' New School ', slug: 'New-School', website: ' ', boardType: '',
      trialPlanId: null, academicYearStartMonth: 4 });
    expect(payload).toEqual({ name: 'New School', slug: 'new-school', website: null, boardType: null,
      trialPlanId: null, academicYearStartMonth: 4 } as any);
  });

  it('onboard payload never carries an admin password, even from an older form model', () => {
    const payload = schoolOnboardPayload({ name: 'S', slug: 's', adminEmail: 'a@s.in', adminPassword: 'Secret12' } as any);
    expect('adminPassword' in payload).toBeFalse();
  });

  it('activation is a distinct confirmed action with plain (non-HTML) text', () => {
    const off = activationDialog({ name: '<b>A</b>', active: true });
    expect(off.title).toBe('Deactivate School?');
    expect(off.danger).toBeTrue();
    expect(off.html).toBeUndefined();
    expect(off.message).toContain('"<b>A</b>"');
    expect(activationDialog({ name: 'A', active: false }).confirmText).toBe('Yes, activate');
    expect(activationResultMessage({ name: 'A' }, false)).toBe('"A" has been deactivated.');
  });

  it('onboarding result: no separate school welcome when the school email is the admin email; unusable slug falls back', () => {
    const dialog = onboardingResultDialog({ name: 'S', slug: 'Bad Slug!', email: ' Admin@S.in ' }, { userId: 'S_ADMIN', email: 'admin@s.in' });
    expect(dialog.message).not.toContain('welcome email');
    expect(dialog.message).toContain('School sign-in page: https://edunexify.co.in');
    expect(dialog.message).toContain('(S_ADMIN) at admin@s.in');
  });

  it('setup-link feedback and errors are plain and never contain a link', () => {
    expect(setupLinkFeedback({ status: 'SENT', sentTo: 'a••••@s.in' }).level).toBe('success');
    expect(setupLinkFeedback({ status: 'RECENTLY_SENT', sentTo: 'a••••@s.in' }).level).toBe('info');
    expect(setupLinkError({ status: 404 })).toBe('Administrator not found.');
    expect(setupLinkError({ status: 409, error: { message: 'Inactive.' } })).toBe('Inactive.');
    expect(setupLinkError({ status: 0 })).toBe('Could not send the setup link. Please try again.');
  });
});
