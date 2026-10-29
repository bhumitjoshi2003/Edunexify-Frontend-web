import { featureOperationKey, featureOverrideActions, featureOverrideErrorMessage } from './feature-override.util';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('feature override actions', () => {
  it('plan granted, no override: Disable only', () => {
    expect(featureOverrideActions({ overrideState: 'DEFAULT', planGranted: true })).toEqual({ enable: false, disable: true, reset: false });
  });

  it('plan not granted, no override: Enable only', () => {
    expect(featureOverrideActions({ overrideState: 'DEFAULT', planGranted: false })).toEqual({ enable: true, disable: false, reset: false });
  });

  it('enabled beyond the plan: Disable or Reset', () => {
    expect(featureOverrideActions({ overrideState: 'ENABLED', planGranted: false })).toEqual({ enable: false, disable: true, reset: true });
  });

  it('disabled although the plan grants it: Reset only (reset restores the plan default)', () => {
    expect(featureOverrideActions({ overrideState: 'DISABLED', planGranted: true })).toEqual({ enable: false, disable: false, reset: true });
  });

  it('disabled and not in the plan: Enable or Reset', () => {
    expect(featureOverrideActions({ overrideState: 'DISABLED', planGranted: false })).toEqual({ enable: true, disable: false, reset: true });
  });

  it('the same feature in two schools has two independent operation keys', () => {
    expect(featureOperationKey(1, 'TRANSPORT')).not.toBe(featureOperationKey(2, 'TRANSPORT'));
    expect(featureOperationKey(1, 'TRANSPORT')).toBe('1:TRANSPORT');
  });

  it('failed save: shows the server text (plain or { message }), else a fallback', () => {
    expect(featureOverrideErrorMessage({ error: 'Feature not found: X' })).toBe('Feature not found: X');
    expect(featureOverrideErrorMessage({ error: { message: 'Nope' } })).toBe('Nope');
    expect(featureOverrideErrorMessage({ status: 500 })).toBe('Failed to update feature override.');
  });
});
