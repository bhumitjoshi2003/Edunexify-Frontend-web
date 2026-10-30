import { of, throwError } from 'rxjs';
import { SchoolSettingsComponent } from './school-settings.component';

/** LC-2: making a session current before it starts needs a second, typed confirmation and sends
 *  the explicit flag the backend requires; an already-started session keeps the single dialog. */
describe('School Settings — Make Current before a session starts', () => {
  let c: SchoolSettingsComponent;
  let toast: any;
  let sessions: any;
  const future = { id: 4, label: '2099-2100', startDate: '2099-04-01', endDate: '2100-03-31', current: false } as any;
  const started = { id: 1, label: '2020-2021', startDate: '2020-04-01', endDate: '2021-03-31', current: false } as any;
  const outcome = { session: future, activationPerformed: true, activation: { applied: 0, cleared: 0 } };

  beforeEach(() => {
    toast = { confirm: jasmine.createSpy(), success: jasmine.createSpy(), error: jasmine.createSpy(), warning: jasmine.createSpy() };
    sessions = {
      getActivationPreview: jasmine.createSpy().and.returnValue(of({ configuredCount: 1, ineligibleTeacher: 0, invalidClassOrSection: 0, clearing: 0, unchanged: 1, becomingLive: 0, changing: 0 })),
      getReadiness: jasmine.createSpy().and.returnValue(throwError(() => new Error('skip'))),
      setCurrentSession: jasmine.createSpy().and.returnValue(of(outcome)),
      getAllSessions: jasmine.createSpy().and.returnValue(of([])),
    };
    c = new SchoolSettingsComponent(
      {} as any, {} as any, {} as any, { markForCheck: () => {} } as any, { error: () => {} } as any, toast,
      { snapshot: { queryParamMap: { get: () => null } } } as any, sessions, {} as any, {} as any, { run: (fn: any) => fn() } as any
    );
    spyOn<any>(c, 'loadSessions');
  });

  it('asks a second, typed confirmation and sends the early-activation flag for a future session', async () => {
    toast.confirm.and.returnValues(Promise.resolve(true), Promise.resolve(true));
    await c.setCurrentSession(future);

    expect(toast.confirm).toHaveBeenCalledTimes(2);
    const second = toast.confirm.calls.argsFor(1)[0];
    expect(second.requiredInput).toBe('EARLY');
    expect(second.danger).toBeTrue();
    expect(second.html).toContain('before it begins');
    expect(sessions.setCurrentSession).toHaveBeenCalledWith(4, true);
  });

  it('does nothing when the early-activation confirmation is declined', async () => {
    toast.confirm.and.returnValues(Promise.resolve(true), Promise.resolve(false));
    await c.setCurrentSession(future);
    expect(sessions.setCurrentSession).not.toHaveBeenCalled();
  });

  it('keeps the single confirmation for a session that has already started', async () => {
    toast.confirm.and.returnValue(Promise.resolve(true));
    await c.setCurrentSession(started);
    expect(toast.confirm).toHaveBeenCalledTimes(1);
    expect(sessions.setCurrentSession).toHaveBeenCalledWith(1, false);
  });

  it('shows the server explanation when the backend refuses an early activation', async () => {
    toast.confirm.and.returnValue(Promise.resolve(true));
    sessions.setCurrentSession.and.returnValue(throwError(() => ({ status: 409, error: { code: 'FUTURE_SESSION_CONFIRMATION_REQUIRED', error: 'starts on 2021-04-01' } })));
    await c.setCurrentSession(started);
    expect(toast.error).toHaveBeenCalledWith('Error', 'starts on 2021-04-01');
  });
});
