# Agency Client Project Dashboard

Real-time, role-based project/task tracker for a small agency: Admin, Project Manager, and Developer roles with strictly enforced server-side access control and a live, role-filtered activity feed.

## Local Setup

### Backend
```bash
cd backend
cp .env.example .env
docker compose up -d              # starts Postgres on localhost:5432
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev                       # starts on http://localhost:4000
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev                       # starts on http://localhost:5173
```

Seeded logins (password for all: `password123`):
- Admin: `admin@agency.test`
- PMs: `pm1@agency.test`, `pm2@agency.test`
- Developers: `dev1@agency.test` .. `dev4@agency.test`

## Database Schema

- **User** (role: ADMIN/PM/DEVELOPER) — indexed on `role`
- **Client** → has many **Project**
- **Project** — `createdById` FK to User, indexed (used on nearly every PM-scoped query)
- **Task** — FK to Project and to assigned User, indexed on `projectId`, `assignedToId`, `status`, `priority`, `dueDate` since every filter/dashboard query hits these columns
- **ActivityLog** — FK to Project/Task/User, composite index on `(projectId, createdAt)` because the feed and the reconnect catch-up both query "last N events for a project, ordered by time"
- **Notification** — FK to User/Task, composite index on `(recipientId, isRead)` for the unread-count query that runs on every page load and bell click
- **RefreshToken** — persisted so refresh tokens can be revoked server-side on logout, not just left to expire

## Architectural Decisions

**WebSocket library: Socket.io.** Chosen over raw WebSocket for built-in room management (used to scope the activity feed per-project and per-role) and connection-state recovery, both of which would otherwise have to be hand-rolled. Native WebSocket would have meant writing our own room/broadcast layer for no real benefit at this scale.

**Background jobs: node-cron.** The only scheduled job in this app is a single lightweight sweep (flag overdue tasks every 5 minutes). Bull/BullMQ would add a Redis dependency and queue-management overhead for a job that needs no retries, no backoff, and no distributed workers.

**Token storage:** Access token is short-lived and kept in memory on the client (never localStorage — mitigates XSS token theft). Refresh token is a long-lived, httpOnly, sameSite cookie scoped to `/api/auth`, and is also persisted server-side in the `RefreshToken` table so it can be explicitly revoked on logout rather than just left to expire on its own.

**Role enforcement:** Every protected route re-derives the requesting user from the database (via `requireAuth`) rather than trusting the role embedded in the JWT payload, and every list/detail query applies ownership scoping (`createdById` / `assignedToId`) inside the Prisma `where` clause itself — not via a post-fetch filter — so a modified token pointed at another user's ID still can't retrieve rows outside that user's actual scope in the database.

**Deployment note:** the backend must be deployed somewhere that supports long-lived connections (Railway/Render/Fly.io) — Vercel's serverless functions do not support persistent WebSocket connections. Only the frontend goes on Vercel.

## Known Limitations

- Presence ("online now") count is in-memory per server instance; it would need a shared store (Redis) to work correctly behind multiple backend instances.
- No automated test suite included given the timeframe — role-scoping logic is the highest-risk area and would be the first candidate for integration tests.
- Notification delivery assumes the recipient is connected; there's no email/push fallback for offline users beyond the persisted DB record they'll see on next login.
- No pagination on task lists/activity feed yet — fine at seed-data scale, would need cursor-based pagination for a real agency's task volume.

## Explanation (for submission)

_Draft — personalize the "hardest problem" and "what I'd do differently" paragraphs based on what you actually run into while testing:_

The hardest problem was making the real-time feed correctly role-scoped without duplicating the access logic that already lives in the REST routes. I solved it by joining Socket.io rooms at connection time using the exact same ownership rules as the HTTP endpoints (PM → rooms for projects they created, Developer → rooms for projects containing their assigned tasks), so a user only ever receives events for data they're already allowed to query over REST — the room membership is the enforcement point, not a client-side filter. For the "missed events" requirement, I fetch the last 20 `ActivityLog` rows scoped by the same ownership rule on every socket connection, so a user's feed is correct whether they were offline for five minutes or five days, and nothing depends on an in-memory cache that could be lost on server restart. If I had another day, I'd extract the ownership-scoping logic (currently duplicated across the REST routes and the socket room-joining code) into a single shared function, since right now a future change to access rules has to be made in two places.
