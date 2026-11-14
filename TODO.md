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
- [x] **19. Any time in the mail becomes the start of an all-day event** (`backend/pb_hooks/parse.js`, the `rules.time` fallback)
  Cases 083, 140, 155–157, 164, 171, 175, 184, 189, 224, 252, 295, 301, 307: the LLM gives no start, so the parser takes the first time anywhere in the mail: office hours (083), "signings today from 8:30 PM" (301), daily hours of a multi-day fest (155). Fixed: the `rules.time` fallback is gone; a time comes only from the LLM or from the `when` hit itself.
- [x] **20. A sign-up form link makes the place "Online"** (`backend/pb_hooks/parse.js` `place`)
  Cases 064, 075, 082, 100, 124, 213: a Google Form link gives place "Online" for an event with no place, or one in person. Fixed: "Online" only for meet, zoom, teams and webex links.
- [x] **21. A place from the rules overrides the LLM's "no venue"** (`backend/pb_hooks/parse.js` `venue`, `room`)
  Cases 117, 166, 222, 248, 280, 309, 324: `rules.venue`/`rules.room` fill in a place when the LLM said none: "Shankar Bhawan" (a hostel whose rep is elected) for a nomination deadline, "IIT Bombay" (the finale) for a registration deadline. Fixed: dropped the fallback (with an LLM start, 117 and 248 still got the wrong place). The `venue`/`room` rules in `rules.json` are now unused.
- [x] **22. Daily hours over a day range become one long span** (`backend/pb_hooks/parse.js` `lastDay`)
  Case 174: "30th & 31st Oct", "5:00 PM – 8:00 PM (Both Days)", LLM 30 Oct 17:00–20:00 with `multiple` → saved 30 Oct 17:00 to 31 Oct 20:00. Fixed: with an LLM start and end, the end is on the start's day (next day if before the start).
- [x] **23. A changed date the rules missed loses to an old date** (`backend/pb_hooks/parse.js` `disagree`)
  Case 268: polling moved "to 21st October 2026 (Wednesday), in the evening"; no `when` hit has 21 Oct, so the last hit (18 Oct, the silence period) wins over the LLM's 21 Oct. Fixed: for `changed`, a disagreement takes the LLM's date (still flagged `review`). Also: on any disagreement the LLM's time is kept now (case 020, which the time fallback used to rescue).
- [x] **24. "16th to 18th October" loses its end** (`backend/pb_hooks/parse.js` `norm`)
  Case 275: "from 16th to 18th October" → one day, 16 Oct. The `from` rewrite makes "on 16th to 18th October", which chrono does not read as a range. Fixed: "D to D Mon" and "D Mon-D Mon" become "D - D Mon". The real cause was `forwardDate`: a mail sent on the 16th moved "16th–18th October" to next year (also case 140). It is used only for weekday-only dates now.
- [x] **25. Dotted dates "22.10.2026" are not read** (`backend/pb_hooks/parse.js` `norm`)
  Case 306: "T7 to T12 - 22.10.2026 / T1 to T6 - 27.10.2026" → 27 Oct 06:00 timed, instead of 22 Oct all-day. Fixed: `norm` turns dd.mm.yyyy into "dd Mon yyyy". dd/mm and dd-mm (cases 240, 244, 279, 285) left alone.
- [ ] **26. A day range written in pieces loses its end** (`backend/pb_hooks/parse.js`)
  Cases 156 (one `when` line per day, 29–31 Oct), 164 ("30, 31 Oct" and "& 1 Nov" split over two hits), 184 (the first hit is cut off at "30 Oct – 1", so it agrees with the LLM's 30 Oct without the range on the next line). Preferring an agreeing hit with an end fixes 184 but breaks 324 (a deadline on the first day of a range). Fix: join a hit cut off at a range dash with the next window, and read "D, D Mon" lists as ranges.

## Nice to have

- [x] **12. An error slip can vanish while hovered** (`frontend/src/Toasts.svelte`)
  `run` overwrote a running timer without clearing it.
- [x] **13. The browser cache of weeks only grows** (`frontend/src/App.svelte`)
  Keep only weeks near the current one.
