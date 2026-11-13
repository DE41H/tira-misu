<div align="center">

<img src=".github/logo.svg" width="88" alt="Tiramisu logo">

# Tiramisu

**Your BITS Pilani week, filled in from your inbox.**

Sign in with Google and see your week. Add your own events,<br>
or connect your mail and let classes, exams, deadlines and talks show up by themselves.

[How it works](#how-it-works) · [Iris sync](#iris-sync) · [Run it](#run-it) · [Layout](#layout)

</div>

---

## What it looks like

A mail lands in your BITS inbox:

```text
From:    instructor@pilani.bits-pilani.ac.in
Subject: CS F211 Quiz 2

Quiz 2 will be held on 20 Nov, 5:00 to 6:00 PM in F102.
```

A few minutes later it is on your timetable:

```text
Thu 20 Nov   17:00–18:00   Exam   CS F211 Quiz 2   F102
```

## How it works

| | |
| :-- | :-- |
| **1. Sign in** | Google sign-in. Your events are yours alone, enforced by PocketBase collection rules. |
| **2. See your week** | A week grid plus a **Coming up** list, on desktop and phone. Weeks are cached in the browser, so it opens instantly. |
| **3. Add events** | Classes, exams, deadlines, talks, workshops, recruitment and more, each with its own colour. Noisy categories (cultural, sports, competitions, campus services) start hidden. |
| **4. Connect Iris** *(optional)* | Accept the Tiramisu plugin on Iris and new mail turns into events automatically. |

## Iris sync

Iris reads new mail and answers a fixed set of questions about it (category, title, venue, date, time, whether it is new, changed or cancelled). Tiramisu never sees the email itself, only those answers.

- A cron runs **every 5 minutes**, fetching results for all connected students in one transaction.
- Dates and times are resolved in **IST** with [chrono](https://github.com/wanasit/chrono), cross-checked against the LLM's answer.
- Results are deduplicated, stored as events, then acknowledged so Iris doesn't send them again.

The plugin definition lives in [`backend/pb_hooks/iris/plugin.json`](backend/pb_hooks/iris/plugin.json), ready to paste into Iris.

## Run it

Needs only **Docker**.

```bash
cp .env.template .env   # Google OAuth client + Iris URL and key
make build              # fetches PocketBase, builds the frontend into backend/pb_public
make serve              # http://localhost:8090, admin dashboard at /_/
```

For production, `make serve DOMAIN=example.com` serves HTTPS on `:443` with an automatic certificate.

<details>
<summary><b>Environment</b></summary>

<br>

| Key | |
| :-- | :-- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client. Redirect URI: `<site>/api/oauth2-redirect` |
| `IRIS_URL`, `IRIS_KEY` | Your Iris instance and plugin API key |
| `SSL_CERT_DIR` | Optional, to trust a local Iris's Caddy certificate |

</details>

<details>
<summary><b>Other commands</b></summary>

<br>

```bash
make upgrade   # re-bundle pb_hooks/chrono.js from the latest chrono-node
make clean     # prune Docker build cache
```

</details>

## Layout

```text
backend/     the official PocketBase executable, no Go
  pb_hooks/      JS hooks: Google OAuth, event validation, Iris Connect, sync cron, mail parsing
  pb_migrations/ collection schema
frontend/    Svelte 5 + Vite SPA, talks to PocketBase through its JS SDK only
docker/      build and upgrade images
```

<sub>PocketBase · Svelte 5 · Vite · TypeScript · chrono · Docker</sub>

## Good to know

Tiramisu is a rewrite of the original Hono + Drizzle version on PocketBase, and is in early development.

- Parsed events can be wrong; check anything important against the original mail.
- Data from the old version has not been moved over yet. There are no tests.

Contributors: start with [`AGENTS.md`](AGENTS.md).
