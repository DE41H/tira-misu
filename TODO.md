# TODO

From the repo audit of 2026-11-14. Numbers match the audit.

## Must fix

- [x] **1. Monday events missing from the week, today's all-day events missing from Coming up** (`frontend/src/lib/pb.svelte.ts`)
  Dates went to the filter as `"…T00:00:00+05:30"` text; PocketBase compares them as text against `"… 04:30:00.000Z"`, so all of Monday fell out. Pass `Date` objects so the SDK writes PocketBase's format.
- [x] **2. Anyone can create a user and claim another student's Iris account** (`backend/pb_hooks/auth.pb.js`)
  `users.createRule` is the default `""`; an anonymous create with `irisId` saves, and the sync then hands that record the victim's mail events. Fixed with an `onRecordCreate` hook in `auth.pb.js` that clears `irisId` on every new user instead of a create rule: it also covers OAuth2 `createData` and needs no migration.
- [x] **3. Editing a mail event drops or blocks its end** (`frontend/src/EventDialog.svelte`)
  Saving a multi-day all-day event cleared `end`; an overnight event (22:00–01:00) could not be saved at all.
- [x] **4. "Changed" mails are ignored when the start stays the same, and leave a duplicate when it moves** (`backend/pb_hooks/sync.js` `storeEvents`)
  `parse` returns `changed`. A change at the same start updates time, place and link; a moved date finds the student's one upcoming mail event with the same category and title and moves it. Both set `review`. No unique title match: a new event, flagged `review`.

## Should fix

- [x] **5. Parser mangles "20 Nov 10 AM"** (`backend/pb_hooks/parse.js:27`)
  Test added (`node test/test.js`, 60 cases; 060 is this one, made up). `norm` leaves a month alone when a day comes before it (a replace callback, not a lookbehind).
- [x] **6. Multi-day timed events lose their last days** (`backend/pb_hooks/parse.js`)
  "20 Nov 10 AM to 22 Nov 5 PM" was saved as 20 Nov 10:00–17:00. The end now goes on chrono's end day (`lastDay`), and `norm` rewrites "date time - date time" to "time date - time date", which chrono reads right (it took "10 AM - 22" as 10 AM–10 PM).
- [x] **7. Each sync loads every student's mail events** (`backend/pb_hooks/sync.js` `mailEvents`)
  Add `$dbx.in("user", ...new Set(rows.map((r) => r.user)))`.
- [x] **8. Results for not-yet-matched students are acked and lost** (`backend/pb_hooks/sync.js:29`)
  Results of unmatched students are acked only once they are a day old. Limit: they are fetched again each run meanwhile, inside the 15-page cap.
- [x] **9. A tab left open never shows new events** (`frontend/src/App.svelte`)
  Refetch the shown week and Coming up when the tab becomes visible again.
- [x] **10. Category list copied in four places** (`parse.js`, `cal.ts`, migration, `iris/plugin.json`)
  `parse.js` now reads categories and audiences from the events schema. Left on purpose: the migration (frozen history), `cal.ts` (labels and colours), `iris/schema.json` (what Iris asks).
- [x] **11. `iris/schema.json` and `iris/rules.json` duplicate `plugin.json`**
  Deleted `plugin.json` instead; `schema.json` and `rules.json` are the plugin now (README and `AGENTS.md` updated).

- [x] **14. A time with no date drops the event** (`backend/pb_hooks/parse.js`)
  Case 035: one LLM start time and no date anywhere now goes on the mail's own day, flagged `review`. Not for schedules (`multiple`), like case 007's exam slots.
- [x] **15. "Open till 2 PM" becomes a 2 PM start** (`backend/pb_hooks/parse.js`)
  Cases 034, 054: when the LLM gives an end and no start, the mail's times are not used as a start; the event is all-day.
- [x] **16. Day ranges lose their end** (`backend/pb_hooks/parse.js` `norm`)
  Cases 025, 033, 045: `norm` drops `*`, rewrites "D and D Mon" to "D - D Mon", and turns "from 15-18 Nov" (no spaces) into "on", so chrono no longer reads it as 15:00–18:00.
- [x] **17. A wrong year in the mail puts the event years back** (`backend/pb_hooks/parse.js`)
  Case 020: chrono hits more than 30 days before the mail are dropped.
- [x] **18. "9th hour" is not a time** (`backend/pb_hooks/parse.js`)
  Case 011: fixed in `iris/schema.json` (the LLM is told hour N starts at N+7 o'clock and lasts 50 minutes), since no rule captures "9th hour" and the parser only sees rule matches. Needs the schema pasted into Iris again.

## Nice to have

- [x] **12. An error slip can vanish while hovered** (`frontend/src/Toasts.svelte`)
  `run` overwrote a running timer without clearing it.
- [x] **13. The browser cache of weeks only grows** (`frontend/src/App.svelte`)
  Keep only weeks near the current one.
