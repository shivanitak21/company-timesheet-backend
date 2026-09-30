# Database schema

Database: MongoDB. ODM: Mongoose. Only this backend connects.

Dates that represent a civil day are strings `YYYY-MM-DD` in the company timezone. Instants (`checkInAt`, token expiry, review time) are BSON dates in UTC.

`refresh_tokens` is an authentication collection in addition to the domain models. It is required for refresh rotation across web and mobile sessions.

## users

| Field | Type | Notes |
| --- | --- | --- |
| email | string | Unique, lowercase |
| passwordHash | string | bcrypt, never returned by the API |
| role | `employee` \| `manager` \| `admin` | |
| firstName, lastName | string | |
| isActive | boolean | Inactive users cannot authenticate |
| passwordChangedAt | date | Access tokens issued earlier are rejected |
| lastLoginAt | date | |
| createdAt, updatedAt | date | |

Indexes: unique `email`.

## employee_profiles

| Field | Type | Notes |
| --- | --- | --- |
| user | ObjectId | Unique ref `users` |
| employeeCode | string | Unique |
| department, designation | string | |
| joiningDate | `YYYY-MM-DD` | |
| employmentType | `full_time` \| `part_time` \| `contract` | |
| weeklyHours | number | Default 40 |
| phone | string | |
| manager | ObjectId | Ref `users`. Required for employees |

Indexes: unique `user`, unique `employeeCode`, `manager`.

## attendances

One row per user per civil date.

| Field | Type | Notes |
| --- | --- | --- |
| user | ObjectId | |
| date | `YYYY-MM-DD` | |
| checkInAt | date | Server clock |
| checkOutAt | date | Set on check-out |
| status | `checked_in` \| `checked_out` | |
| workMinutes | number | Computed at check-out |
| notes | string | |
| platform | `web` \| `mobile` \| `unknown` | |

Indexes: unique `{ user, date }`.

## timesheets

One row per user per calendar month.

| Field | Type | Notes |
| --- | --- | --- |
| user | ObjectId | |
| year, month | numbers | Month is 1–12 |
| status | `draft` \| `submitted` \| `approved` \| `rejected` | |
| totalMinutes | number | Cache; reads also sum entries |
| submittedAt, reviewedAt | date | |
| reviewedBy | ObjectId | |
| rejectionReason | string | |

Indexes: unique `{ user, year, month }`.

Status flow: `draft -> submitted -> approved`, or `submitted -> rejected -> submitted`. Approved is terminal.

## timesheet_entries

| Field | Type | Notes |
| --- | --- | --- |
| timesheet | ObjectId | |
| user | ObjectId | Denormalized for range queries |
| date | `YYYY-MM-DD` | |
| project | ObjectId | Optional for unassigned work |
| task | ObjectId | Null for unassigned work |
| workType | `assigned` \| `unassigned` | |
| description | string | |
| startTime, endTime | `HH:mm` | |
| startMinutes, endMinutes | number | Minutes from midnight |
| durationMinutes | number | `endMinutes - startMinutes`, server-written |

Indexes: `{ user, date }`, `{ timesheet, date }`.

Overlap uses half-open ranges: `[startMinutes, endMinutes)`. `09:00–10:00` and `10:00–11:00` are allowed. Overnight entries are rejected.

## tasks

| Field | Type | Notes |
| --- | --- | --- |
| project | ObjectId | |
| title, description | string | |
| assignedTo, assignedBy | ObjectId | |
| status | `todo` \| `in_progress` \| `done` \| `cancelled` | |
| priority | `low` \| `medium` \| `high` | |
| dueDate | `YYYY-MM-DD` | Optional |
| estimatedMinutes | number | Optional |

Indexes: `{ assignedTo, status }`, `project`.

## projects

| Field | Type | Notes |
| --- | --- | --- |
| name, code | string | `code` unique, stored uppercase |
| description | string | |
| manager | ObjectId | Manager or admin |
| status | `active` \| `archived` | |
| members | ObjectId[] | Empty means any active employee may log unassigned time |
| startDate, endDate | `YYYY-MM-DD` | Optional |

Indexes: unique `code`.

## leaves

| Field | Type | Notes |
| --- | --- | --- |
| user | ObjectId | |
| type | `annual` \| `sick` \| `unpaid` \| `other` | |
| startDate, endDate | `YYYY-MM-DD` | Inclusive |
| dayCount | number | Weekdays that are not holidays |
| reason | string | |
| status | `pending` \| `approved` \| `rejected` \| `cancelled` | |
| reviewedBy, reviewedAt | | |
| rejectionReason | string | |

Indexes: `{ user, status, startDate, endDate }`.

Pending and approved ranges cannot overlap for the same user. Approved dates are not fillable on the timesheet.

## holidays

| Field | Type | Notes |
| --- | --- | --- |
| name | string | |
| date | `YYYY-MM-DD` | Unique |
| createdBy | ObjectId | |

Indexes: unique `date`.

## notifications

| Field | Type | Notes |
| --- | --- | --- |
| user | ObjectId | Recipient |
| type | string | Domain event name |
| title, message | string | |
| readAt | date | Null until read |
| metadata | object | Ids for deep links |

Indexes: `{ user, createdAt }`, `{ user, readAt }`.

## audit_logs

Append-only.

| Field | Type | Notes |
| --- | --- | --- |
| actor | ObjectId | |
| action | string | For example `ENTRY_CREATED`, `TIMESHEET_APPROVED` |
| entityType, entityId | string | |
| before, after | object | No password hashes |
| ip, userAgent | string | |
| createdAt | date | |

Indexes: `{ entityType, entityId, createdAt }`, `{ createdAt }`.

## refresh_tokens

| Field | Type | Notes |
| --- | --- | --- |
| user | ObjectId | |
| jti | string | Unique, matches the refresh JWT |
| family | string | Login session family (web and mobile are separate families) |
| expiresAt | date | TTL |
| revokedAt | date | |
| replacedByJti | string | Rotation pointer |
| userAgent, ip | string | |

Indexes: unique `jti`, `user`, TTL on `expiresAt`.

Presenting a revoked refresh token revokes the whole family (reuse detection).
