# QueueFlow

**QueueFlow** is a web-based queue management system for service teams. Managers create service queues, add people as tokens, organize the waiting line, serve customers, and review activity through live operational metrics and analytics.

## Live deployment

- **Application:** [https://smart-queue-management-system-4u183y1db.vercel.app/](https://smart-queue-management-system-4u183y1db.vercel.app/)
- **API health check:** [https://smart-queue-management-system-et10.onrender.com/api/health](https://smart-queue-management-system-et10.onrender.com/api/health)

The API health check should return `{"status":"ok"}`. Render's free web service may take a short time to wake up after a period of inactivity.

## Features

- Manager registration, login, and logout using bcrypt password hashes and JWT-backed HTTP-only cookies.
- Protected manager dashboard and profile settings.
- Create, rename, search, view, and delete queues.
- Add people to queues with an optional phone number.
- Automatically generated, queue-specific token numbers that are not reused.
- Reorder waiting tokens using move-up/move-down controls or drag and drop.
- Serve the next waiting token, complete a serving token, or cancel a waiting token.
- Preserve completed and cancelled token history.
- Queue-level counts and database-backed analytics, with today, 7-day, and 30-day filters.
- Dashboard KPI cards for total queues/tokens, waiting and serving counts, completions, cancellations, and average waiting time.
- Analytics charts for queue length, daily token volume, average waiting time, and token status distribution.
- Light and dark themes with the preference saved in the browser.
- Responsive layouts for desktop, tablet, and mobile.

**Account model:** Managers have accounts. Customers do not sign in; they are represented as tokens in a manager's queue.

**Pages:** Login, manager registration, dashboard, My Queues, queue details/token management, Analytics, and Profile/Settings.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Axios, Recharts, Lucide React |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Authentication | bcryptjs, JWT, HTTP-only cookies |
| Hosting | Vercel (frontend), Render (API and PostgreSQL) |

## Project structure

```text
.
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── AnalyticsPanel.jsx
│       ├── api.js
│       ├── components.jsx
│       ├── context.jsx
│       ├── main.jsx
│       ├── pages.jsx
│       └── styles.css
├── server/
│   ├── package.json
│   └── src/
│       ├── config/env.js
│       ├── db/
│       │   ├── initialize.js
│       │   ├── init.js
│       │   ├── pool.js
│       │   └── schema.sql
│       ├── middleware/
│       ├── routes/
│       └── index.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Run locally

### Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer

### Setup

1. Create a PostgreSQL database, for example `queueflow`. The application creates tables and indexes, but the PostgreSQL database itself must exist first.
2. From the project root, copy `.env.example` to `.env`.

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS/Linux:

   ```sh
   cp .env.example .env
   ```

3. Edit `.env` and set `DATABASE_URL` to your PostgreSQL connection string and `JWT_SECRET` to a long, random secret.
4. Install dependencies:

   ```sh
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

5. Start both frontend and API from the project root:

   ```sh
   npm run dev
   ```

   - Frontend: `http://localhost:5173`
   - API: `http://localhost:4000`

The API applies the schema from `server/src/db/schema.sql` before it starts listening. To apply it manually, run `npm run db:init --prefix server` from the project root.

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `DATABASE_URL` | API | PostgreSQL connection string. |
| `JWT_SECRET` | API | Long, randomly generated secret used to sign sessions. |
| `CLIENT_URL` | API | Exact frontend origin allowed by CORS, without a path or trailing slash. |
| `NODE_ENV` | API | Use `production` for deployment. |
| `PORT` | API | HTTP port; Render supplies this automatically. |
| `COOKIE_SECURE` | API | Set `true` when using HTTPS. |
| `COOKIE_SAME_SITE` | API | Use `none` for cross-site HTTPS frontend/API domains; use `lax` locally. |
| `VITE_API_URL` | Frontend | API base URL, including `/api`. |

Never commit `.env`, database URLs, passwords, or JWT secrets. `.env.example` contains placeholders only.

## Database and token rules

Schema source: [`server/src/db/schema.sql`](server/src/db/schema.sql). Schema initialization runs when the API starts and creates missing tables and indexes. The database user needs permission to create them.

| Table | Purpose |
| --- | --- |
| `managers` | Manager name, unique email, password hash, and creation time. |
| `queues` | Queue owner, name, creation time, and next token number. |
| `tokens` | Queue token number, person details, order, status, and lifecycle timestamps. |

The tables contain these columns:

- `managers`: `id` (UUID), `name`, `email`, `password_hash`, `created_at`.
- `queues`: `id` (UUID), `manager_id`, `name`, `next_token_number`, `created_at`.
- `tokens`: `id` (UUID), `queue_id`, `token_number`, `person_name`, `phone`, `position`, `status`, `created_at`, `service_started_at`, `completed_at`, `cancelled_at`.

Token statuses are `WAITING`, `SERVING`, `COMPLETED`, and `CANCELLED`. Database constraints enforce unique token numbers per queue and no more than one serving token per queue. Critical queue operations use transactions and lock the queue to prevent conflicting updates. Completed and cancelled tokens remain in the database for history and analytics.
Waiting time is measured from token creation to service start. Service duration is measured from service start to completion. Analytics use timestamps stored in PostgreSQL.

## API reference

Protected endpoints require the `queueflow_session` HTTP-only cookie returned by registration or login. Request and response bodies use JSON and camelCase. Errors are returned as JSON with an `error` message.

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register with `{ "name": "...", "email": "...", "password": "..." }`. |
| `POST` | `/api/auth/login` | Sign in with `{ "email": "...", "password": "..." }`. |
| `POST` | `/api/auth/logout` | Clear the session cookie. |
| `GET` | `/api/auth/me` | Get the signed-in manager. |
| `PATCH` | `/api/auth/me` | Update the manager name with `{ "name" }`. |

### Queues and tokens

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET`, `POST` | `/api/queues` | List queues or create one with `{ "name" }`. |
| `GET`, `PUT`, `DELETE` | `/api/queues/:id` | Get, rename, or delete an owned queue. |
| `GET`, `POST` | `/api/queues/:id/tokens` | List tokens or add one with `{ "personName", "phone?" }`. |
| `PATCH` | `/api/queues/:id/serve-next` | Start serving the first waiting token. |
| `PATCH` | `/api/tokens/:id/move` | Reorder with `{ "direction": "up" }` or `{ "direction": "down" }`; drag-and-drop uses `{ "targetTokenId": "<uuid>", "placement": "before" }` or `"after"`. |
| `PATCH` | `/api/tokens/:id/complete` | Complete the serving token. |
| `PATCH` | `/api/tokens/:id/cancel` | Cancel a waiting token. |

### Analytics and health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/analytics/overview?days=7&queueId=` | Queue and token KPI summary. |
| `GET` | `/api/analytics/trends?days=7&queueId=` | Daily token volume, queue length, average wait, and status distribution. |
| `GET` | `/api/analytics/queues/:id` | Lifetime totals for one queue. |
| `GET` | `/api/health` | API health check. |

Analytics `days` accepts values from 1 to 30. Optional queue filters are restricted to queues owned by the signed-in manager.

## Deployment

### Render: PostgreSQL and API

1. Create a Render PostgreSQL database and a Render **Web Service** for the API.
2. Set the Web Service root directory to `server`, build command to `npm install`, and start command to `npm start`.
3. Add these environment variables to the **Web Service**:
   - `DATABASE_URL`: the database's **Internal Database URL**.
   - `JWT_SECRET`: a long, random secret.
   - `CLIENT_URL`: your exact Vercel frontend origin, for example `https://your-project.vercel.app`.
   - `NODE_ENV=production`
   - `COOKIE_SECURE=true`
   - `COOKIE_SAME_SITE=none`
4. Ensure the PostgreSQL database itself exists. On startup, the API creates its tables and indexes from `schema.sql`.
5. Check the API at `https://<your-render-service>.onrender.com/api/health`.

### Vercel: frontend

1. Import the repository into Vercel and set the project root directory to `client`.
2. Add the environment variable `VITE_API_URL` with the Render API base URL, including `/api`. For this deployment:

   ```text
   https://smart-queue-management-system-et10.onrender.com/api
   ```

3. Deploy or redeploy the frontend after changing this variable. Vite embeds it at build time.
4. Set Render's `CLIENT_URL` to the exact Vercel origin you use to access the site.

If frontend and API use different domains, browsers may restrict cross-site cookies. HTTPS, `COOKIE_SECURE=true`, and `COOKIE_SAME_SITE=none` are required; a shared custom domain or same-site reverse proxy is more reliable.
