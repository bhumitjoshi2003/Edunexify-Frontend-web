import { isStaffAttendanceUsable, staffAttendanceConfigError } from './staff-attendance-config.util';

/** Shared by the web and Android clients — keep the two copies identical. */
describe('staff attendance configuration bounds', () => {
  const valid = { schoolLatitude: 29.2183, schoolLongitude: 79.513, geofenceRadius: 200, lateThresholdMinutes: 10,
    schoolStartTime: '08:00', checkinWindowStart: '07:30', checkinWindowEnd: '09:00' };

  it('accepts the E2E configuration and the inclusive boundaries', () => {
    expect(staffAttendanceConfigError(valid)).toBeNull();
    expect(staffAttendanceConfigError({ schoolLatitude: 90, schoolLongitude: 180, geofenceRadius: 50, lateThresholdMinutes: 0 })).toBeNull();
    expect(staffAttendanceConfigError({ schoolLatitude: -90, schoolLongitude: -180, geofenceRadius: 5000, lateThresholdMinutes: 60 })).toBeNull();
  });

  it('rejects non-numeric, non-finite and out-of-range values', () => {
    expect(staffAttendanceConfigError({ schoolLatitude: 'abc' })).toMatch(/Latitude/);
    expect(staffAttendanceConfigError({ schoolLatitude: NaN })).toMatch(/Latitude/);
    expect(staffAttendanceConfigError({ schoolLatitude: -Infinity })).toMatch(/Latitude/);
    expect(staffAttendanceConfigError({ schoolLatitude: 90.0001 })).toMatch(/Latitude/);
    expect(staffAttendanceConfigError({ schoolLongitude: 180.5 })).toMatch(/Longitude/);
    expect(staffAttendanceConfigError({ geofenceRadius: -10 })).toMatch(/radius/);
    expect(staffAttendanceConfigError({ geofenceRadius: 12.5 })).toMatch(/radius/);
    expect(staffAttendanceConfigError({ lateThresholdMinutes: 61 })).toMatch(/Late threshold/);
    expect(staffAttendanceConfigError({ schoolStartTime: '25:00' })).toMatch(/School start time/);
    expect(staffAttendanceConfigError({ checkinWindowStart: '09:00', checkinWindowEnd: '07:30' })).toMatch(/start must be before/);
    expect(staffAttendanceConfigError({ checkinWindowStart: '08:00', checkinWindowEnd: '08:00' })).toMatch(/start must be before/);
  });

  it('readiness needs a complete, valid saved configuration (legacy invalid values are not "ready")', () => {
    expect(isStaffAttendanceUsable(valid)).toBeTrue();
    expect(isStaffAttendanceUsable({ ...valid, schoolLatitude: 0 })).toBeTrue();
    expect(isStaffAttendanceUsable({ ...valid, schoolLatitude: 999, schoolLongitude: -500, geofenceRadius: -10 })).toBeFalse();
    expect(isStaffAttendanceUsable({ ...valid, checkinWindowStart: '10:00', checkinWindowEnd: '07:00' })).toBeFalse();
    expect(isStaffAttendanceUsable({ ...valid, schoolLatitude: null })).toBeFalse();
    expect(isStaffAttendanceUsable(null)).toBeFalse();
  });
});
