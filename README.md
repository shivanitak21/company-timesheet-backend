# Company Timesheet API

REST API for employee timesheet, attendance, leave, and task management. The React web app and the React Native app both use this service. Neither client connects to MongoDB.

Business rules (weekends, holidays, approved leave, locked months, overlaps, durations, and approvals) are enforced here and returned on the calendar as `isFillable` and `lockReasons`.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [API contract](docs/API_CONTRACT.md)

## Run locally

Requires Node.js 20+ and MongoDB.

```powershell
docker compose up -d
copy .env.example .env
```

Edit `.env` and replace both JWT secrets with random strings of at least 32 characters. Set `SEED_ADMIN_PASSWORD`.

```powershell
npm install
npm run seed
npm run dev
```

The API listens on `http://localhost:4000`.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |
| `npm test` | Date rules, totals, and HTTP shell |
| `npm run seed` | Create the admin. Set `SEED_DEMO=true` to also create a manager, employee, project, and task |

`CLIENT_WEB_URL` is the browser origin allowed by CORS. React Native calls usually send no `Origin` and are allowed. Set `CLIENT_MOBILE_URL` when the mobile web view sends an origin.

Set `TRUST_PROXY=1` when the API sits behind a reverse proxy.

## Clients

```http
POST /api/v1/auth/login
Authorization: Bearer <accessToken>
X-Client-Platform: web | mobile
```

Store the refresh token per device. Web and mobile sessions stay independent. Refresh with `POST /api/v1/auth/refresh` when the access token returns `401`.

Unassigned work is `POST /api/v1/timesheets/entries` with `"workType": "unassigned"`. Assigned work uses `"workType": "assigned"` and a `taskId`.
