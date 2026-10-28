import { describe, expect, it } from 'vitest';
import {
  registerSchema,
  routeSchema,
  routeStopsSchema,
  stopSchema,
  systemSettingsSchema,
  toFieldIssues,
  userSettingsSchema,
} from './schemas';

function issuesOf(result: { success: boolean; error?: unknown }) {
  if (result.success) return [];
  return toFieldIssues(result.error as never);
}

describe('stopSchema', () => {
  const valid = { name: 'Central Plaza (demo)', latitude: 47.9185, longitude: 106.9177 };

  it('accepts a valid stop and trims text', () => {
    const parsed = stopSchema.parse({ ...valid, name: '  Central Plaza (demo) ', code: 'CP-01' });
    expect(parsed.name).toBe('Central Plaza (demo)');
    expect(parsed.description).toBe('');
  });

  it('accepts coordinates sent as strings from form inputs', () => {
    const parsed = stopSchema.parse({ ...valid, latitude: '47.9', longitude: '106.9' });
    expect(parsed.latitude).toBe(47.9);
  });

  it('rejects out-of-range latitude and longitude', () => {
    const issues = issuesOf(stopSchema.safeParse({ ...valid, latitude: 95, longitude: -200 }));
    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(['latitude', 'longitude']));
  });

  it('rejects non-numeric coordinates', () => {
    const issues = issuesOf(stopSchema.safeParse({ ...valid, latitude: 'north', longitude: 106.9 }));
    expect(issues[0].path).toBe('latitude');
  });

  it('rejects the 0,0 "null island" placeholder', () => {
    const issues = issuesOf(stopSchema.safeParse({ ...valid, latitude: 0, longitude: 0 }));
    expect(issues[0].message).toMatch(/ocean/);
  });

  it('requires a name', () => {
    const issues = issuesOf(stopSchema.safeParse({ ...valid, name: ' ' }));
    expect(issues[0].path).toBe('name');
  });

  it('validates the stop code format', () => {
    expect(stopSchema.safeParse({ ...valid, code: 'bad code!' }).success).toBe(false);
  });
});

describe('routeSchema', () => {
  const valid = { number: 'D1', name: 'East–West demo line' };

  it('applies defaults', () => {
    const parsed = routeSchema.parse(valid);
    expect(parsed.status).toBe('ACTIVE');
    expect(parsed.color).toBe('#1d4ed8');
  });

  it('rejects invalid route numbers, colours, status and times', () => {
    const issues = issuesOf(
      routeSchema.safeParse({ number: 'D 1!', name: 'x', color: 'blue', status: 'RUNNING', firstDeparture: '25:00' }),
    );
    const paths = issues.map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['number', 'name', 'color', 'status', 'firstDeparture']));
  });

  it('accepts schedule information', () => {
    const parsed = routeSchema.parse({ ...valid, firstDeparture: '06:30', lastDeparture: '22:15', headwayMinutes: 12 });
    expect(parsed.headwayMinutes).toBe(12);
  });
});

describe('routeStopsSchema', () => {
  it('keeps the given order', () => {
    expect(routeStopsSchema.parse({ stopIds: [3, 1, 2] }).stopIds).toEqual([3, 1, 2]);
  });

  it('rejects duplicate stops', () => {
    expect(routeStopsSchema.safeParse({ stopIds: [1, 2, 1] }).success).toBe(false);
  });
});

describe('account and settings schemas', () => {
  it('normalises email and enforces password rules', () => {
    expect(registerSchema.parse({ name: 'Bat', email: ' Bat@Example.COM ', password: 'secret123' }).email).toBe(
      'bat@example.com',
    );
    const issues = issuesOf(registerSchema.safeParse({ name: 'Bat', email: 'nope', password: 'short' }));
    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('does not accept a role field on registration (it is stripped)', () => {
    const parsed = registerSchema.parse({ name: 'Bat', email: 'b@x.mn', password: 'secret123', role: 'ADMIN' });
    expect(parsed).not.toHaveProperty('role');
  });

  it('bounds the alert radius', () => {
    const base = { soundEnabled: true, vibrationEnabled: true, notificationsEnabled: true, keepScreenAwake: true };
    expect(userSettingsSchema.safeParse({ ...base, alertRadiusM: 200 }).success).toBe(true);
    expect(userSettingsSchema.safeParse({ ...base, alertRadiusM: 10 }).success).toBe(false);
    expect(userSettingsSchema.safeParse({ ...base, alertRadiusM: 5000 }).success).toBe(false);
  });

  it('checks system settings ranges are consistent', () => {
    const base = {
      defaultAlertRadiusM: 200,
      minAlertRadiusM: 50,
      maxAlertRadiusM: 2000,
      gpsMaxAccuracyM: 150,
      alertConfirmReadings: 2,
      registrationOpen: true,
      announcement: '',
    };
    expect(systemSettingsSchema.safeParse(base).success).toBe(true);
    expect(systemSettingsSchema.safeParse({ ...base, minAlertRadiusM: 500, maxAlertRadiusM: 100 }).success).toBe(false);
    expect(systemSettingsSchema.safeParse({ ...base, defaultAlertRadiusM: 1900, maxAlertRadiusM: 1000 }).success).toBe(
      false,
    );
  });
});
