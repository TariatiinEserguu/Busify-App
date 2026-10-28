/** Shapes of the JSON returned by the BUSIFY API (dates arrive as ISO strings). */
import type {
  JourneyStatus,
  PermissionKey,
  RoleName,
  RouteStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserStatus,
} from '@busify/shared';

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: RoleName;
  roleLabel: string;
  status: UserStatus;
  mustChangePassword: boolean;
  isDemoAccount: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SessionPayload {
  user: User;
  permissions: PermissionKey[];
}

export interface PublicConfig {
  registrationOpen: boolean;
  announcement: string;
  alert: {
    defaultRadiusM: number;
    minRadiusM: number;
    maxRadiusM: number;
    gpsMaxAccuracyM: number;
    confirmReadings: number;
  };
  demoMode: boolean;
  httpsEnabled: boolean;
}

export interface UserSettings {
  alertRadiusM: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
  keepScreenAwake: boolean;
  updatedAt: string;
}

export interface RouteSummary {
  id: number;
  number: string;
  name: string;
  description: string;
  status: RouteStatus;
  color: string;
  firstDeparture: string | null;
  lastDeparture: string | null;
  headwayMinutes: number | null;
  isDemo: boolean;
  stopCount: number;
  firstStopName: string | null;
  lastStopName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RouteStopItem {
  position: number;
  id: number;
  name: string;
  code: string | null;
  description: string;
  latitude: number;
  longitude: number;
  isDemo: boolean;
}

export interface RouteDetail extends RouteSummary {
  stops: RouteStopItem[];
}

export interface StopRouteRef {
  id: number;
  number: string;
  name: string;
  color: string;
  status: RouteStatus;
  position: number;
}

export interface Stop {
  id: number;
  code: string | null;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  routes: StopRouteRef[];
  distanceM?: number;
}

export interface Journey {
  id: number;
  userId: number;
  status: JourneyStatus;
  routeId: number | null;
  routeNumber: string;
  routeName: string;
  routeColor: string;
  destinationStopId: number | null;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  alertRadiusM: number;
  startedAt: string;
  pausedAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  alertTriggeredAt: string | null;
  alertDistanceM: number | null;
  alertCount: number;
  alertRearmPending: boolean;
  lastDistanceM: number | null;
  lastAccuracyM: number | null;
  lastPositionAt: string | null;
  usedSimulation: boolean;
  updatedAt: string;
}

export interface ActiveJourneyPayload {
  journey: Journey | null;
  route: RouteDetail | null;
}

export interface Person {
  id: number;
  name: string;
  role?: RoleName;
  email?: string;
}

export interface TicketSummary {
  id: number;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  escalated: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  passenger: { id: number; name: string; email: string };
  assignedTo: { id: number; name: string } | null;
  route: { id: number; number: string; name: string } | null;
  responseCount?: number;
}

export interface TicketResponse {
  id: number;
  message: string;
  isInternal: boolean;
  createdAt: string;
  author: Person | null;
}

export interface TicketEvent {
  id: number;
  type:
    | 'CREATED'
    | 'STATUS_CHANGED'
    | 'PRIORITY_CHANGED'
    | 'ASSIGNED'
    | 'RESPONSE_ADDED'
    | 'INTERNAL_NOTE'
    | 'ESCALATED'
    | 'REOPENED';
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  note: string | null;
  createdAt: string;
  actor: Person | null;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  journey: Journey | null;
  escalatedAt: string | null;
  escalatedBy?: { id: number; name: string } | null;
  escalationReason?: string | null;
  responses: TicketResponse[];
  events: TicketEvent[];
}

export interface TicketListPayload {
  tickets: TicketSummary[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<TicketStatus, number>;
  escalatedOpen?: number;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: number; name: string; email: string } | null;
}

export interface ErrorLogEntry {
  id: number;
  source: 'SERVER' | 'CLIENT';
  message: string;
  stack: string | null;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  userId: number | null;
  userAgent: string | null;
  context: unknown;
  createdAt: string;
}

export interface AdminUser extends User {
  journeyCount: number;
  ticketCount: number;
}

export interface SystemSettings {
  defaultAlertRadiusM: number;
  minAlertRadiusM: number;
  maxAlertRadiusM: number;
  gpsMaxAccuracyM: number;
  alertConfirmReadings: number;
  registrationOpen: boolean;
  announcement: string;
}

export type LiveJourney = Journey & { passenger: { id: number; name: string; email: string } };
