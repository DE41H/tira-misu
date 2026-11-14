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

- [ ] **5. Parser mangles "20 Nov 10 AM"** (`backend/pb_hooks/parse.js:27`)
  Test added (`node test/test.js`, 59 real mails). Left: `norm` still swaps the "Nov 10" inside "20 Nov 10 AM" into "20 10 Nov AM"; without an LLM date the result is dropped and acked. Add `(?<!\d(?:st|nd|rd|th)? )` before the month, and a mail case for it (none of the 59 hits it).
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

- [ ] **14. A time with no date drops the event** (`backend/pb_hooks/parse.js`)
  Case 035: "power cut from 11.00 am to 12.30 pm", no date anywhere; parse returns null and the result is acked. Use the mail's own day when only a time is given.
- [ ] **15. "Open till 2 PM" becomes a 2 PM start** (`backend/pb_hooks/parse.js`)
  Cases 034, 054: the LLM gives only `end`, `start` is null, so the time rule's "2.00 PM" is used as the start. When the LLM gave an end but no start, don't fall back to the time rules.
- [ ] **16. Day ranges lose their end** (`backend/pb_hooks/parse.js` `norm`)
  Case 033 "19th and 20th November" starts on the 20th with no end; case 045 "*30** October 2026 to 02 November 2026" has no end (the `*` breaks the range, `clean` isn't applied before chrono); case 025 "from the morning of 15th Nov ... till 11am on 18th Nov" lands on the mail's own date line. Strip `*` in `norm`, rewrite "D and D Mon" to "D - D Mon".
- [ ] **17. A wrong year in the mail puts the event years back** (`backend/pb_hooks/parse.js`)
  Case 020: "2-11-2023" in a 2026 mail is saved on 2 Nov 2023. Drop chrono hits more than a month in the past, like `ymd` does for the LLM date.
- [ ] **18. "9th hour" is not a time** (`backend/pb_hooks/parse.js`)
  Case 011: a class "in the 9th hour" is saved all-day. BITS hours: hour N starts at (N+7):00 for N ≤ 10; map "Nth hour" before chrono.

## Nice to have

- [x] **12. An error slip can vanish while hovered** (`frontend/src/Toasts.svelte`)
  `run` overwrote a running timer without clearing it.
- [x] **13. The browser cache of weeks only grows** (`frontend/src/App.svelte`)
  Keep only weeks near the current one.
