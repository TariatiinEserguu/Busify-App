/** Roles, permissions and status values shared by the client and server. */

export const ROLES = ['PASSENGER', 'SUPPORT', 'ADMIN'] as const;
export type RoleName = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleName, string> = {
  PASSENGER: 'Passenger',
  SUPPORT: 'Support agent',
  ADMIN: 'Administrator',
};

/**
 * Permission keys. Authorization on the server is always checked against the
 * permissions stored in the database for the user's role — never against
 * anything the client sends.
 */
export const PERMISSIONS = {
  JOURNEYS_USE: 'journeys:use',
  TICKETS_CREATE: 'tickets:create',
  TICKETS_MANAGE: 'tickets:manage',
  TICKETS_ESCALATE: 'tickets:escalate',
  SUPPORT_REPORTS: 'support:reports',
  PASSENGER_HISTORY_VIEW: 'passengers:history',
  ROUTES_MANAGE: 'routes:manage',
  STOPS_MANAGE: 'stops:manage',
  USERS_MANAGE: 'users:manage',
  REPORTS_VIEW: 'reports:view',
  AUDIT_VIEW: 'audit:view',
  SETTINGS_MANAGE: 'settings:manage',
} as const;
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'journeys:use': 'Plan journeys and receive bus stop alerts',
  'tickets:create': 'Submit and follow own support requests',
  'tickets:manage': 'View all support requests, reply and change status',
  'tickets:escalate': 'Escalate support requests to an administrator',
  'support:reports': 'View resolved-case reports',
  'passengers:history': "View a complaining passenger's journey history",
  'routes:manage': 'Create, edit and delete bus routes',
  'stops:manage': 'Create, edit and delete bus stops',
  'users:manage': 'View users, change roles and account status',
  'reports:view': 'View statistics and error reports',
  'audit:view': 'View the administrative audit log',
  'settings:manage': 'Change system settings',
};

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  PASSENGER: ['journeys:use', 'tickets:create'],
  SUPPORT: [
    'journeys:use',
    'tickets:create',
    'tickets:manage',
    'tickets:escalate',
    'support:reports',
    'passengers:history',
  ],
  ADMIN: Object.values(PERMISSIONS),
};

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ROUTE_STATUSES = ['ACTIVE', 'INACTIVE', 'DRAFT'] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];
export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  ACTIVE: 'In service',
  INACTIVE: 'Suspended',
  DRAFT: 'Draft',
};

export const JOURNEY_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number];
export const JOURNEY_STATUS_LABELS: Record<JourneyStatus, string> = {
  ACTIVE: 'Tracking',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};

export const TICKET_CATEGORIES = ['COMPLAINT', 'FEEDBACK', 'QUESTION', 'APP_PROBLEM', 'ROUTE_DATA'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  COMPLAINT: 'Complaint',
  FEEDBACK: 'Feedback',
  QUESTION: 'Question',
  APP_PROBLEM: 'App problem',
  ROUTE_DATA: 'Wrong route or stop data',
};

export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

/** Error codes returned in `{ error: { code } }` that the client reacts to. */
export const ERROR_CODES = {
  VALIDATION: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  ACTIVE_JOURNEY_EXISTS: 'ACTIVE_JOURNEY_EXISTS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  DEMO_ACCOUNT_DISABLED: 'DEMO_ACCOUNT_DISABLED',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  RATE_LIMITED: 'RATE_LIMITED',
  CSRF: 'CSRF_HEADER_MISSING',
  INTERNAL: 'INTERNAL_ERROR',
} as const;
