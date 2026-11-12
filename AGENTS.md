# AGENTS.md

Tira: a rewrite of Tiramisu (`../tiramisu`: Hono + Better Auth + Drizzle/Neon, Vercel) on PocketBase.
A BITS Pilani timetable: students sign in with Google, see their week, add events; Iris (inbox-to-JSON service) fills in events from mail.

Keep this file up to date when you change structure, commands, env vars or status. Short bullets only.

## Status

- Done: Google sign-in, events CRUD (per-user collection rules), Iris Connect (`/api/invite`), week grid, Coming up, phone layout, browser cache of weeks.
- Done: Iris mail sync, a cron every 5 min for all students in one transaction (`sync.go`); the refresh button only reloads.
- Not done: moving old Neon data over. No tests.

## Layout

```text
backend/            Go, PocketBase v0.40 as a framework
  main.go           loads ../.env, registers migrations, hooks, crons
  hooks.go          Google OAuth from env, serves pb_public (SPA fallback, asset caching), event validation
  iris.go           Iris API client + /api/invite routes
  crons.go          app.Cron() jobs: irisSync every 5 min
  sync.go           Iris sync: link/unlink students, parse results, dedupe + store, ack
  parse.js          generated from iris/parse.ts (gitignored; `go generate` locally, Docker builds its own), run in goja
  migrations/       Go migrations = collection schema (users.irisUser, events); dashboard edits auto-generate new ones
                    users has no update rule: only the server writes it (OAuth, Iris linking)
  pb_public/        frontend build output (gitignored)
frontend/           Svelte 5 + Vite SPA, PocketBase JS SDK only
  src/Root.svelte   Welcome when signed out, lazy-loads App chunk when signed in
  src/lib/pb.svelte.ts  SDK client, auth state, event queries, record -> Ev mapping
  src/lib/cal.ts    categories, Ev type, IST date helpers, grid layout
  src/lib/local.ts  safe localStorage
iris/               Iris plugin in data/ (plugin/schema/rules.json) + parse.ts (chrono-node); bundled into backend/parse.js
.env                secrets (gitignored); .env.template lists the keys
```

## Run

```bash
make build     # Docker builds backend/tira + backend/pb_public (needs only Docker)
make serve     # runs backend/tira on :8090 (DOMAIN=x: HTTPS on :443); dashboard at /_/
make clean     # go mod tidy + prune Docker build cache
```

## Env (`.env`, read by backend and Vite)

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI `<site>/api/oauth2-redirect`), `IRIS_URL`, `IRIS_KEY`, optional `SSL_CERT_DIR` for local Iris's Caddy cert.

## Conventions

- Data access goes through PocketBase collections and rules, not custom routes; custom routes only for server secrets (Iris).
- Times are IST; PocketBase dates come as `"YYYY-MM-DD HH:MM:SS.sssZ"`, `toEv` converts to ISO.
- Keep visuals unchanged unless asked; global styles in `app.css`, the rest scoped per component.
- Smallest change that works; comment only the non-obvious why.
- Before `go vet` locally: `cd backend && go generate` (builds parse.js).
- Check with `cd frontend && pnpm check`, `cd backend && go vet ./...`, then `make build`.
