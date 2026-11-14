/// <reference path="../pb_data/types.d.ts" />

const chrono = require(`${__hooks}/chrono.js`);

const values = (field) => [...$app.findCollectionByNameOrId('events').fields.getByName(field).values];

/**
 * @typedef {{ category?: string, change?: string, audience?: string, multiple?: boolean, title?: string | null,
 *   venue?: string | null, date?: string | null, start?: string | number | null, end?: string | number | null,
 *   rules?: Record<string, string[]> }} Output
 * @typedef {{ title: string, category: string, audience: string, course: string | null, place: string | null,
 *   link: string | null, start: Date, end: Date | null, allDay: boolean, cancelled: boolean, changed: boolean, review: boolean }} Parsed
 * @typedef {{ y: number, m: number, d: number }} Day
 */

const IST = 330;
const NOISE = [/^by .+ - \w+day,/i, /^posted on /i, /^on .+\d{4} at \d/i, /^(date|sent):\s*\w{3},.* at \d/i, /^\s*>/];
const GREETING = /^(dear|hi|hello|greetings)\b/i;
const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
const DAY = `\\d{1,2}(?:st|nd|rd|th)?`;
const TIME = '\\d{1,2}(?::\\d{2})? ?[ap]\\.?m\\b\\.?|\\d{1,2}:\\d{2}';
const norm = (s) => s
  .replace(/[*\s]+/g, ' ')
  .replace(/\b([A-Za-z]{3,9})\.(?=\s*\d)/g, '$1')
  .replace(/\bsept\b/gi, 'Sep')
  .replace(/\b([01]\d|2[0-3])([0-5]\d)\s*hrs?\b/gi, '$1:$2')
  .replace(new RegExp(`(${DAY} ${MON}),? (?:at )?(${TIME}) ?(?:to|till|until|-|–) ?(${DAY} ${MON}),? (?:at )?(${TIME})`, 'gi'), '$2 $1 - $4 $3')
  .replace(/(\b\d{1,2}(?:st|nd|rd|th)? )?\b([Jj]an|[Ff]eb|[Mm]ar|[Aa]pr|May|[Jj]un|[Jj]ul|[Aa]ug|[Ss]ep|[Oo]ct|[Nn]ov|[Dd]ec)([a-z]*) (\d{1,2})(st|nd|rd|th)?\b(?!,? ?\d{4}| ?[-–])/g,
    (all, before, mon, rest, d) => (before ? all : `${d} ${mon}${rest}`)) // "20 Nov 10 AM": already day first
  .replace(new RegExp(`\\b(${DAY}) (?:and|&) (?=${DAY} ${MON})`, 'gi'), '$1 - ')
  .replace(new RegExp(`\\bfrom (?=${DAY}(?: ?(?:to|till|until|-|–) ?${DAY})? ${MON})`, 'gi'), 'on ')
  .replace(new RegExp(`(${DAY} ${MON}(?:,? \\d{4})?) (?:to|till|until) (?=${DAY} ${MON})`, 'gi'), '$1 - ');
const clean = (s) => s?.replace(/[*\t]/g, ' ').replace(/\s+/g, ' ').trim() || null;
/** @returns {Day} */
const day = (c) => ({ y: c.get('year'), m: c.get('month'), d: c.get('day') });
const at = ({ y, m, d }, h, min) => new Date(Date.UTC(y, m - 1, d, h, min) - IST * 60000);
/** @returns {[number, number] | null} */
const hhmm = (v) => {
  const [, h, m] = String(v ?? '').match(/^(\d{1,2}):?(\d{2})(?!\d)/) ?? [];
  return h && +h < 24 && +m < 60 ? [+h, +m] : null;
};
/** @returns {Day | null} */
const ymd = (s, now) => {
  const [, m, d] = s?.match(/^\d{4}-(\d{2})-(\d{2})$/) ?? [];
  if (!m) return null;
  const y = new Date(now.getTime() + IST * 60000).getUTCFullYear();
  return [y - 1, y, y + 1].map((y) => ({ y, m: +m, d: +d })).find((c) => at(c, 23, 59).getTime() >= now.getTime() - 30 * 864e5) ?? null;
};
const pick = (all, v, fallback) => all.includes(v) ? v : fallback;

/**
 * @param {Output} output
 * @param {string} time
 * @returns {Parsed | null}
 */
function parse(output, time) {
  const category = output.category;
  if (!category || category === 'none') return null;
  const rules = output.rules ?? {};
  const ref = { instant: new Date(time), timezone: IST };
  const read = (s) => chrono.en.GB.parse(norm(s), ref, { forwardDate: true });
  const windows = rules.when ?? [];
  const noise = windows.filter((w) => NOISE.some((r) => r.test(w))).map(norm);
  const window = new Map();
  const found = windows.filter((w) => !NOISE.some((r) => r.test(w)))
    .flatMap((w) => read(w).map((r) => (window.set(r, w), r)))
    .filter((r) => r.start.isCertain('year') || r.start.date().getTime() - ref.instant.getTime() < 240 * 864e5)
    .filter((r) => r.start.date().getTime() >= ref.instant.getTime() - 30 * 864e5); // a typo year, like 2023 in a 2026 mail
  const days = found.filter((r) => r.start.isCertain('day'));
  const dates = days.length ? days : found.filter((r) => r.start.isCertain('weekday'));
  const guess = output.change === 'changed' ? dates[dates.length - 1] : dates[0];
  const said = ymd(output.date, ref.instant);
  const agreed = said && days.find((r) => r.start.get('month') === said.m && r.start.get('day') === said.d);
  const hit = agreed || (days.length || !said ? guess : undefined);
  const sent = new Date(ref.instant.getTime() + IST * 60000);
  const today = !hit && !said && !output.multiple && hhmm(output.start) ? { y: sent.getUTCFullYear(), m: sent.getUTCMonth() + 1, d: sent.getUTCDate() } : null;
  const date = hit ? day(hit.start) : said ?? today;
  if (!date) return null;
  const disagree = !!said && !!days.length && !agreed;
  const endOnly = !disagree && !hhmm(output.start) && !!hhmm(output.end);
  const hm = (c) => [c.get('hour'), c.get('minute')];
  let clock = disagree ? null : hhmm(output.start);
  let stop = clock && hhmm(output.end);
  if (!clock && !endOnly && hit?.start.isCertain('hour')) [clock, stop] = [hm(hit.start), hit.end ? hm(hit.end) : null];
  const lastDay = hit?.end ? day(hit.end) : date;
  if (!clock && !endOnly) {
    const times = (rules.time ?? []).filter((s) => !noise.some((n) => n.includes(norm(s))));
    const near = hit && times.find((s) => window.get(hit)?.includes(s));
    const t = (near ? [near, ...times] : times).flatMap(read)[0];
    if (t) [clock, stop] = [hm(t.start), t.end ? hm(t.end) : null];
  }
  const start = at(date, ...(clock ?? [0, 0]));
  let end = clock ? stop && at(lastDay, ...stop) : hit?.end ? at(lastDay, 23, 59) : null;
  if (clock && end && end < start) end = new Date(end.getTime() + 864e5);
  const course = clean(rules.course?.[0]?.replace(/[_-]/g, ' ').replace(/^([A-Z]+)(?=[FGH]\d)/, '$1 '));
  const cat = pick(values('category'), category, 'other_event');
  const title = [output.title, rules.title?.[0]].map((t) => clean(t ?? undefined)).find((t) => t && !GREETING.test(t));
  const fallback = `${course ?? ''} ${cat === 'other_event' ? 'event' : cat.replace(/_/g, ' ')}`.trim();
  const link = clean(rules.link?.[0]);
  const venue = clean(output.venue ?? undefined) ?? clean(rules.venue?.[0]);
  const room = clean(rules.room?.find((r) => !rules.time?.some((t) => t.includes(r))));

  return {
    title: (title ?? fallback[0].toUpperCase() + fallback.slice(1)).slice(0, 200),
    category: cat,
    audience: pick(values('audience'), output.audience, 'everyone'),
    course: course?.slice(0, 32) ?? null,
    place: ((venue && !/https?:|meet link/i.test(venue) ? venue : null) ?? room ?? (link ? 'Online' : null))?.slice(0, 200) ?? null,
    link: link?.slice(0, 500) ?? null,
    start,
    end: end && end > start ? end : null,
    allDay: !clock,
    cancelled: output.change === 'cancelled',
    changed: output.change === 'changed',
    review: output.multiple === true || output.change === 'changed' || disagree || !!today,
  };
}

module.exports = { parse };
