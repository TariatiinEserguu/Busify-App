/**
 * Request validation schemas. The server uses them to validate every request
 * body; the client reuses them so forms show the same messages before sending.
 */
import { z } from 'zod';
import {
  ROUTE_STATUSES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  USER_STATUSES,
  ROLES,
} from './constants';
import { MAX_ALERT_RADIUS_M, MIN_ALERT_RADIUS_M } from './alertEngine';

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .pipe(z.email({ error: 'Enter a valid email address' }));

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z.object({
  name: trimmed(2, 80, 'Name'),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from the current one',
  });

export const profileSchema = z.object({
  name: trimmed(2, 80, 'Name'),
  phone: z
    .string()
    .trim()
    .max(32, 'Phone number is too long')
    .regex(/^[0-9+()\-\s]*$/, 'Use digits, spaces and + ( ) - only')
    .optional()
    .or(z.literal('')),
});

export const alertRadiusSchema = z.coerce
  .number({ error: 'Alert distance must be a number' })
  .int('Alert distance must be a whole number of metres')
  .min(MIN_ALERT_RADIUS_M, `Alert distance must be at least ${MIN_ALERT_RADIUS_M} m`)
  .max(MAX_ALERT_RADIUS_M, `Alert distance must be at most ${MAX_ALERT_RADIUS_M} m`);

export const userSettingsSchema = z.object({
  alertRadiusM: alertRadiusSchema,
  soundEnabled: z.boolean(),
  vibrationEnabled: z.boolean(),
  notificationsEnabled: z.boolean(),
  keepScreenAwake: z.boolean(),
});

export const latitudeSchema = z.coerce
  .number({ error: 'Latitude must be a number' })
  .refine(Number.isFinite, 'Latitude must be a number')
  .refine((v) => v >= -90 && v <= 90, 'Latitude must be between -90 and 90');

export const longitudeSchema = z.coerce
  .number({ error: 'Longitude must be a number' })
  .refine(Number.isFinite, 'Longitude must be a number')
  .refine((v) => v >= -180 && v <= 180, 'Longitude must be between -180 and 180');

export const stopSchema = z
  .object({
    name: trimmed(2, 100, 'Stop name'),
    code: z
      .string()
      .trim()
      .max(20, 'Stop code must be at most 20 characters')
      .regex(/^[A-Za-z0-9-_]*$/, 'Stop code may contain letters, digits, - and _ only')
      .optional()
      .or(z.literal('')),
    description: z.string().trim().max(500, 'Description must be at most 500 characters').optional().default(''),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  })
  .refine((v) => !(v.latitude === 0 && v.longitude === 0), {
    path: ['latitude'],
    message: '0, 0 is in the ocean — pick the stop location on the map or enter real coordinates',
  });

const timeOfDay = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time, e.g. 06:30')
  .optional()
  .or(z.literal(''));

export const routeSchema = z.object({
  number: z
    .string({ error: 'Route number is required' })
    .trim()
    .min(1, 'Route number is required')
    .max(12, 'Route number must be at most 12 characters')
    .regex(/^[A-Za-z0-9-]+$/, 'Route number may contain letters, digits and - only'),
  name: trimmed(2, 100, 'Route name'),
  description: z.string().trim().max(1000, 'Description must be at most 1000 characters').optional().default(''),
  status: z.enum(ROUTE_STATUSES, { error: 'Choose a valid status' }).default('ACTIVE'),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a hex value such as #1d4ed8')
    .default('#1d4ed8'),
  firstDeparture: timeOfDay,
  lastDeparture: timeOfDay,
  headwayMinutes: z.coerce
    .number()
    .int('Frequency must be a whole number of minutes')
    .min(1, 'Frequency must be at least 1 minute')
    .max(240, 'Frequency must be at most 240 minutes')
    .nullable()
    .optional(),
});

export const routeStopsSchema = z.object({
  stopIds: z
    .array(z.number().int().positive(), { error: 'stopIds must be a list of stop ids' })
    .max(200, 'A route can have at most 200 stops')
    .refine((ids) => new Set(ids).size === ids.length, 'A stop can appear only once on a route'),
});

export const startJourneySchema = z.object({
  routeId: z.number({ error: 'Choose a route' }).int().positive(),
  destinationStopId: z.number({ error: 'Choose a destination stop' }).int().positive(),
  alertRadiusM: alertRadiusSchema.optional(),
  replaceActive: z.boolean().optional().default(false),
});

const distanceReading = z.number().min(0).max(40_000_000);
const accuracyReading = z.number().min(0).max(100_000).nullable().optional();

export const journeyProgressSchema = z.object({
  distanceM: distanceReading,
  accuracyM: accuracyReading,
  simulated: z.boolean().optional().default(false),
  alertArmed: z.boolean().optional(),
});

export const journeyAlertSchema = z.object({
  distanceM: distanceReading,
  accuracyM: accuracyReading,
  simulated: z.boolean().optional().default(false),
});

export const journeyResetAlertSchema = z.object({
  stillNearStop: z.boolean().optional().default(false),
});

export const journeyUpdateSchema = z.object({
  alertRadiusM: alertRadiusSchema,
});

export const createTicketSchema = z.object({
  subject: trimmed(4, 120, 'Subject'),
  description: trimmed(10, 4000, 'Description'),
  category: z.enum(TICKET_CATEGORIES, { error: 'Choose a category' }),
  journeyId: z.number().int().positive().nullable().optional(),
  routeId: z.number().int().positive().nullable().optional(),
});

export const ticketResponseSchema = z.object({
  message: trimmed(1, 4000, 'Message'),
  internal: z.boolean().optional().default(false),
});

export const ticketUpdateSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    assignedToId: z.number().int().positive().nullable().optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.status !== undefined || v.priority !== undefined || v.assignedToId !== undefined, {
    message: 'Nothing to update',
  });

export const escalateTicketSchema = z.object({
  reason: trimmed(5, 1000, 'Escalation reason'),
});

export const adminUserUpdateSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((v) => v.role !== undefined || v.status !== undefined, { message: 'Nothing to update' });

export const systemSettingsSchema = z
  .object({
    defaultAlertRadiusM: alertRadiusSchema,
    minAlertRadiusM: alertRadiusSchema,
    maxAlertRadiusM: alertRadiusSchema,
    gpsMaxAccuracyM: z.coerce.number().int().min(10, 'At least 10 m').max(2000, 'At most 2000 m'),
    alertConfirmReadings: z.coerce.number().int().min(1, 'At least 1').max(5, 'At most 5'),
    registrationOpen: z.boolean(),
    announcement: z.string().trim().max(280, 'Announcement must be at most 280 characters'),
  })
  .refine((v) => v.minAlertRadiusM <= v.maxAlertRadiusM, {
    path: ['maxAlertRadiusM'],
    message: 'Maximum must be greater than or equal to minimum',
  })
  .refine((v) => v.defaultAlertRadiusM >= v.minAlertRadiusM && v.defaultAlertRadiusM <= v.maxAlertRadiusM, {
    path: ['defaultAlertRadiusM'],
    message: 'Default must be between the minimum and maximum',
  });

export const dateRangeSchema = z
  .object({
    from: z.iso.date({ error: 'Use YYYY-MM-DD' }).optional(),
    to: z.iso.date({ error: 'Use YYYY-MM-DD' }).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { path: ['to'], message: '"To" must be on or after "From"' });

export const clientErrorSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  stack: z.string().max(5000).optional(),
  path: z.string().max(500).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
export type StopInput = z.infer<typeof stopSchema>;
export type RouteInput = z.infer<typeof routeSchema>;
export type StartJourneyInput = z.infer<typeof startJourneySchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>;
export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;

export interface FieldIssue {
  path: string;
  message: string;
}

/** Flattens zod issues into `{ path: "a.b", message }` pairs for forms and API errors. */
export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}
