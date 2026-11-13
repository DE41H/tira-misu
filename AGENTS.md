# AGENTS.md

Tira: a rewrite of Tiramisu (`../tiramisu`: Hono + Better Auth + Drizzle/Neon, Vercel) on PocketBase.
A BITS Pilani timetable: students sign in with Google, see their week, add events; Iris (inbox-to-JSON service) fills in events from mail.

Keep this file up to date when you change structure, commands, env vars or status. Short bullets only.

## Status

- Done: Google sign-in, events CRUD (per-user collection rules), Iris Connect (`/api/invite`), week grid, Coming up, phone layout, browser cache of weeks.
- Done: Iris mail sync, a cron every 5 min for all students in one transaction (`pb_hooks/sync.js`); the refresh button only reloads.
- Not done: moving old Neon data over. No tests.

## Layout

```text
backend/            the official PocketBase v0.40 executable (no Go): JS hooks + JS migrations
  pocketbase        downloaded by `make build` (gitignored); bump PB_VERSION in docker/Dockerfile to upgrade
  pb_hooks/         *.pb.js register hooks; plain *.js are modules handlers require() (handlers run in isolated scopes)
    auth.pb.js      Google OAuth from env
    web.pb.js       serves pb_public (SPA fallback, asset caching)
    events.pb.js    event validation the schema can't express
    invite.pb.js    Iris Connect routes (/api/invite)
    sync.pb.js      irisSync cron, every 5 min
    iris.js         Iris API client + paging
    sync.js         Iris sync: link/unlink students, parse results, dedupe + store, ack
    parse.js        Iris result -> event (dates via chrono, IST)
    chrono.js       chrono-node (en only), bundled and committed; `make upgrade` refreshes it
    iris/           the Iris plugin (plugin.json = schema.json + rules.json, for pasting into Iris); not loaded by PocketBase
  pb_migrations/    JS migrations = collection schema (users.irisUser, events); dashboard edits auto-generate new ones
                    users has no update rule: only the server writes it (OAuth, Iris linking)
  pb_public/        frontend build output (gitignored)
frontend/           Svelte 5 + Vite SPA, PocketBase JS SDK only
  src/Root.svelte   Welcome when signed out, lazy-loads App chunk when signed in
  src/lib/pb.svelte.ts  SDK client, auth state, event queries, record -> Ev mapping
  src/lib/cal.ts    categories, Ev type, IST date helpers, grid layout
  src/lib/local.ts  safe localStorage
.env                secrets (gitignored); .env.template lists the keys
```

## Run

```bash
make build     # Docker fetches backend/pocketbase, builds backend/pb_public (needs only Docker)
make serve     # loads .env, runs backend/pocketbase on :8090 (DOMAIN=x: HTTPS on :443); dashboard at /_/
make clean     # prune Docker build cache
make upgrade   # Docker re-bundles pb_hooks/chrono.js from the latest chrono-node (docker/Dockerfile.upgrade)
```

## Env (`.env`, read by backend and Vite)

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI `<site>/api/oauth2-redirect`), `IRIS_URL`, `IRIS_KEY`, optional `SSL_CERT_DIR` for local Iris's Caddy cert.

## Conventions

- Data access goes through PocketBase collections and rules, not custom routes; custom routes only for server secrets (Iris).
- Times are IST; PocketBase dates come as `"YYYY-MM-DD HH:MM:SS.sssZ"`, `toEv` converts to ISO.
- Keep visuals unchanged unless asked; global styles in `app.css`, the rest scoped per component.
- Smallest change that works; comment only the non-obvious why.
- Editor types for hooks: `pb_data/types.d.ts`, written by PocketBase on start.
- Check with `cd frontend && pnpm check`, then `make build` and `make serve` (hook errors print at start).
