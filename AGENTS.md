<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Namų darbai (Homework Check)

Family homework tracker: scrapes an external school page → parses homework → syncs
all-day events to each user's Google Calendar → parent/kid web views with photo
upload ("done"). Stack: Next.js 16 (App Router) + React 19 + TypeScript, Tailwind
v4, SQLite via `node:sqlite`, hand-rolled Google OAuth + Calendar API, `node-cron`,
single Docker container. Full setup, env vars and Google Cloud steps: see `README.md`.

## Commands

- `pnpm dev` — dev server (http://localhost:3000)
- `pnpm build` / `pnpm start` — production build / serve (`output: "standalone"`)
- `pnpm lint` — ESLint (`eslint-config-next`)
- `pnpm scrape` — run one scrape manually; add `SCRAPER_DEBUG=1` to dump HTML to `data/debug/`
- `docker compose up --build -d` — Dockerized run (data in the `app-data` volume)

## Architecture

- `src/lib/db.ts` — `node:sqlite` singleton, runs idempotent schema from `schema.ts` on first use
- `src/lib/repo.ts` — typed data access (plain SQL, no ORM)
- `src/lib/auth.ts` — cookie JWT session · `src/lib/google-oauth.ts` — hand-rolled OAuth
- `src/lib/scraper/` — `source.ts` (login/fetch), `parse.ts` (cheerio), `run.ts` (orchestration), `cookie-jar.ts`
- `src/lib/calendar.ts` — Calendar sync · `src/lib/scheduler.ts` — cron
- `src/lib/{timezone,sanitize,crypto,uploads}.ts` — Vilnius dates, free-text cleanup, AES-GCM, image uploads
- `src/app/api/` — route handlers · `src/app/` + `src/components/` — server pages + client views

## Conventions

### Next.js 16 specifics
- This is NOT the Next.js you know (see the rules block above). Read `node_modules/next/dist/docs/` before writing framework code; heed deprecation notices.
- This codebase uses Next's typed route signatures (e.g. `LayoutProps<"/">` in `src/app/layout.tsx`). Follow that pattern for new pages/layouts.
- `@/*` maps to `src/*`.

### Database
- No ORM. Schema is in `src/lib/schema.ts` (idempotent `CREATE TABLE IF NOT EXISTS`); make schema changes there.
- `getDb()` opens lazily on first use. Never open the DB at module top level — Next.js build workers import modules and must not touch the DB file.
- Put all queries in `src/lib/repo.ts` (prepared statements cached lazily). `node:sqlite` is synchronous — no `await`.

### Auth & roles
- Cookie-based JWT in httpOnly `auth-token`. Never use Bearer tokens. Get the session via `getSession()`.
- Roles: `parent` | `kid`. Parent-only endpoints return 401 (no session) / 403 (wrong role).
- `PARENT_EMAILS` decides parents; if empty, the first signed-in user becomes parent.
- Sign-in allowlist: `ALLOWED_EMAILS` + `PARENT_EMAILS` (union) gate who can sign in; if neither is set, sign-in is open.

### Dates & timezones
- All dates are plain `YYYY-MM-DD` strings, pinned to `Europe/Vilnius`.
- Use `src/lib/timezone.ts` helpers: `vilniusDateString()` for "today", `addDays()`, `formatDateHuman()`, `isFutureOrToday()`. Never use `toISOString()` for local dates.

### Data safety
- Run all user/AI-facing free text through `sanitizeFreeText()` (`src/lib/sanitize.ts`).
- Encrypt secrets at rest (Google refresh tokens) via `encrypt()`/`decrypt()` (`src/lib/crypto.ts`, AES-256-GCM).
- Uploaded photos are served via `/api/uploads/[name]` behind a `getSession()` check — keep that check if you touch the route.

### Scraper
- Upstream service config is env-only (`HOMEWORK_SOURCE_*`). Never name the upstream service in code, comments, or commits.
- Selectors live in `src/lib/scraper/parse.ts`. If parsing returns nothing, dump with `SCRAPER_DEBUG=1 pnpm scrape` and tune.

### Frontend
- React Query: `useQuery` + `fetch` for GET; `useMutation` for POST/PATCH side effects. Never use a POST endpoint as `queryFn`. Defaults: `staleTime: 30_000`, `retry: 1`.
- UI text is hardcoded Lithuanian inline in components (`<html lang="lt">`). There is no i18n layer yet — README mentions `src/i18n/`, but that directory does not exist.
- Design tokens are defined in `src/app/globals.css` (`@theme`). Use the utilities (e.g. `bg-surface`, `text-ink`, `text-ink-soft`, `rounded-card`, `shadow-card`, `bg-primary`, `text-danger`) rather than arbitrary values.

## Pitfalls

- An empty/whitespace `SCRAPE_CRON` crashes `node-cron` at startup; `scheduler.ts` deliberately uses `||` (not `??`) to fall back to the default.
- Google returns `refresh_token` only on first consent (`prompt: "consent"`).
- `next dev` regenerates the `nextjs-agent-rules` block at the top of this file — keep it in diffs to avoid a perpetual uncommitted change.
