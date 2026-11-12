# AGENTS.md

Tira: a rewrite of Tiramisu (`../tiramisu`: Hono + Better Auth + Drizzle/Neon, Vercel) on PocketBase.
A BITS Pilani timetable: students sign in with Google, see their week, add events; Iris (inbox-to-JSON service) fills in events from mail.

Keep this file up to date when you change structure, commands, env vars or status. Short bullets only.

## Status

- Done: Google sign-in, events CRUD (per-user collection rules), Iris Connect (`/api/invite`), week grid, Coming up, phone layout, browser cache of weeks.
- Not done: Iris mail sync (old `../tiramisu/server/{sync,parse}.ts`, uses chrono-node). Until then the refresh button only reloads.
- Not done: moving old Neon data over. No backend tests.

## Layout

```text
backend/            Go, PocketBase v0.40 as a framework
  main.go           loads ../.env, registers migrations, hooks, crons
  hooks.go          Google OAuth from env, serves pb_public (SPA fallback, asset caching), event validation
  iris.go           Iris API client + /api/invite routes
  crons.go          app.Cron() jobs (empty)
  migrations/       Go migrations = collection schema (users.irisUser, events); dashboard edits auto-generate new ones
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
make install   # frontend deps
make dev       # backend :8090, serves last build; dashboard at /_/
make web       # Vite :5173 with HMR, proxies /api to :8090
make build     # frontend -> backend/pb_public, then backend/tira
make migration name=x
```

## Env (`.env`, read by backend and Vite)

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI `<site>/api/oauth2-redirect`), `IRIS_URL`, `IRIS_KEY`, optional `SSL_CERT_DIR` for local Iris's Caddy cert.

## Conventions

- Data access goes through PocketBase collections and rules, not custom routes; custom routes only for server secrets (Iris).
- Times are IST; PocketBase dates come as `"YYYY-MM-DD HH:MM:SS.sssZ"`, `toEv` converts to ISO.
- Keep visuals unchanged unless asked; global styles in `app.css`, the rest scoped per component.
- Smallest change that works; comment only the non-obvious why.
- Check with `cd frontend && npm run check`, `cd backend && go vet ./...`, then `make build`.
