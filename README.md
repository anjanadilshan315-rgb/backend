# Wedding Invitation API

Express + TypeScript REST API for the wedding invitation platform. It serves two frontends:

- **website** (`../website`) — customers register, pick a template, fill the step form, upload photos, and after payment import guests from Excel and e-mail the invitations. Guests open the public invitation page, RSVP and leave wishes.
- **dashbord** (`../dashbord`) — the sales team reviews submissions, marks them paid, and manages customers. Admins also manage staff users and their permissions.

| | |
|---|---|
| Runtime | Node.js ≥ 20, TypeScript (ESM) |
| HTTP | Express 5, helmet, CORS, compression, rate limiting |
| Database | MySQL 8 / MariaDB 10.4+ via `mysql2` (connection pool, parameterised SQL) |
| Auth | JWT access tokens + rotating refresh tokens (hashed in DB), bcrypt passwords |
| Validation | zod (params, query and body) |
| Files | Cloudinary (photos), exceljs (guest lists) |
| E-mail | Nodemailer (SMTP pool), background batch sender |
| Logging | pino + pino-http (request ids, redacted secrets) |
| Tests | vitest + supertest |

---

## Getting started

```bash
cd backend
npm install
cp .env.example .env          # then fill in DB_*, JWT_ACCESS_SECRET, Cloudinary, SMTP
npm run db:schema             # creates the database named in DB_NAME (default `railway`; safe to re-run)
npm run dev                   # http://localhost:5000/api/v1
```

You can also run `database/schema.sql` yourself in MySQL Workbench / phpMyAdmin / the CLI:
`mysql -u root -p < database/schema.sql`.

**Default admin** (created by the schema): `admin@example.com` / `Admin@12345`.
Change it right away, or create your own and deactivate this one:

```bash
npm run seed:admin -- --email you@company.com --password "YourPass123" --name "Your Name"
```

Import `postman/Wedding-Invitation-API.postman_collection.json` and
`postman/Wedding-Invitation-Local.postman_environment.json` into Postman. Logging in saves the tokens automatically.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload (tsx watch) |
| `npm run build` / `npm start` | Compile to `dist/` / run the compiled build |
| `npm test` | Run the test suite (no database needed) |
| `npm run typecheck` / `npm run lint` / `npm run format` | Quality checks |
| `npm run db:schema` | Apply `database/schema.sql` using `.env` |
| `npm run seed:admin -- --email … --password …` | Create an admin or reset an admin's password |

### Environment

All variables are validated at startup (`src/config/env.ts`); the server refuses to start with a clear message if something is wrong. See `.env.example` for every option. Notes:

- `JWT_ACCESS_SECRET` must be at least 32 characters. Generate one with
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- Without **Cloudinary** credentials, photo uploads return `503 UPLOADS_DISABLED`; everything else works.
- Without **SMTP_HOST**, e-mails are built and logged but not delivered, which is handy in development.
- `WEBSITE_URL` is used to build the invitation links in e-mails (`{WEBSITE_URL}/invite/{slug}?guest=…&code=…`).
- `CORS_ORIGINS` must list both frontends.

---

## Project structure

Code is organised **by feature** (module). Each module follows the same layers:

```
routes  →  (validate / authenticate / authorize middleware)  →  controller  →  service  →  repository  →  MySQL
```

- **routes**: URL + middleware chain only
- **controller**: reads the request and shapes the HTTP response
- **service**: business rules (status transitions, ownership, limits)
- **repository**: SQL only
- **mapper**: DB row (snake_case) to API DTO (camelCase)
- **validation**: zod schemas and the input types inferred from them

```
backend/
├── database/schema.sql          # full schema + seed data (single source of truth)
├── postman/                     # Postman collection + local environment
├── scripts/                     # apply-schema.ts, create-admin.ts
├── tests/                       # vitest + supertest
├── legacy/nextjs-api/           # old Next.js API routes moved out of the dashboard (reference only)
└── src/
    ├── server.ts                # bootstrap, DB check, graceful shutdown, resumes e-mail batches
    ├── app.ts                   # express app: security middleware, /api/v1 router, error handler
    ├── routes/index.ts          # mounts every module router
    ├── config/                  # env (zod), logger, database pool, cloudinary, mailer
    ├── common/
    │   ├── constants/           # permissions, statuses, allowed status transitions
    │   ├── errors/              # AppError (expected, client-facing errors)
    │   ├── middlewares/         # authenticate, authorize, validate, upload, rate-limit, error-handler, request-logger
    │   ├── types/               # Express request augmentation (req.staff / req.customer)
    │   └── utils/               # responses, pagination, jwt, password, sql, strings, validators
    └── modules/
        ├── auth/                # customer + staff login, refresh-token rotation
        ├── staff/               # sales team users, roles, permissions (admin only)
        ├── customers/           # customer profile (website) + customer management (dashboard)
        ├── templates/           # the 5 static templates
        ├── invitations/         # step form, submit, status workflow, photos (Cloudinary), public page
        ├── guests/              # guest list, Excel import, sample Excel, RSVP
        ├── emails/              # bulk e-mail batches, background dispatcher, e-mail templates
        ├── wishes/              # guest book
        ├── messages/            # website contact form
        ├── dashboard/           # sales dashboard statistics
        └── health/
```

---

## Business flow

```
Customer (website)                         Sales team (dashboard)
──────────────────                         ──────────────────────
register / login
pick template ── POST /customer/invitations           (status: draft)
fill steps ───── PATCH /customer/invitations/:id      (save each step)
upload photos ── POST  /customer/invitations/:id/photos
submit ───────── POST  /customer/invitations/:id/submit
                                           (status: pending) → shows in /admin/invitations
                                           review: GET /admin/invitations/:id
                                           customer pays
                                           PATCH /admin/invitations/:id/status {status:"paid"}
                                           → customer receives a "payment confirmed" e-mail
sees "paid" in dashboard
download sample Excel ── GET /public/samples/guest-list.xlsx
import guests ────────── POST /customer/invitations/:id/guests/import
send invitations ─────── POST /customer/invitations/:id/email-batches  (202, sent in background)
                                           ↓
Guest opens e-mail link → GET /public/invitations/:slug?code=…  → RSVP + wishes
```

### Invitation statuses

| Status | Meaning | Customer can edit? |
|---|---|---|
| `draft` | Step form in progress | yes |
| `pending` | Submitted, waiting for payment (visible to the sales team) | yes |
| `paid` | Payment confirmed; the public page goes live and guests/e-mails unlock | no (ask the sales team) |
| `cancelled` | Cancelled by the sales team | no |

Sales-team transitions: `draft→pending|cancelled`, `pending→paid|cancelled`, `paid→pending|cancelled`, `cancelled→pending`. Every change is written to `invitation_status_history` with who made it and a note.

Submitting requires groom name, bride name, wedding date and venue name. The response (`422`) lists anything missing. On submit a unique link slug is generated from the couple's names (`kaveen-ishara`, or `kaveen-ishara-k7m2` if that is already taken).

---

## Roles and permissions (sales dashboard)

- **admin**: every permission, plus managing staff users (`/admin/staff`, `/admin/permissions`). An admin cannot delete, deactivate or change the role of their own account, so at least one admin always remains.
- **user**: only the permissions an admin grants:

| Permission | Allows |
|---|---|
| `dashboard.view` | Dashboard statistics |
| `customers.view` / `.create` / `.update` / `.delete` | Customer list and detail / register / edit, activate, reset password / delete |
| `invitations.view` | Submission list and detail, guest lists |
| `invitations.update` | Edit submission content, photos, moderate wishes |
| `invitations.update_status` | Mark paid, cancel, revert |
| `invitations.delete` | Delete submissions |
| `messages.view` / `.manage` | Read / mark-read and delete contact messages |
| `templates.view` | Template list |

Accounts and permissions are re-read on every request, so deactivating a user or changing permissions takes effect immediately. `GET /admin/auth/me` returns the role and permissions so the dashboard can show only what the user may use.

---

## API conventions

Base URL: `/api/v1`

| Prefix | Who | Auth |
|---|---|---|
| `/health` | monitoring | — |
| `/public/*` | website visitors, invitation guests | — |
| `/auth/*` | website customers: register, login, refresh, logout | — |
| `/customer/*` | logged-in customer | `Bearer <customer access token>` |
| `/admin/auth/*` | sales team login | — |
| `/admin/*` | sales team | `Bearer <staff access token>` + role / permission |

Staff and customer tokens are not interchangeable: the JWT audience is checked.

**Success**
```json
{ "success": true, "message": "optional", "data": { }, "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }
```

**Error**
```json
{ "success": false, "message": "Validation failed", "code": "VALIDATION_ERROR",
  "details": [{ "location": "body", "field": "email", "message": "Invalid e-mail address" }],
  "requestId": "6c0b…" }
```

Use `code` for logic in the frontends and `message` for display. The `requestId` is also sent as the `X-Request-Id` header and appears in the server logs.

| HTTP | Typical codes |
|---|---|
| 400 | `BAD_REQUEST`, `INVALID_JSON`, `INVALID_FILE_TYPE`, `INVALID_EXCEL`, `NO_RECIPIENTS`, `SELF_MODIFICATION` |
| 401 | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED` (refresh then retry), `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN`, `ACCOUNT_INACTIVE` |
| 403 | `FORBIDDEN`, `ACCOUNT_DISABLED` |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `ALREADY_SUBMITTED`, `INVITATION_LOCKED`, `PAYMENT_REQUIRED`, `INVALID_STATUS_TRANSITION`, `BATCH_IN_PROGRESS`, `GUEST_EXISTS` |
| 413 | `FILE_TOO_LARGE`, `PAYLOAD_TOO_LARGE` |
| 422 | `VALIDATION_ERROR` |
| 429 | `RATE_LIMITED` |
| 503 | `UPLOADS_DISABLED` |

### Authentication flow

1. Login or register returns `data.tokens = { accessToken, expiresIn, refreshToken, refreshTokenExpiresAt }`.
2. Send `Authorization: Bearer <accessToken>` (valid for 15 minutes by default).
3. On `401 TOKEN_EXPIRED`, call `POST /auth/refresh` (or `/admin/auth/refresh`) with `{ refreshToken }`. You get a **new pair** and the old refresh token stops working.
4. Re-using an old refresh token is treated as theft: every session of that account is revoked.
5. Changing or resetting a password, deactivating an account and changing a staff role all sign the account out everywhere.

### Uploads

- **Photos**: `multipart/form-data` with field `category` (`cover` | `groom` | `bride` | `gallery`) and `photos` (1–10 JPEG/PNG/WebP files, 5 MB each). `cover`, `groom` and `bride` hold one photo each (a new upload replaces the old one); `gallery` holds up to 20. Files go straight from memory to Cloudinary; the DB stores only the URL and `public_id`. Deleting a photo, invitation or customer also removes the Cloudinary files.
- **Guest Excel**: `multipart/form-data` with field `file` (.xlsx, ≤ 2 MB, ≤ 2000 rows) and optional `sendEmails=true`. Row 1 needs `Name` and `Email` headers (`Phone` is optional; common aliases such as "Guest Name" or "E-mail" work, in any column order). Invalid rows and duplicates are skipped and listed in `data.errors` with their row numbers.

### Bulk e-mail

`POST /customer/invitations/:id/email-batches` with `{ "mode": "unsent" | "all" | "selected", "guestIds": [] }` responds `202` right away. A background dispatcher sends through a pooled SMTP connection (`EMAIL_SEND_CONCURRENCY` at a time) and records `sent` / `failed` (with the error) per guest. Poll `GET …/email-batches/:batchId` for progress. Only one batch per invitation runs at a time. Progress is stored in the database, so a batch interrupted by a restart resumes on the next start. Every guest gets a personal link with their name and invite code, so their RSVP is matched to them.

---

## Security measures

- Parameterised SQL everywhere; sort columns come from whitelists, never from user input.
- bcrypt password hashing (cost 12); constant-time login responses whether or not the e-mail exists.
- Short-lived JWTs (HS256, issuer and audience checked) and opaque refresh tokens stored as SHA-256 hashes with rotation and reuse detection.
- helmet security headers, a CORS allow-list, body size limits, file type and size limits.
- Rate limits: whole API, login/register/refresh (failed attempts only), and anonymous writes (contact, RSVP, wishes).
- Ownership checks on every customer resource (a customer can only reach their own invitations); unknown ids return `404`.
- The public invitation page exposes only paid invitations and never returns customer, payment or internal fields.
- User content is HTML-escaped in e-mails.
- Secrets (`authorization`, passwords, tokens) are redacted from logs; unexpected errors return a generic 500 and the details stay in the logs.
- Graceful shutdown: stops accepting requests, closes the DB pool and SMTP pool, and forces exit after 10 s.

---

## Database

`database/schema.sql` creates everything in one go and is safe to re-run (`CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`; nothing is dropped). It targets MySQL 8 and MariaDB 10.4+, and seeds the default admin and the five templates (`tpl_classic`, `tpl_royal`, `tpl_modern`, `tpl_floral`, `tpl_minimal`). Template prices are `NULL`; set them when you decide on pricing.

Tables: `staff_users`, `staff_permissions`, `customers`, `refresh_tokens`, `templates`, `invitations`, `invitation_photos`, `invitation_status_history`, `email_batches`, `guests`, `wishes`, `contact_messages`.

**Changing the schema:** update `schema.sql` (it must always build the full current database from scratch) **and** add a dated file such as `database/migrations/2026-11-01-add-x.sql` with the `ALTER` statements for databases that already exist.

---

## Testing

```bash
npm test
```

The suite runs without a database. It covers routing, auth rejection (including staff and customer token separation), validation, CORS, the Excel import and the sample file round-trip, e-mail rendering and escaping, and the permission middleware.

The full flow (register → step form → submit → mark paid → Excel import → bulk e-mail → public page → RSVP → wishes → refresh-token rotation → cascade delete) was also run end-to-end against a real MariaDB 10.4 database.

---

## Roadmap / extension points

- **Template builder**: add create/update endpoints to `modules/templates` (the `templates` table and the `/admin/templates` router are ready for it).
- **High e-mail volumes**: replace the in-process `EmailDispatcher` with BullMQ/Redis or SQS; the routes and services stay the same.
- **Password reset by e-mail**: a token table plus two endpoints, reusing `config/mailer.ts`.
- `legacy/nextjs-api/` holds the old Next.js API routes for reference. Delete it once the frontends use this API.
