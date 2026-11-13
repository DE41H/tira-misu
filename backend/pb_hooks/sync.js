/// <reference path="../pb_data/types.d.ts" />

const { iris, irisList } = require(`${__hooks}/iris.js`);
const { parse } = require(`${__hooks}/parse.js`);

const ACK_MAX = 500;

function syncIris() {
  const store = $app.store();
  if (store.has("irisSyncInProgress")) return;
  store.set("irisSyncInProgress", true);
  try {
    run();
  } finally {
    store.remove("irisSyncInProgress");
  }
}

function run() {
  const subs = irisList("/users/");
  const results = irisList("/results/?fetched=false").items;
  results.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  let saved = 0;
  $app.runInTransaction((tx) => {
    const owner = linkStudents(tx, subs.items, subs.done, results);
    saved = storeEvents(tx, parseResults(tx, results, owner));
  });
  ackResults(results);
  if (results.length) {
    $app.logger().info("iris sync", "results", results.length, "events", saved);
  }
}

/**
 * Brings users.irisId in line with Iris's subscribers and returns Iris user id -> users record id.
 * complete says every page of subs came back; without it nobody is unlinked.
 */
function linkStudents(tx, subs, complete, results) {
  const emails = {};
  for (const s of subs) emails[s.id] = s.email.toLowerCase();

  const owner = {};
  for (const u of tx.findAllRecords("users", $dbx.not($dbx.hashExp({ irisId: "" })))) {
    const id = u.getString("irisId");
    if (complete && !(id in emails)) {
      u.set("irisId", "");
      tx.save(u);
      continue;
    }
    owner[id] = u.id;
  }
  const byEmail = {};
  for (const r of results) {
    if (!owner[r.user] && emails[r.user]) byEmail[emails[r.user]] = r.user;
  }
  const list = Object.keys(byEmail);
  if (!list.length) return owner;
  for (const u of tx.findAllRecords("users", $dbx.in("email", ...list), $dbx.hashExp({ irisId: "" }))) {
    const id = byEmail[u.email()];
    u.set("irisId", id);
    tx.save(u);
    owner[id] = u.id;
  }
  return owner;
}

/**
 * Keeps the results of known students that hold an event, as { ...parsed, user }. A result that fails to parse
 * is logged and dropped (it is still acked: parsing it again would fail again).
 */
function parseResults(tx, results, owner) {
  const rows = [];
  for (const r of results) {
    if (!owner[r.user]) continue;
    try {
      const p = parse(r.output, r.time);
      if (p) rows.push({ ...p, user: owner[r.user], irisId: r.id });
    } catch (err) {
      tx.logger().warn("iris result not parsed", "id", r.id, "error", String(err));
    }
  }
  return rows;
}

const eventKey = (user, category, startMs) => `${user}|${category}|${startMs}`;
const pbDate = (d) => d.toISOString().replace("T", " ");

/** Saves new events and marks known ones cancelled; a repeat of a known event is a reminder and skipped. */
function storeEvents(tx, rows) {
  if (!rows.length) return 0;
  const known = mailEvents(tx, rows);
  const stored = new Set(tx.findAllRecords("events", $dbx.in("irisId", ...rows.map((r) => r.irisId))).map((e) => e.getString("irisId")));
  const col = tx.findCollectionByNameOrId("events");
  const save = [];
  for (const r of rows) {
    if (stored.has(r.irisId)) continue;
    const k = eventKey(r.user, r.category, r.start.getTime());
    const e = known[k];
    if (e) {
      if (r.cancelled && !e.getBool("cancelled")) {
        e.set("cancelled", true);
        save.push(e);
      }
      continue;
    }
    const rec = new Record(col);
    rec.load({
      user: r.user, title: r.title, category: r.category, audience: r.audience, course: r.course ?? "",
      place: r.place ?? "", link: r.link ?? "", start: pbDate(r.start), allDay: r.allDay, cancelled: r.cancelled, review: r.review,
      irisId: r.irisId,
    });
    if (r.end) rec.set("end", pbDate(r.end));
    known[k] = rec;
    save.push(rec);
  }
  let saved = 0;
  for (const e of save) {
    try {
      tx.save(e);
      saved++;
    } catch (err) {
      tx.logger().warn("iris event not saved", "title", e.getString("title"), "error", String(err));
    }
  }
  return saved;
}

/** Returns the stored mail (non-manual) events between the rows' first and last start, by eventKey. */
function mailEvents(tx, rows) {
  const starts = rows.map((r) => r.start.getTime());
  const from = new Date(Math.min(...starts)), to = new Date(Math.max(...starts));
  const known = {};
  for (const e of tx.findAllRecords("events", $dbx.hashExp({ manual: false }), $dbx.between("start", pbDate(from), pbDate(to)))) {
    known[eventKey(e.getString("user"), e.getString("category"), e.getDateTime("start").time().unixMilli())] = e;
  }
  return known;
}

/** Tells Iris these results are stored. Never before storing: an acked result never comes back. */
function ackResults(results) {
  for (let i = 0; i < results.length; i += ACK_MAX) {
    iris("POST", "/results/ack/", { ids: results.slice(i, i + ACK_MAX).map((r) => r.id) });
  }
}

module.exports = { syncIris };
