# Event Booking System — Backend API

REST API for an event booking platform with **Event Organizers** and **Customers**, role-based access control, and **BullMQ** background jobs for booking confirmations and event-update notifications.

## Quick start

**Prerequisites:** Node.js 20+, Redis (Docker or local)

```bash
# 1. Install dependencies
npm install

# 2. Start Redis (pick one)
docker compose up -d          # Docker
# brew services start redis   # or Homebrew Redis on macOS

# 3. Database
cp .env.example .env   # if .env does not exist
npm run db:push
npm run seed

# 4. Run API + background worker (two processes)
npm run dev:all
```

API: `http://localhost:3000`  
Demo script: `chmod +x scripts/demo.sh && ./scripts/demo.sh`

Seed users (password: `password123`):

| Role      | Email                   |
|-----------|-------------------------|
| Organizer | organizer@example.com   |
| Customer  | customer@example.com    |

## Loom demo checklist (2–5 min, face on camera, English)

1. Explain architecture: Express API, Prisma/SQLite, BullMQ + Redis workers.
2. Show two terminals: `npm run dev:all` (API + worker).
3. Register or login as customer → browse `GET /api/events`.
4. Book tickets → point to worker terminal `[EMAIL]` log.
5. Login as organizer → `PATCH /api/events/:id` → worker `[NOTIFICATION]` logs.
6. Show a forbidden call (e.g. customer creating an event → 403).

Optional: run `./scripts/demo.sh` for a scripted flow.

---

## Design decisions

### 1. Tech stack

| Layer            | Choice              | Rationale |
|------------------|---------------------|-----------|
| Runtime          | Node.js + TypeScript | Type safety, aligns with common backend hiring stacks |
| HTTP framework   | Express 5           | Simple, well-known, easy to demo with curl |
| Database ORM     | Prisma              | Migrations, type-safe queries, fast local setup |
| Database         | SQLite (file)       | Zero external DB for reviewers; swap `DATABASE_URL` to PostgreSQL in production |
| Validation       | Zod                 | Request body validation at route boundary |
| Auth             | JWT (Bearer)        | Stateless API; role embedded in token for RBAC |
| Job queue        | BullMQ + Redis      | Reliable retries, separate worker process, production-grade pattern |

### 2. User roles and RBAC

Two roles are stored on `User.role`: `ORGANIZER` and `CUSTOMER`.

- **Registration** requires an explicit `role` in the body. In production you might restrict who can register as organizer (invite-only or admin approval).
- **JWT** carries `sub` (user id), `email`, and `role`.
- **`authenticate`** middleware validates the Bearer token.
- **`requireRoles(...)`** middleware enforces role on protected routes.

| Action                         | Organizer | Customer | Public |
|--------------------------------|-----------|----------|--------|
| Register / Login               | ✓         | ✓        | ✓      |
| Browse events                  | ✓         | ✓        | ✓      |
| Create / update event          | ✓ (own)   | ✗        | ✗      |
| List own events                | ✓         | ✗        | ✗      |
| Book tickets                   | ✗         | ✓        | ✗      |
| List own bookings              | ✗         | ✓        | ✗      |
| List bookings for an event     | ✓ (own event) | ✗    | ✗      |

Ownership checks (e.g. only the organizer who created an event can update it) are enforced in the **service layer**, not only in routes.

### 3. Data model

```
User (ORGANIZER | CUSTOMER)
  ├── events[]     (organizer only)
  └── bookings[]   (customer only)

Event
  ├── organizerId
  ├── totalTickets / availableTickets  (inventory)
  └── bookings[]

Booking
  ├── eventId, customerId
  ├── quantity, totalPrice
  └── status: CONFIRMED | CANCELLED
```

**Ticket inventory:** `availableTickets` is decremented inside a **database transaction** when a booking is created, with a post-update check to avoid overselling under concurrency.

**Event updates:** Organizers can patch `title`, `description`, or `venue` on their own events; confirmed bookers are notified via the background queue.

### 4. API surface

#### Auth — `/api/auth`

| Method | Path        | Auth | Description |
|--------|-------------|------|-------------|
| POST   | /register   | No   | Create user with `role` |
| POST   | /login      | No   | Returns JWT |
| GET    | /me         | Yes  | Current user profile |

#### Events — `/api/events`

| Method | Path    | Auth        | Description |
|--------|---------|-------------|-------------|
| GET    | /       | No          | List events (`?upcoming=true` optional) |
| GET    | /:id    | No          | Event detail |
| GET    | /mine   | Organizer   | Organizer’s events |
| POST   | /       | Organizer   | Create event |
| PATCH  | /:id    | Organizer   | Update title, description, or venue (triggers notifications) |

#### Bookings — `/api/bookings`

| Method | Path              | Auth      | Description |
|--------|-------------------|-----------|-------------|
| POST   | /                 | Customer  | Book tickets |
| GET    | /                 | Customer  | My bookings |
| GET    | /event/:eventId   | Organizer | Bookings for own event |
| GET    | /:id              | Yes       | Booking detail (customer or owning organizer) |

### 5. Background processing (BullMQ)

Jobs run in a **separate process** (`npm run worker` or `dev:all`) so HTTP handlers stay fast and failures can retry without blocking the client.

| Queue                         | Trigger                         | Worker behavior (assignment) |
|-------------------------------|-----------------------------------|------------------------------|
| `booking-confirmation`        | After successful booking          | `console.log` simulating confirmation email |
| `event-update-notification`   | After organizer PATCH with changes | `console.log` per customer who has a CONFIRMED booking |

**Enqueue points:**

- `booking.service.ts` → after transaction commits.
- `event.service.ts` → after update, only if fields changed and there are confirmed bookings.

Jobs use **3 attempts** with exponential backoff. In production you would plug in SendGrid/SES and idempotency keys per `bookingId`.

### 6. Error handling

- **`AppError`** for expected failures (4xx) with optional `code`.
- **Zod** validation errors → 400 with field details.
- Unknown errors → 500, logged server-side.

### 7. Security notes (production hardening)

- Change `JWT_SECRET` and use HTTPS.
- Rate-limit auth and booking endpoints.
- Do not allow arbitrary role selection on register without verification.
- Use PostgreSQL with connection pooling for multi-instance deploys.
- Run Redis with persistence/auth in production.

### 8. Project layout

```
src/
  config/env.ts          # Validated environment
  middleware/            # Auth, RBAC, errors
  routes/                # HTTP layer
  services/              # Business logic
  jobs/                  # BullMQ queues + workers
  app.ts                 # Express app
  index.ts               # API entry
  worker.ts              # Worker entry
prisma/schema.prisma
scripts/demo.sh
```

## Example requests

**Register customer**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123","name":"Alice","role":"CUSTOMER"}'
```

**Create event (organizer)**

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer <ORGANIZER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Jazz Night",
    "description": "Live jazz band",
    "venue": "Blue Note",
    "startTime": "2026-06-01T19:00:00.000Z",
    "endTime": "2026-06-01T22:00:00.000Z",
    "totalTickets": 50,
    "pricePerTicket": 35
  }'
```

**Book tickets (customer)**

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer <CUSTOMER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<EVENT_ID>","quantity":2}'
```

Watch the **worker** terminal for `[EMAIL]` output.

## Postman

Import the collection:

**File → Import →** `postman/Event-Booking-API.postman_collection.json`

Collection variables: `baseUrl`, `organizerToken`, `customerToken`, `eventId`, `bookingId`. Login requests auto-save tokens; use the **Demo Flow** folder for a full walkthrough.

## Scripts

| Command           | Description |
|-------------------|-------------|
| `npm run dev`     | API with hot reload |
| `npm run worker`  | Background workers only |
| `npm run dev:all` | API + workers |
| `npm run seed`    | Seed demo users and event |
| `npm run build`   | Compile TypeScript |

## License

MIT
