import PocketBase, { ClientResponseError, type RecordModel } from 'pocketbase';
import { addDays, at, monday, type Ev } from './cal';
import { forget } from './local';

// Same origin: PocketBase serves this app, and Vite forwards /api to it in dev.
export const pb = new PocketBase('/');
// Stale responses are dropped by the caller, and the week and upcoming lists run at once.
pb.autoCancellation(false);

/** The signed-in student (name, email, avatar, irisUser), kept in step with the auth store. */
export const auth = $state<{ user: RecordModel | null }>({ user: pb.authStore.record });
pb.authStore.onChange(() => (auth.user = pb.authStore.record));

/** Where a student's events are cached between visits. */
export const cacheKey = (id: string) => `events:${id}`;

export function signOut() {
  if (auth.user) forget(cacheKey(auth.user.id));
  pb.authStore.clear();
}

/** Re-reads the student (e.g. a new Iris link). A dead token (401) or deleted account (404) signs out. */
export function refreshUser() {
  if (!pb.authStore.isValid) return signOut();
  return pb.collection('users').authRefresh().catch((err: ClientResponseError) => {
    if (err.status === 401 || err.status === 404) signOut();
  });
}
refreshUser();

export const avatar = (user: RecordModel) => (user.avatar ? pb.files.getURL(user, user.avatar, { thumb: '100x100' }) : '');

// PocketBase writes dates as "2026-11-13 03:30:00.000Z" and empty fields as "".
const iso = (d: string) => (d ? d.replace(' ', 'T') : null);
export const toEv = (r: RecordModel): Ev => ({
  id: r.id, title: r.title, category: r.category, course: r.course || null, place: r.place || null, link: r.link || null,
  start: iso(r.start)!, end: iso(r.end), allDay: r.allDay, cancelled: r.cancelled,
});

export const events = pb.collection('events');
// The collection rules only ever return the student's own events.
const list = (filter: string, params: Record<string, unknown>) =>
  events.getFullList({ sort: 'start', filter: pb.filter(filter, params) }).then((rows) => rows.map(toEv));

/** Events touching the week that starts on `week`. */
export const fetchWeek = (week: string) =>
  list('start < {:to} && (start >= {:from} || end >= {:from})', { from: at(week), to: at(addDays(week, 7)) });

/** Everything not over yet, up to the end of next week. */
export const fetchUpcoming = (today: string) =>
  list('start < {:to} && (start >= {:now} || end >= {:now} || (allDay = true && start >= {:midnight}))', {
    to: at(addDays(monday(today), 14)),
    now: new Date(),
    midnight: at(today),
  });

/** The message to show for a failed request: the first field error, or a connection problem. */
export function why(err: ClientResponseError) {
  if (!err.status) return 'Could not reach Tiramisu. Check your connection and try again.';
  const field = Object.values(err.response.data ?? {})[0] as { message?: string } | undefined;
  return field?.message ?? err.response.message ?? 'Something went wrong. Try again.';
}
