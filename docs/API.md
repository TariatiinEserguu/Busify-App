# BUSIFY REST API

Base URL: `http://<computer>:4000/api` (or `/api` relative to the web app).
All bodies are JSON. Dates are ISO 8601 strings (UTC).

## Conventions

### Authentication

Sign in with `POST /api/auth/login`. The server answers with an **httpOnly session cookie**
(`busify_session`, `SameSite=Strict`, `Secure` when HTTPS is on). Browsers send it
automatically; with `curl` keep it in a cookie jar (`-c jar.txt -b jar.txt`).

The database stores only a SHA-256 hash of the session token. Signing out deletes the
session on the server. Role changes, suspensions and password resets sign the user out
everywhere.

### CSRF header

Every `POST`, `PUT`, `PATCH` and `DELETE` request must include the header
`X-Busify-Client: <anything>` (the web app sends `web`). Requests without it get
`403 CSRF_HEADER_MISSING`.

### Permissions

Authorisation is always checked on the server against the permissions stored in the
database for the user's role. A `role` sent by a client is ignored.

| Permission | Passenger | Support agent | Administrator |
|---|:-:|:-:|:-:|
| `journeys:use` – plan journeys, receive alerts | ✓ | ✓ | ✓ |
| `tickets:create` – submit own support requests | ✓ | ✓ | ✓ |
| `tickets:manage` – see all tickets, reply, change status | | ✓ | ✓ |
| `tickets:escalate` – escalate to administrators | | ✓ | ✓ |
| `support:reports` – resolved-case report | | ✓ | ✓ |
| `passengers:history` – journey history of a complaining passenger | | ✓ | ✓ |
| `routes:manage`, `stops:manage` | | | ✓ |
| `users:manage`, `reports:view`, `audit:view`, `settings:manage` | | | ✓ |

### Errors

Errors always have this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Latitude must be between -90 and 90",
    "issues": [{ "path": "latitude", "message": "Latitude must be between -90 and 90" }]
  }
}
```

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid body or query (`issues` lists each field) |
| 401 | `UNAUTHENTICATED` | Not signed in, or wrong email/password |
| 403 | `FORBIDDEN` | The role lacks the permission |
| 403 | `PASSWORD_CHANGE_REQUIRED` | A temporary password must be changed first |
| 403 | `ACCOUNT_SUSPENDED`, `DEMO_ACCOUNT_DISABLED`, `REGISTRATION_CLOSED`, `CSRF_HEADER_MISSING` | |
| 404 | `NOT_FOUND` | Unknown id, or a record that belongs to someone else |
| 409 | `CONFLICT`, `ACTIVE_JOURNEY_EXISTS` | Duplicate value, invalid state change |
| 413 | `VALIDATION_ERROR` | Body larger than 100 kB |
| 429 | `RATE_LIMITED` | Too many sign-in attempts (`AUTH_RATE_LIMIT` per 15 min) |
| 500 | `INTERNAL_ERROR` | Unexpected error (recorded in the error log) |
| 503 | `INTERNAL_ERROR` | Database unavailable or not migrated |

---

## Health and configuration

| Method & path | Auth | Description |
|---|---|---|
| `GET /api/health` | – | `{ status: "ok" \| "degraded", database: "ok" \| "error", uptimeSeconds, time, version, demoMode }`. Returns **503** when the database cannot be reached. |
| `GET /api/config` | – | Public settings: `registrationOpen`, `announcement`, `alert { defaultRadiusM, minRadiusM, maxRadiusM, gpsMaxAccuracyM, confirmReadings }`, `demoMode`, `httpsEnabled`. |

## Authentication — `/api/auth`

| Method & path | Auth | Body | Result |
|---|---|---|---|
| `POST /register` | – | `{ name, email, password }` | `201 { user, permissions }` + cookie. Always creates a **passenger**. Password: 8–128 chars with a letter and a digit. |
| `POST /login` | – | `{ email, password }` | `{ user, permissions }` + cookie |
| `POST /logout` | – | – | `204`, session deleted |
| `GET /me` | signed in | – | `{ user, permissions }` |
| `POST /change-password` | signed in | `{ currentPassword, newPassword }` | `{ user, permissions }`; other sessions are signed out |

`user` = `{ id, email, name, phone, role, roleLabel, status, mustChangePassword, isDemoAccount, lastLoginAt, createdAt }`.
Password hashes are never returned by any endpoint.

## Profile and alert settings — `/api/me`

| Method & path | Body | Result |
|---|---|---|
| `GET /settings` | – | `{ settings: { alertRadiusM, soundEnabled, vibrationEnabled, notificationsEnabled, keepScreenAwake, updatedAt } }` |
| `PUT /settings` | all five fields | `{ settings }` — radius must be within the system min/max |
| `PATCH /profile` | `{ name, phone? }` | `{ user }` |

## Routes — `/api/routes`

| Method & path | Permission | Description |
|---|---|---|
| `GET /?search=&includeInactive=true` | signed in | Routes in service, naturally sorted by number. `search` matches number, name or any stop name (accent/case-insensitive, Cyrillic included). `includeInactive` only works with `routes:manage`. |
| `GET /:id` | signed in | Route with `stops[]` in order (`position` 1…n). Suspended/draft routes are 404 for passengers. |
| `POST /` | `routes:manage` | Create. Body below. |
| `PUT /:id` | `routes:manage` | Replace the route's fields. |
| `PUT /:id/stops` | `routes:manage` | `{ stopIds: number[] }` — sets the ordered stop list (no duplicates, all must exist). |
| `DELETE /:id` | `routes:manage` | `204`. Active journeys on the route are ended (`ROUTE_REMOVED`); journey history keeps a snapshot. |

Route body:

```json
{
  "number": "D1",                 // letters, digits, '-'; stored upper-case; unique
  "name": "East–West Demo Line",
  "description": "",
  "status": "ACTIVE",             // ACTIVE | INACTIVE | DRAFT
  "color": "#1d4ed8",
  "firstDeparture": "06:30",      // optional HH:MM
  "lastDeparture": "22:30",       // optional HH:MM
  "headwayMinutes": 8             // optional, 1–240
}
```

## Stops — `/api/stops`

| Method & path | Permission | Description |
|---|---|---|
| `GET /?search=` | signed in | All stops with `routes[]` serving them (passengers see only routes in service). |
| `GET /nearby?lat=&lng=&radiusM=1500&limit=8` | signed in | Stops within `radiusM` (50–20000), nearest first, with `distanceM`. |
| `GET /:id` | signed in | One stop. |
| `POST /` | `stops:manage` | `{ name, code?, description?, latitude, longitude }`. Latitude −90…90, longitude −180…180, `0,0` rejected, code unique. |
| `PUT /:id` | `stops:manage` | Replace the stop's fields. |
| `DELETE /:id` | `stops:manage` | `204`. Removed from every route; remaining stops are renumbered. |

## Journeys — `/api/journeys` (permission `journeys:use`)

A journey is a passenger's active alert session. Only **one** journey per passenger
can be running (active or paused). Journeys store a snapshot of the route and
destination, so history survives later edits. Raw GPS coordinates are **not** stored —
only the latest distance to the destination.

| Method & path | Body | Description |
|---|---|---|
| `GET /active` | – | `{ journey \| null, route \| null }` — the running journey and its route with stops. |
| `GET /?limit=30` | – | Own journey history, newest first. |
| `POST /` | `{ routeId, destinationStopId, alertRadiusM?, replaceActive? }` | Start. `alertRadiusM` defaults to the passenger's setting. `409 ACTIVE_JOURNEY_EXISTS` if one is running, unless `replaceActive: true`. |
| `PATCH /:id` | `{ alertRadiusM }` | Change the alert distance of a running journey. |
| `POST /:id/pause` · `/resume` · `/cancel` · `/complete` | – | State changes. Invalid transitions return `409`. |
| `POST /:id/progress` | `{ distanceM, accuracyM?, simulated?, alertArmed? }` | Heartbeat (sent about every 15 s). |
| `POST /:id/alert` | `{ distanceM, accuracyM?, simulated? }` | Records that the approach alert fired. **Idempotent**: returns `{ journey, duplicate }`; repeated calls never count a second alert. |
| `POST /:id/reset-alert` | `{ stillNearStop? }` | Re-arms the alert (only after it fired). |

Journey states: `ACTIVE → PAUSED → ACTIVE`, `ACTIVE|PAUSED → COMPLETED|CANCELLED`.

## Support — `/api/support`

| Method & path | Permission | Description |
|---|---|---|
| `GET /tickets?status=&category=&escalated=&assigned=me\|unassigned&search=&page=&pageSize=` | signed in | Staff (`tickets:manage`) see all tickets; everyone else only their own. Includes `counts` per status. |
| `POST /tickets` | `tickets:create` | `{ subject, description, category, journeyId?, routeId? }`. Categories: `COMPLAINT`, `FEEDBACK`, `QUESTION`, `APP_PROBLEM`, `ROUTE_DATA`. The journey must be the passenger's own. |
| `GET /tickets/:id` | owner or staff | Ticket with `responses[]` and `events[]` (the action timeline). Internal notes and the escalation reason are hidden from passengers. |
| `POST /tickets/:id/responses` | owner or staff | `{ message, internal? }`. Staff may add internal notes. A staff reply moves an open ticket to *In progress*; a passenger reply re-opens a resolved one. |
| `PATCH /tickets/:id` | `tickets:manage` | `{ status?, priority?, assignedToId?, note? }`. Status: `OPEN`, `IN_PROGRESS`, `RESOLVED`. |
| `POST /tickets/:id/escalate` | `tickets:escalate` | `{ reason }`. Notifies every administrator. Only once per ticket. |
| `GET /tickets/:id/passenger-journeys` | `passengers:history` | Journey history of the passenger who raised the ticket (the view is audit-logged). |
| `GET /staff` | `tickets:manage` | People a ticket can be assigned to. |
| `GET /reports/resolved?from=YYYY-MM-DD&to=YYYY-MM-DD` | `support:reports` | Resolved cases in the period with resolution times, by category and by agent. Default: last 30 days. |

## Notifications — `/api/notifications`

| Method & path | Description |
|---|---|
| `GET /` | Latest 30 notifications and the `unread` count. |
| `POST /:id/read` | Mark one as read. |
| `POST /read-all` | Mark all as read. |

## Administration — `/api/admin`

| Method & path | Permission | Description |
|---|---|---|
| `GET /overview` | `reports:view` | Headline counts, last 7 days, live journeys, recent activity and errors. |
| `GET /journeys/active` | `reports:view` | Journeys being tracked now. |
| `GET /users?search=&role=&status=&page=&pageSize=` | `users:manage` | Users with trip and ticket counts. |
| `GET /users/:id` | `users:manage` | Account details, recent trips, tickets and activity. |
| `PATCH /users/:id` | `users:manage` | `{ role?, status? }`. You cannot change yourself; at least one active administrator must remain. Signs the user out. |
| `POST /users/:id/reset-password` | `users:manage` | Returns `{ temporaryPassword }` once; the user must change it at next sign-in. |
| `GET /roles` | `users:manage` | Roles, their permissions and user counts. |
| `GET /audit-logs?entityType=&action=&search=&page=&pageSize=` | `audit:view` | Audit trail of administrative and support actions. |
| `GET /errors?source=SERVER\|CLIENT&page=&pageSize=` | `reports:view` | Error log. |
| `GET /reports?from=&to=` | `reports:view` | Daily series and totals for journeys, alerts, accounts, tickets and errors; top destinations/routes; most frequent errors. Max 366 days. |
| `GET /settings` · `PUT /settings` | `settings:manage` | `{ defaultAlertRadiusM, minAlertRadiusM, maxAlertRadiusM, gpsMaxAccuracyM, alertConfirmReadings, registrationOpen, announcement }` |

## Client error reports

| Method & path | Auth | Body |
|---|---|---|
| `POST /api/client-errors` | optional | `{ message, stack?, path?, context? }` — rate-limited to 20/min per address. Shown in Admin → Activity & errors. |

## Example session with curl

```bash
curl -c jar.txt -H "X-Busify-Client: curl" -H "Content-Type: application/json" \
  -d '{"email":"passenger@busify.local","password":"BusifyDemo2026"}' \
  http://localhost:4000/api/auth/login

curl -b jar.txt "http://localhost:4000/api/routes?search=D1"

curl -b jar.txt -H "X-Busify-Client: curl" -H "Content-Type: application/json" \
  -d '{"routeId":1,"destinationStopId":9}' http://localhost:4000/api/journeys
```
