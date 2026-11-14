# QueueFlow

QueueFlow is a queue management workspace for service managers. It includes a responsive React/Vite dashboard, an Express API, PostgreSQL persistence, manager registration and sign-in, token ordering and lifecycle controls, and database-backed analytics.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Local setup

1. Create a PostgreSQL database named `queueflow` (the database server does not create this database for the app).
2. From the repository root, copy `.env.example` to `.env` and set `DATABASE_URL` and a long random `JWT_SECRET`. Both the API and Vite load this root-level file.
3. Install dependencies:

   ```sh
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

4. Start the API and frontend. On startup, the API creates any missing tables and indexes from `server/src/db/schema.sql`:

   ```sh
   npm run dev
   ```

   The dashboard is at `http://localhost:5173`; the API listens on `http://localhost:4000`.

The API uses an HTTP-only, same-site session cookie. For local development, the default cookie is not marked secure. Set `COOKIE_SECURE=true` when serving the API over HTTPS.

## Database

`server/src/db/schema.sql` is the initial schema and is applied automatically at API startup. The database named in `DATABASE_URL` must already exist, and its user needs permission to create tables and indexes. You can also apply the same idempotent schema manually with `npm run db:init --prefix server`. Managers own queues; deleting a manager/queue cascades related data. Token rows remain in the database on cancel or completion to preserve history. Each queue's monotonically increasing counter generates never-reused token numbers.

Critical token actions run in PostgreSQL transactions and lock the parent queue row. This serializes arrivals, service, completion, cancellation, and reordering for a given queue while allowing separate queues to proceed concurrently.

## Configuration

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API listening port (default `4000`) |
| `CLIENT_URL` | Allowed frontend origin |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random secret used to sign manager sessions |
| `COOKIE_SECURE` | Set to `true` for HTTPS |
| `COOKIE_SAME_SITE` | `lax` locally; use `none` with `COOKIE_SECURE=true` for cross-site HTTPS |
| `VITE_API_URL` | Optional frontend API base URL (default `http://localhost:4000/api`) |

Never commit `.env` or production credentials.

## API

All JSON request/response bodies use camelCase. Protected endpoints require the `queueflow_session` HTTP-only cookie returned by register/login. Authentication endpoints are rate limited.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create manager `{name,email,password}` |
| POST | `/api/auth/login` | Sign in `{email,password}` |
| POST | `/api/auth/logout` | Clear the session cookie |
| GET | `/api/auth/me` | Current manager |
| PATCH | `/api/auth/me` | Update manager `{name}` |
| GET, POST | `/api/queues` | List queues / create `{name}` |
| GET, PUT, DELETE | `/api/queues/:id` | Read, rename `{name}`, or delete owned queue |
| GET, POST | `/api/queues/:id/tokens` | List tokens / add `{personName,phone?}` |
| PATCH | `/api/queues/:id/serve-next` | Begin serving the first waiting token |
| PATCH | `/api/tokens/:id/move` | Reorder with `{direction:"up"|"down"}` or drag with `{targetTokenId,placement:"before"|"after"}` |
| PATCH | `/api/tokens/:id/complete` | Complete the serving token |
| PATCH | `/api/tokens/:id/cancel` | Cancel a waiting token |
| GET | `/api/analytics/overview?days=7&queueId=` | KPI summary |
| GET | `/api/analytics/trends?days=7&queueId=` | Daily trends and token status distribution |
| GET | `/api/analytics/queues/:id` | Queue-specific lifetime totals |
| GET | `/api/health` | API health check |

`days` accepts 1–30. Queue filters are optional; all analytics are restricted to the signed-in manager's queues. Errors are JSON `{error}` objects with appropriate HTTP status codes.

## Deploy

### Render (API)

1. Create a managed PostgreSQL database and a Render Web Service from this repository.
2. Set the service root directory to `server`, build command to `npm install`, and start command to `npm start`.
3. Add `DATABASE_URL` (Render's internal database URL), `JWT_SECRET`, `CLIENT_URL` (your deployed frontend origin), `NODE_ENV=production`, and `COOKIE_SECURE=true`.
4. The API initializes its tables and indexes automatically at startup. The Render database itself must be provisioned first and its internal URL set as `DATABASE_URL`.

### Vercel (frontend)

1. Import the repository as a Vercel project and set the root directory to `client`.
2. Set `VITE_API_URL` to the deployed API URL plus `/api`, e.g. `https://your-api.onrender.com/api`.
3. Deploy, then set the Render `CLIENT_URL` to the Vercel deployment origin.

For cross-site cookie deployments, set `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true` on the API. Browsers may block third-party cookies when using unrelated domains; a same-site custom domain or reverse proxy is recommended.
