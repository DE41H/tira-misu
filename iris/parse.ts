import * as chrono from 'chrono-node';

const CATEGORIES = ['class', 'exam', 'paper_distribution', 'deadline', 'talk', 'workshop', 'competition',
  'recruitment', 'cultural', 'sports', 'meeting', 'campus_service', 'other_event'] as const;
const AUDIENCES = ['me', 'course', 'everyone'] as const;

type Output = {
  category?: string;
  change?: string;
  audience?: string;
  multiple?: boolean;
  title?: string | null;
  venue?: string | null;
  date?: string | null;
  start?: string | number | null;
  end?: string | number | null;
  rules?: Record<string, string[]>;
};

type Parsed = {
  title: string;
  category: (typeof CATEGORIES)[number];
  audience: (typeof AUDIENCES)[number];
  course: string | null;
  place: string | null;
  link: string | null;
  start: Date;
  end: Date | null;
  allDay: boolean;
  cancelled: boolean;
  review: boolean;
};

const IST = 330;
const NOISE = [/^by .+ - \w+day,/i, /^posted on /i, /^on .+\d{4} at \d/i, /^(date|sent):\s*\w{3},.* at \d/i, /^\s*>/];
const GREETING = /^(dear|hi|hello|greetings)\b/i;
const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
const DAY = `\\d{1,2}(?:st|nd|rd|th)?`;
const norm = (s: string) => s
  .replace(/\s+/g, ' ')
  .replace(/\b([A-Za-z]{3,9})\.(?=\s*\d)/g, '$1')
  .replace(/\bsept\b/gi, 'Sep')
  .replace(/\b([01]\d|2[0-3])([0-5]\d)\s*hrs?\b/gi, '$1:$2')
  .replace(/\b([Jj]an|[Ff]eb|[Mm]ar|[Aa]pr|May|[Jj]un|[Jj]ul|[Aa]ug|[Ss]ep|[Oo]ct|[Nn]ov|[Dd]ec)([a-z]*) (\d{1,2})(st|nd|rd|th)?\b(?!,? ?\d{4}| ?[-–])/g, '$3 $1$2')
  .replace(new RegExp(`\\bfrom (?=${DAY}(?: (?:to|till|until|-|–) ${DAY})? ${MON})`, 'gi'), 'on ')
  .replace(new RegExp(`(${DAY} ${MON}(?:,? \\d{4})?) (?:to|till|until) (?=${DAY} ${MON})`, 'gi'), '$1 - ');
const clean = (s: string | undefined) => s?.replace(/[*\t]/g, ' ').replace(/\s+/g, ' ').trim() || null;
type Day = { y: number; m: number; d: number };
const day = (c: chrono.ParsedComponents): Day => ({ y: c.get('year')!, m: c.get('month')!, d: c.get('day')! });
const at = ({ y, m, d }: Day, h: number, min: number) => new Date(Date.UTC(y, m - 1, d, h, min) - IST * 60_000);
const hhmm = (v: string | number | null | undefined): [number, number] | null => {
  const [, h, m] = String(v ?? '').match(/^(\d{1,2}):?(\d{2})(?!\d)/) ?? [];
  return h && +h < 24 && +m < 60 ? [+h, +m] : null;
};
const ymd = (s: string | null | undefined, now: Date): Day | null => {
  const [, m, d] = s?.match(/^\d{4}-(\d{2})-(\d{2})$/) ?? [];
  if (!m) return null;
  const y = new Date(now.getTime() + IST * 60_000).getUTCFullYear();
  return [y - 1, y, y + 1].map((y) => ({ y, m: +m, d: +d })).find((c) => at(c, 23, 59).getTime() >= now.getTime() - 30 * 864e5) ?? null;
};
const pick = <T extends string>(all: readonly T[], v: string | undefined, fallback: T): T => all.includes(v as T) ? (v as T) : fallback;

function parse(output: Output, time: string): Parsed | null {
  const category = output.category;
  if (!category || category === 'none') return null;
  const rules = output.rules ?? {};
  const ref = { instant: new Date(time), timezone: IST };
  const read = (s: string) => chrono.en.GB.parse(norm(s), ref, { forwardDate: true });
  const windows = rules.when ?? [];
  const noise = windows.filter((w) => NOISE.some((r) => r.test(w))).map(norm);
  const window = new Map<chrono.ParsedResult, string>();
  const found = windows.filter((w) => !NOISE.some((r) => r.test(w)))
    .flatMap((w) => read(w).map((r) => (window.set(r, w), r)))
    .filter((r) => r.start.isCertain('year') || r.start.date().getTime() - ref.instant.getTime() < 240 * 864e5);
  const days = found.filter((r) => r.start.isCertain('day'));
  const dates = days.length ? days : found.filter((r) => r.start.isCertain('weekday'));
  const guess = output.change === 'changed' ? dates.at(-1) : dates[0];
  const said = ymd(output.date, ref.instant);
  const agreed = said && days.find((r) => r.start.get('month') === said.m && r.start.get('day') === said.d);
  const hit = agreed || (days.length || !said ? guess : undefined);
  const date = hit ? day(hit.start) : said;
  if (!date) return null;
  const disagree = !!said && !!days.length && !agreed;
  const hm = (c: chrono.ParsedComponents): [number, number] => [c.get('hour')!, c.get('minute')!];
  let clock = disagree ? null : hhmm(output.start);
  let stop = clock && hhmm(output.end);
  if (!clock && hit?.start.isCertain('hour')) [clock, stop] = [hm(hit.start), hit.end ? hm(hit.end) : null];
  if (!clock) {
    const times = (rules.time ?? []).filter((s) => !noise.some((n) => n.includes(norm(s))));
    const near = hit && times.find((s) => window.get(hit)?.includes(s));
    const t = (near ? [near, ...times] : times).flatMap(read)[0];
    if (t) [clock, stop] = [hm(t.start), t.end ? hm(t.end) : null];
  }
  const start = at(date, ...(clock ?? [0, 0]));
  let end = clock ? stop && at(date, ...stop) : hit?.end ? at(day(hit.end), 23, 59) : null;
  if (clock && end && end < start) end = new Date(end.getTime() + 864e5); // "10 PM to 1 AM"
  const course = clean(rules.course?.[0]?.replace(/[_-]/g, ' ').replace(/^([A-Z]+)(?=[FGH]\d)/, '$1 '));
  const cat = pick(CATEGORIES, category, 'other_event');
  const title = [output.title, rules.title?.[0]].map((t) => clean(t ?? undefined)).find((t) => t && !GREETING.test(t));
  const fallback = `${course ?? ''} ${cat === 'other_event' ? 'event' : cat.replace(/_/g, ' ')}`.trim();
  const link = clean(rules.link?.[0]);
  const venue = clean(output.venue ?? undefined) ?? clean(rules.venue?.[0]);
  const room = clean(rules.room?.find((r) => !rules.time?.some((t) => t.includes(r))));

  return {
    title: (title ?? fallback[0].toUpperCase() + fallback.slice(1)).slice(0, 200),
    category: cat,
    audience: pick(AUDIENCES, output.audience, 'everyone'),
    course: course?.slice(0, 32) ?? null,
    place: ((venue && !/https?:|meet link/i.test(venue) ? venue : null) ?? room ?? (link ? 'Online' : null))?.slice(0, 200) ?? null,
    link: link?.slice(0, 500) ?? null,
    start,
    end: end && end > start ? end : null,
    allDay: !clock,
    cancelled: output.change === 'cancelled',
    review: output.multiple === true || output.change === 'changed' || disagree,
  };
}

(globalThis as any).parse = (output: string, time: string) => JSON.stringify(parse(JSON.parse(output), time));
