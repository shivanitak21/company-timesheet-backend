# API contract

Base URL: `/api/v1`

Both the React web app and the React Native app use this contract and the same database behind it. Send JSON. Authenticated routes require:

```http
Authorization: Bearer <accessToken>
```

Optional client hint:

```http
X-Client-Platform: web | mobile
```

## Envelope

```json
{ "success": true, "data": {} }
```

Paginated:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "path": "body.email", "message": "Invalid email" }],
    "requestId": "uuid"
  }
}
```

`X-Request-Id` is echoed on every response.

## Client auth flow

1. `POST /auth/login` returns `accessToken` and `refreshToken`.
2. Store the access token in memory on web, and in secure storage on mobile. Store the refresh token in secure storage on both.
3. Send the access token on every call.
4. On `401` with `INVALID_ACCESS_TOKEN` or `TOKEN_REVOKED`, call `POST /auth/refresh` once and retry the original request.
5. On `401` from refresh (`INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSED`, `ACCOUNT_DISABLED`), clear tokens and show login.
6. Call `POST /auth/logout` with the refresh token when the user signs out of that device. The other device stays signed in.
7. Do not recompute fillability. Use `lockReasons` from the calendar. The server rejects illegal writes even if the UI is stale.

Access tokens expire in 15 minutes by default. Refresh tokens expire in 7 days and rotate on every refresh.

## Shared types

User:

```json
{
  "id": "24 hex",
  "email": "a@b.com",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "role": "employee",
  "isActive": true,
  "lastLoginAt": null
}
```

Roles: `employee`, `manager`, `admin`.

Lock reasons: `weekend`, `holiday`, `leave`, `future`, `previous_month`, `entry_window`, `pending_approval`, `approved`.

Calendar responses include `entryWindow`: `{ timezone, today, yesterday, openFrom, openThrough, message }`. Employees may create, edit, and delete entries only for `openFrom` through `openThrough` (today and yesterday in `COMPANY_TIMEZONE`). Older dates return `409 TIMESHEET_ENTRY_WINDOW_CLOSED`. Future dates are never writable. `TIMESHEET_ENTRY_WINDOW_OVERRIDE_ROLES` can let listed roles edit their own older entries.

Timesheet status: `draft`, `submitted`, `approved`, `rejected`.

## Health

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` and `/api/v1/health` | Public |
| GET | `/ready` | Public. `503 NOT_READY` when MongoDB is down |

## Auth `/api/v1/auth`

### POST `/login`

```json
{ "email": "ada@company.com", "password": "secret123" }
```

`200` data:

```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "accessTokenExpiresIn": "15m",
  "user": {}
}
```

Errors: `401 INVALID_CREDENTIALS`, `403 ACCOUNT_DISABLED`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

### POST `/refresh`

```json
{ "refreshToken": "jwt" }
```

Returns the same data shape as login. The previous refresh token is revoked.

Errors: `401 INVALID_REFRESH_TOKEN`, `401 REFRESH_TOKEN_REUSED`, `403 ACCOUNT_DISABLED`.

### POST `/logout`

```json
{ "refreshToken": "jwt" }
```

`200` `{ "revoked": true }`. Invalid tokens still return `200` with `revoked: false` so a client can clear local storage.

### POST `/logout-all`

Auth required. Revokes every refresh token for the current user.

### GET `/me`

Auth required. Data is `{ "user": {}, "profile": {} | null }`.

### POST `/change-password`

```json
{ "currentPassword": "oldpass12", "newPassword": "newpass12" }
```

Revokes all refresh tokens. Existing access tokens fail on the next request.

Errors: `401 INVALID_CREDENTIALS`, `422 VALIDATION_ERROR`.

Passwords are 8–72 characters and must contain a letter and a number.

## Users `/api/v1/users`

Admin unless noted.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/users` | Query: `page`, `limit`, `search`, `role`, `isActive` (`true`/`false`) |
| POST | `/users` | Creates the login and, for non-admins, the employee profile |
| GET | `/users/:id` | Self, admin, or that employee's manager |
| PATCH | `/users/:id` | Self may change `firstName` and `lastName`. Admin may also change `email`, `role`, `isActive` |
| POST | `/users/:id/reset-password` | Admin. Body `{ "password": "newpass12" }` |

Create body:

```json
{
  "email": "ada@company.com",
  "password": "secret123",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "role": "employee",
  "employeeCode": "EMP001",
  "department": "Engineering",
  "designation": "Developer",
  "joiningDate": "2026-01-15",
  "employmentType": "full_time",
  "weeklyHours": 40,
  "phone": "",
  "managerId": "manager user id"
}
```

`managerId` is required when `role` is `employee`. Profile fields are required for `employee` and `manager`. Admins do not need a profile.

Errors: `409 EMAIL_EXISTS`, `409 EMPLOYEE_CODE_EXISTS`, `422 VALIDATION_ERROR`, `403 FORBIDDEN`.

## Employees `/api/v1/employees`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/employees` | Employee: self. Manager: self and direct reports. Admin: all. Query: `page`, `limit`, `search`, `department`, `managerId` |
| GET | `/employees/me` | Current profile or `404 PROFILE_NOT_FOUND` |
| GET | `/employees/:id` | Profile id, scoped |
| PATCH | `/employees/:id` | Self: `phone`. Manager of that employee: `phone`, `department`, `designation`, `managerId`. Admin: those plus `employeeCode`, `joiningDate`, `employmentType`, `weeklyHours` |

## Attendance `/api/v1/attendance`

All roles may check themselves in and out. Dates use the company timezone.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/check-in` | Body `{ "notes": "", "platform": "web" }`. `201` |
| POST | `/check-out` | Body `{ "notes": "", "platform": "mobile" }` |
| GET | `/today` | Data `{ "attendance": {} \| null }` |
| GET | `/history` | Query `from`, `to` (`YYYY-MM-DD`, max 92 days), optional `userId` |
| PATCH | `/:id` | Manager of that employee, or admin. Correction body `{ "checkInAt", "checkOutAt", "notes" }` as ISO datetimes |

Errors: `409 ALREADY_CHECKED_IN`, `409 ALREADY_COMPLETE`, `409 NOT_CHECKED_IN`.

Attendance object:

```json
{
  "id": "",
  "userId": "",
  "date": "2026-09-29",
  "status": "checked_in",
  "checkInAt": "2026-09-29T04:00:00.000Z",
  "checkOutAt": null,
  "workMinutes": null,
  "notes": null,
  "platform": "web"
}
```

## Timesheets `/api/v1/timesheets`

Optional `userId` on reads is limited to self, a direct report, or any user for an admin.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/calendar` | Query `year`, `month`, optional `userId`. Day grid, lock reasons, attendance, totals |
| GET | `/daily` | Query `date`, optional `userId` |
| GET | `/` | Query `year`, `month`, optional `userId`. Timesheet, entries, daily, weekly, monthly totals |
| GET | `/pending` | Manager and admin queue |
| GET | `/:id` | One timesheet plus entries and totals |
| POST | `/entries` | Create assigned or unassigned work. `201` |
| PATCH | `/entries/:entryId` | Full replacement of the entry fields |
| DELETE | `/entries/:entryId` | |
| POST | `/:id/submit` | Owner only. Status becomes `submitted` |
| POST | `/:id/approve` | Manager of owner, or admin. Not self |
| POST | `/:id/reject` | Body `{ "reason": "..." }` |

### Create entry

Assigned:

```json
{
  "workType": "assigned",
  "taskId": "task id",
  "date": "2026-09-29",
  "startTime": "09:00",
  "endTime": "12:00",
  "description": "Implemented calendar API"
}
```

Unassigned:

```json
{
  "workType": "unassigned",
  "projectId": "optional project id",
  "date": "2026-09-29",
  "startTime": "13:00",
  "endTime": "17:30",
  "description": "Team support"
}
```

`201` data:

```json
{
  "entry": {
    "id": "",
    "date": "2026-09-29",
    "workType": "unassigned",
    "description": "Team support",
    "startTime": "13:00",
    "endTime": "17:30",
    "durationMinutes": 270,
    "project": null,
    "task": null
  },
  "timesheet": { "id": "", "status": "draft", "year": 2026, "month": 9, "totalMinutes": 270 },
  "dayTotalMinutes": 270,
  "monthTotalMinutes": 270
}
```

Weekly totals use Monday–Sunday weeks:

```json
{ "weekStart": "2026-09-28", "weekEnd": "2026-10-04", "totalMinutes": 270 }
```

Calendar day (trimmed):

```json
{
  "date": "2026-09-29",
  "weekday": 2,
  "isWeekend": false,
  "isHoliday": false,
  "holidayName": null,
  "isOnLeave": false,
  "leaveType": null,
  "isFuture": false,
  "isPreviousMonth": false,
  "isFillable": true,
  "lockReasons": [],
  "totalMinutes": 270,
  "entryCount": 1,
  "attendance": null
}
```

`weekday` is `0` Sunday through `6` Saturday.

Entry errors: `409 TIMESHEET_ENTRY_WINDOW_CLOSED`, `409 NOT_FILLABLE`, `409 TIMESHEET_LOCKED`, `409 OVERLAPPING_ENTRY`, `409 ENTRY_LIMIT`, `403 FORBIDDEN`, `404 NOT_FOUND`. Window errors include top-level `code` and `message` plus the nested `error` object.

Submit errors: `409 EMPTY_TIMESHEET`, `409 INVALID_STATUS`, `409 PREVIOUS_MONTH`.

Approval errors: `409 INVALID_STATUS`, `403 FORBIDDEN`.

An assigned task must be assigned to the signed-in user and must not be cancelled. The project is taken from the task.

## Tasks `/api/v1/tasks`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/assigned` | Tasks assigned to the current user. Query `status`, `page`, `limit`. Cancelled hidden unless `status=cancelled` |
| GET | `/` | Employee: same as assigned. Manager: tasks for self and direct reports. Admin: all |
| POST | `/` | Manager or admin |
| GET | `/:id` | Assignee, assigner, project manager, report's manager, or admin |
| PATCH | `/:id` | Assignee may set `status` to `todo`, `in_progress`, or `done`. Managers may update all fields and cancel |

Create body:

```json
{
  "projectId": "",
  "title": "Ship timesheet API",
  "description": "",
  "assignedTo": "user id",
  "priority": "medium",
  "dueDate": "2026-10-03",
  "estimatedMinutes": 240
}
```

## Projects `/api/v1/projects`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Employees see active projects they can log against. Managers and admins see all. Query `status`, `page`, `limit`, `search` |
| POST | `/` | Manager or admin |
| GET | `/:id` | |
| PATCH | `/:id` | Admin or the project manager |

Create body:

```json
{
  "name": "Internal",
  "code": "PRJ-INT",
  "description": "",
  "managerId": "user id",
  "memberIds": [],
  "startDate": "2026-01-01",
  "endDate": null,
  "status": "active"
}
```

An empty `memberIds` list means any employee may record unassigned time on the project. Archived projects cannot be used on new entries.

## Leaves `/api/v1/leaves`

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/` | Employee requests leave |
| GET | `/` | Scoped list. Query `status`, `userId`, `page`, `limit` |
| GET | `/approved` | Query `year`, optional `userId` |
| GET | `/pending` | Manager and admin |
| GET | `/:id` | |
| POST | `/:id/approve` | Manager or admin, not self |
| POST | `/:id/reject` | Body `{ "reason": "..." }` |
| POST | `/:id/cancel` | Owner may cancel `pending`. Admin may cancel `pending` or `approved` |

Request:

```json
{
  "type": "annual",
  "startDate": "2026-10-05",
  "endDate": "2026-10-06",
  "reason": "Family travel"
}
```

`dayCount` excludes weekends and holidays. A range with no working days returns `422 NO_WORKING_DAYS`.

Errors: `409 LEAVE_OVERLAP`, `409 LEAVE_HAS_TIME_ENTRIES`, `409 TIMESHEET_LOCKED`, `409 INVALID_STATUS`.

Approval is rejected when the dates already contain timesheet entries, or when that month's timesheet is submitted or approved.

## Holidays `/api/v1/holidays`

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/holidays?year=2026` | Any signed-in user. Year defaults to the company year |
| POST | `/holidays` | Admin. `{ "name": "Republic Day", "date": "2026-01-26" }` |
| PATCH | `/holidays/:id` | Admin |
| DELETE | `/holidays/:id` | Admin |

Errors: `409 HOLIDAY_EXISTS`.

## Notifications `/api/v1/notifications`

Always scoped to the current user.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/` | Query `unreadOnly` (`true`/`false`), `page`, `limit`. `meta.unreadCount` included |
| GET | `/unread-count` | `{ "unreadCount": 0 }` |
| PATCH | `/:id/read` | |
| POST | `/read-all` | `{ "updated": 0 }` |

Events: timesheet submitted, approved, rejected; leave requested, approved, rejected; task assigned.

## Reports `/api/v1/reports`

Visibility matches employee scope. `userId` is optional. Without it, a manager receives direct reports plus self, and an admin receives active employees and managers (paginated).

| Method | Path | Query |
| --- | --- | --- |
| GET | `/attendance` | `from`, `to` (max 92 days), optional `userId`, `page`, `limit` |
| GET | `/timesheets` | `year`, `month`, optional `userId`, `page`, `limit` |
| GET | `/leaves` | `year`, optional `userId`, `page`, `limit` |
| GET | `/audit` | Admin. `page`, `limit`, optional `entityType`, `actorId` |

Attendance rows include a `days` array only when a single `userId` is requested. Multi-user responses return totals: `totalWorkMinutes`, `daysPresent`.

Timesheet rows: `status`, `monthlyTotalMinutes`, `weeklyTotals`.

Leave rows: `approvedDays`, `pendingDays`, `byType`.

## Common status codes

| HTTP | Code | When |
| --- | --- | --- |
| 400 | `INVALID_RANGE`, `INVALID_JSON` | Bad range or JSON |
| 401 | `MISSING_TOKEN`, `INVALID_ACCESS_TOKEN`, `INVALID_CREDENTIALS`, `TOKEN_REVOKED` | Auth |
| 403 | `FORBIDDEN`, `ACCOUNT_DISABLED`, `CORS_FORBIDDEN` | Role or account |
| 404 | `NOT_FOUND` | Missing route or record |
| 409 | Domain codes above | Business rule conflict |
| 422 | `VALIDATION_ERROR` | Zod |
| 429 | `RATE_LIMITED` | Limiter |
| 500 | `INTERNAL_ERROR` | Unexpected |
| 503 | `NOT_READY` | Database down |
