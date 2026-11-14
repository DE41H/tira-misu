# TODO

From the repo audit of 2026-11-14. Numbers match the audit.

## Must fix

- [x] **1. Monday events missing from the week, today's all-day events missing from Coming up** (`frontend/src/lib/pb.svelte.ts`)
  Dates went to the filter as `"…T00:00:00+05:30"` text; PocketBase compares them as text against `"… 04:30:00.000Z"`, so all of Monday fell out. Pass `Date` objects so the SDK writes PocketBase's format.
- [ ] **2. Anyone can create a user and claim another student's Iris account** (`backend/pb_migrations/`)
  `users.createRule` is the default `""`; an anonymous create with `irisId` saves, and the sync then hands that record the victim's mail events. New migration: `users.createRule = '@request.body.irisId:isset = false'`, then check Google sign-up still works.
- [x] **3. Editing a mail event drops or blocks its end** (`frontend/src/EventDialog.svelte`)
  Saving a multi-day all-day event cleared `end`; an overnight event (22:00–01:00) could not be saved at all.
- [ ] **4. "Changed" mails are ignored when the start stays the same, and leave a duplicate when it moves** (`backend/pb_hooks/sync.js` `storeEvents`)
  Return `changed` from `parse`; on a key match with `changed`, update place/end/link/review. A moved date needs a title/course match, or at least `review`.

## Should fix

- [ ] **5. Parser mangles "20 Nov 10 AM"; parser has no tests** (`backend/pb_hooks/parse.js:27`)
  `norm` swaps the "Nov 10" inside "20 Nov 10 AM" into "20 10 Nov AM"; without an LLM date the result is dropped and acked. Add `(?<!\d(?:st|nd|rd|th)? )` before the month, plus a small Node test with ~10 real mail lines.
- [ ] **6. Multi-day timed events lose their last days** (`backend/pb_hooks/parse.js:77,86`)
  "20 Nov 10 AM to 22 Nov 5 PM" is saved as 20 Nov 10:00–17:00. Use `day(hit.end)` for the end when the clock came from `hit`.
- [ ] **7. Each sync loads every student's mail events** (`backend/pb_hooks/sync.js` `mailEvents`)
  Add `$dbx.in("user", ...new Set(rows.map((r) => r.user)))`.
- [ ] **8. Results for not-yet-matched students are acked and lost** (`backend/pb_hooks/sync.js:29`)
  Skip acking unknown users' results younger than a day.
- [x] **9. A tab left open never shows new events** (`frontend/src/App.svelte`)
  Refetch the shown week and Coming up when the tab becomes visible again.
- [ ] **10. Category list copied in four places** (`parse.js`, `cal.ts`, migration, `iris/plugin.json`)
  `parse.js` can read the values from the events collection schema.
- [ ] **11. `iris/schema.json` and `iris/rules.json` duplicate `plugin.json`**
  Nothing loads them; delete both and update `AGENTS.md`.

## Nice to have

- [x] **12. An error slip can vanish while hovered** (`frontend/src/Toasts.svelte`)
  `run` overwrote a running timer without clearing it.
- [x] **13. The browser cache of weeks only grows** (`frontend/src/App.svelte`)
  Keep only weeks near the current one.
