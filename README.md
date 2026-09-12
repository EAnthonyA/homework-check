# Namų darbai (Homework Check)

A small family app that keeps track of homework:

- **Scrapes** an external school homework page (login + endpoints configured via env vars).
- **Parses** homework items by date.
- **Publishes** each item as an all-day event on every family member's own Google Calendar.
- **Shows** today's homework to parents (with the kid's completion status) and to the kid.
- **Lets the kid upload** a photo/screenshot of the finished homework, which marks it done.

## Tech stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- SQLite via Node's built-in `node:sqlite` (plain SQL, no ORM — see `src/lib/schema.ts`)
- Google OAuth (hand-rolled) + Google Calendar API
- Scheduled scraping via `node-cron` (Europe/Vilnius, default 15:00)
- Deployed as a single Docker container

## How it works

1. On schedule (or manually), the app logs in to the configured homework source,
   fetches the homework page and upserts parsed items into SQLite.
2. After each scrape, every connected user's calendar is synced (idempotent —
   each event is created once, tracked in the `calendar_events` table).
3. The web app serves a parent view (status of all submissions) and a kid view
   (upload per item → auto-marked done). Uploaded images are stored on local
   disk under the configured upload directory.

## Setup (local)

Requirements: Node 24, pnpm.

```bash
pnpm install
cp .env.example .env   # then fill in the values (see below)
pnpm dev               # http://localhost:3000
```

## Environment variables

| Variable | Description |
| --- | --- |
| `DB_PATH` | Path to the SQLite file (`./data/app.db` locally, `/data/app.db` in Docker). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth web client credentials. |
| `SESSION_SECRET` | 32+ char random string for session JWT signing (`openssl rand -hex 32`). |
| `ENCRYPTION_KEY` | 32+ char random string for encrypting refresh tokens at rest. |
| `PARENT_EMAILS` | Comma-separated parent emails. First signed-in user defaults to parent. |
| `SCRAPE_CRON` | Cron expression (Europe/Vilnius). Default `0 15 * * *`. |
| `UPLOAD_DIR` | Directory for uploaded images (`./data/uploads` locally). |
| `APP_URL` | Optional public origin override (defaults to the request origin). |
| `SCRAPER_DEBUG` | `1` to dump the authenticated homework HTML to `./data/debug`. |

### Homework source (endpoints & credentials)

All source-specific values live **only in `.env`** (git-ignored) — the repository
does not name the upstream service:

| Variable | Description |
| --- | --- |
| `HOMEWORK_SOURCE_BASE_URL` | Base URL of the source site (no trailing slash). |
| `HOMEWORK_SOURCE_LOGIN_PAGE` | Path of the login page (seeds the session cookie). |
| `HOMEWORK_SOURCE_LOGIN_ACTION` | Path of the AJAX login endpoint. |
| `HOMEWORK_SOURCE_HOMEWORK_PAGE` | Path of the homework page. |
| `HOMEWORK_SOURCE_USERNAME` | Login username/email. |
| `HOMEWORK_SOURCE_PASSWORD` | Login password. |
| `HOMEWORK_SOURCE_REMEMBER_FIELD` | Name of the "remember me" form field (default `remember_me`). |
| `HOMEWORK_SOURCE_LOGIN_SUBMIT` | Submit button value sent with the login form (default `Login`). |

The login flow expects the login endpoint to return JSON
`{ url: string | false, message?, doubleAuth? }` (AJAX login). If your source
behaves differently, adjust `src/lib/scraper/source.ts`.

> **Two-factor auth:** if the source account has SMS 2FA enabled, the scraper
> cannot log in. Disable 2FA on that account or add a 2FA step to the scraper.

## Google Cloud setup

1. Create a project, enable the **Google Calendar API**.
2. Configure the **OAuth consent screen** (External, Testing mode) and add your
   family emails as test users. Testing mode needs no verification.
3. Create an **OAuth client ID** (Web application) and add redirect URIs:
   - `http://localhost:3000/api/auth/callback`
   - `https://<your-domain>/api/auth/callback`
4. Copy the client ID/secret into `.env`.

Every user who signs in is asked for calendar access; their refresh token is
stored encrypted in the DB and used to create events on their primary calendar.

## Roles

- `PARENT_EMAILS` determines who is a parent; everyone else is a kid.
- If `PARENT_EMAILS` is empty, the **first** user to sign in becomes parent.

## Debugging the scraper

```bash
SCRAPER_DEBUG=1 pnpm scrape
```

This logs in, fetches the homework page, dumps the HTML to `./data/debug`, and
prints the parsed items. Tune the selectors in `src/lib/scraper/parse.ts` if
parsing returns nothing or the wrong fields.

## Run with Docker

```bash
docker compose up --build -d
```

The container runs `next start` (standalone). Data (SQLite DB + uploads) lives in
the `app-data` volume at `/data`. Set all env vars in `.env` (compose reads it
via `env_file`).

## Project structure

- `src/lib/db.ts` — SQLite singleton (creates schema on startup)
- `src/lib/schema.ts` — SQL schema
- `src/lib/repo.ts` — typed data-access functions
- `src/lib/scraper/` — source login + fetch (`source.ts`, `cookie-jar.ts`), parser (`parse.ts`), orchestration (`run.ts`)
- `src/lib/calendar.ts` — Google Calendar sync
- `src/lib/auth.ts` — cookie-based session (JWT)
- `src/lib/scheduler.ts` — cron schedule
- `src/app/api/` — route handlers (auth, homework, scrape, calendar, upload)
- `src/app/` + `src/components/` — UI (parent dashboard, kid view, settings)
- `src/i18n/` — Lithuanian + English strings
