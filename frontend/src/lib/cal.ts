// Label and colour family, keyed by the server's category values.
export const CATEGORIES = {
  class: ['Class', 'course'],
  meeting: ['Meeting', 'course'],
  exam: ['Exam', 'test'],
  paper_distribution: ['Paper handout', 'test'],
  deadline: ['Deadline', 'due'],
  talk: ['Talk', 'talk'],
  workshop: ['Workshop', 'club'],
  competition: ['Competition', 'club'],
  sports: ['Sports', 'club'],
  recruitment: ['Recruitment', 'hire'],
  cultural: ['Cultural', 'fest'],
  campus_service: ['Campus service', 'other'],
  other_event: ['Other', 'other'],
} as const satisfies Record<string, readonly [string, string]>;

export type Category = keyof typeof CATEGORIES;
export const ALL = Object.keys(CATEGORIES) as Category[];
export const HIDDEN_BY_DEFAULT: Category[] = ['cultural', 'competition', 'sports', 'campus_service'];
export const label = (c: Category) => CATEGORIES[c][0];
export const kind = (c: Category) => CATEGORIES[c][1];

/** One event, with ISO date strings. */
export type Ev = {
  id: string; title: string; category: Category; course: string | null; place: string | null; link: string | null;
  start: string; end: string | null; allDay: boolean; cancelled: boolean;
};

const IST = 330 * 60_000;
const DAY = 86_400_000;

/** YYYY-MM-DD of a moment, in IST. */
export const istDay = (d: Date | string) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10);
/** Minutes since IST midnight. */
export const istMinutes = (d: Date | string) => ((new Date(d).getTime() + IST) % DAY) / 60_000;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const monday = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
export const at = (day: string, hm = '00:00') => `${day}T${hm}:00+05:30`;
export const fmt = (d: Date | string, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...o });
export const time = (d: Date | string) => fmt(d, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(':00', '').replace(' ', '');
/** The day's own name for a YYYY-MM-DD (read at IST noon, so the zone never shifts it). */
export const dayName = (day: string, o: Intl.DateTimeFormatOptions) => fmt(`${day}T12:00:00+05:30`, o);

export const byStart = (a: Ev, b: Ev) => a.start.localeCompare(b.start);
/** Whether the event touches any day from `from` to `to` (YYYY-MM-DD, inclusive). */
export const overlaps = (e: Ev, from: string, to = from) => istDay(e.start) <= to && istDay(e.end ?? e.start) >= from;
/** "All day", or the start and end times joined by `sep`. */
export const hours = (e: Ev, sep: string) => (e.allDay ? 'All day' : `${time(e.start)}${e.end ? `${sep}${time(e.end)}` : ''}`);

type Placed = { e: Ev; top: number; height: number; left: number; width: number };

/** Timed events of one day as % boxes inside the hour window, overlaps side by side. */
export function place(evs: Ev[], day: string, from: number, to: number): Placed[] {
  const span = (to - from) * 60;
  const items = evs
    .map((e) => {
      const s = istMinutes(e.start);
      const end = e.end ? (istDay(e.end) === day ? istMinutes(e.end) : 24 * 60) : s + 60;
      return { e, s, end: Math.max(end, s + 30), lane: 0 };
    })
    .sort((a, b) => a.s - b.s || b.end - a.end);
  const out: Placed[] = [];
  let group: typeof items = [];
  let lanes: number[] = [];
  const flush = () => {
    for (const g of group) {
      out.push({
        e: g.e,
        top: ((g.s - from * 60) / span) * 100,
        height: ((g.end - g.s) / span) * 100,
        left: (g.lane / lanes.length) * 100,
        width: 100 / lanes.length,
      });
    }
    group = [];
    lanes = [];
  };
  for (const it of items) {
    if (group.length && it.s >= Math.max(...lanes)) flush();
    const free = lanes.findIndex((end) => end <= it.s);
    it.lane = free === -1 ? lanes.length : free;
    lanes[it.lane] = it.end;
    group.push(it);
  }
  flush();
  return out;
}
