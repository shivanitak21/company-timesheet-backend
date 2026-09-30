# Architecture

`company-timesheet-backend` is the only process that connects to MongoDB. The React web app and the React Native app are separate repositories. Both call this versioned REST API. They do not embed business rules of their own.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Structure | Layer-first folders under `src/` | Matches the repository contract. Controllers stay thin; services own rules. |
| API | REST `/api/v1`, one JSON envelope | Web and mobile share a single contract. |
| Auth | JWT access token + rotating JWT refresh token | Mobile cannot rely on browser cookies. Both clients send `Authorization: Bearer`. |
| Passwords | bcrypt | Pure-JS implementation so Windows and Linux builds do not need native addons. |
| Validation | Zod at the HTTP boundary | Untrusted input never reaches a service unchecked. |
| Time rules | Pure functions plus company timezone | Fillability is unit-tested and returned to clients. The server still rejects illegal writes. |
| Data access | Mongoose models | No separate repository package. Models are the persistence boundary. |
| Real-time | Not in v1 | Clients poll notifications. |

## Request path

```text
Web or mobile
  -> HTTPS
  -> helmet, CORS, JSON parser, rate limit, request log
  -> /api/v1 route
  -> Zod validator
  -> controller
  -> service (authorization and business rules)
  -> Mongoose
  -> MongoDB
```

A controller parses the actor and the validated input, calls a service, and sends the JSON envelope. A service does not import Express request or response types.

## Folder layout

```text
src/
  app.ts                 Express app (no port binding)
  server.ts              Process entry, DB connect, graceful shutdown
  config/                Env validation, Mongo connection, constants
  types/                 Roles, actor, Express augmentation
  utils/                 Errors, dates, fillability, tokens, logging
  middleware/            Auth, RBAC, validation, errors, rate limits
  models/                Mongoose schemas and indexes
  validators/            Zod request schemas
  services/              Business rules and persistence orchestration
  controllers/           HTTP adapters
  routes/                Versioned routers
  scripts/seed.ts        Optional admin and demo data
```

## Business rules live here

Clients may hide weekends in the UI. The API still decides. `GET /api/v1/timesheets/calendar` returns `isFillable` and `lockReasons` for every day. Create, update, and delete re-check the same rules.

| Rule | Enforcement |
| --- | --- |
| Check-in / check-out | One attendance document per user per company-local date |
| Weekdays only | Saturday and Sunday lock reason `weekend` |
| Holidays | `holidays.date` lock reason `holiday` |
| Approved leave | Overlapping approved leave lock reason `leave` |
| Previous months | Read-only lock reason `previous_month` |
| Future dates | Lock reason `future` |
| Submitted | Lock reason `pending_approval` until a manager acts |
| Rejected | Owner may edit and submit again |
| Approved | Lock reason `approved` |
| Overlap | Same user and date, half-open minute ranges |
| Duration | Server computes minutes from `HH:mm` |
| Totals | Daily, weekly (Monday start), and monthly sums from stored minutes |
| Audit | `audit_logs` row for security and timesheet mutations |

Company "today" uses `COMPANY_TIMEZONE` (default `Asia/Kolkata`). Calendar dates are `YYYY-MM-DD` strings, not instants, so a phone in another timezone cannot shift the working day.

## Authorization

| Role | Scope |
| --- | --- |
| employee | Own attendance, timesheet, leave, tasks, notifications |
| manager | Own data plus direct reports (`employee_profiles.manager`) |
| admin | All records. Cannot approve or reject their own timesheet or leave |

Managers and admins do not edit another person's time entries. They approve or reject the submitted timesheet.

## Security controls

- Access JWTs expire quickly (default 15 minutes). Refresh JWTs rotate and are stored by `jti` so logout and reuse can revoke them.
- Password changes and deactivation invalidate existing access tokens on the next request.
- Auth routes have a stricter rate limit than the rest of `/api`.
- CORS allows `CLIENT_WEB_URL` and `CLIENT_MOBILE_URL`. Requests with no `Origin` (typical React Native) are allowed. Wildcard origins are not used.
- Helmet sets secure headers. Secrets come from the environment and fail startup if missing or still placeholders.
- Production error responses omit stack traces.

## Response envelope

Success:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 } }
```

`meta` is present on paginated or summary responses.

Failure:

```json
{
  "success": false,
  "error": { "code": "NOT_FILLABLE", "message": "Weekends are not fillable.", "details": [], "requestId": "..." }
}
```

Clients should branch on `error.code`, not on message text.

## Scaling notes

Rate-limit state is in memory and is correct for a single API instance. Run several instances behind sticky sessions or replace the limiter store before horizontal scale-out. Refresh tokens already support one web session and one mobile session at the same time.
